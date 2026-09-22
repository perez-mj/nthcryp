'use strict';

const { Screen } = require('./ui/screen');
const { Renderer } = require('./ui/render');
const { Input, KEYS } = require('./state/input');
const { Store } = require('./state/store');
const { SCREENS } = require('./state/screens');

const mainMenuScreen = require('./ui/screens/mainMenu');
const filePickerScreen = require('./ui/screens/filePicker');
const algorithmPickerScreen = require('./ui/screens/algorithmPicker');
const parametersScreen = require('./ui/screens/parameters');
const pipelineScreen = require('./ui/screens/pipeline');
const resultScreen = require('./ui/screens/result');

const { listDirectory, filterForPurpose } = require('./io/filePicker');

/**
 * Screen registry. This is the whole UI:
 * add a screen by adding one entry here and one file in ui/screens/.
 */
const SCREEN_IMPL = {
  [SCREENS.MAIN_MENU]: mainMenuScreen,
  [SCREENS.FILE_PICKER]: filePickerScreen,
  [SCREENS.ALGORITHM_PICKER]: algorithmPickerScreen,
  [SCREENS.PARAMETERS]: parametersScreen,
  [SCREENS.PIPELINE]: pipelineScreen,
  [SCREENS.RESULT]: resultScreen,
};

// Minimum time (ms) each stage of the pipeline is shown. This makes
// Caesar on a 40-byte file feel like work is happening. Set to 0 for
// raw speed; 150 is a good demo default.

async function main() {
  const store = new Store();
  const input = new Input();
  const renderer = new Renderer();

  let cols = process.stdout.columns || 80;
  let rows = process.stdout.rows || 24;

  const draw = () => {
    const screen = new Screen(cols, rows);
    const state = store.getState();
    const impl = SCREEN_IMPL[state.screen];
    if (!impl) {
      screen.text(2, 2, `No implementation for screen: ${state.screen}`, '');
    } else {
      impl.render(screen, state, { cols, rows });
    }
    renderer.draw(screen);
  };

  store.on('change', draw);

  process.on('SIGWINCH', () => {
    cols = process.stdout.columns || 80;
    rows = process.stdout.rows || 24;
    draw();
  });

  // The bridge from screens to the store.
  const actions = {
    set(patch) {
      store.set(patch);
    },
    transition(name, payload) {
      store.applyTransition(name, payload);
    },
    getState() {
      return store.getState();
    },
  };

  // --- Populate-on-entry hooks ---
  let pipelineStarted = false;

  store.on('change', async (state) => {
    // File picker: populate entries on first visit.
    if (state.screen === SCREENS.FILE_PICKER && state.pickerEntries.length === 0) {
      try {
        const all = await listDirectory(state.cwd);
        const filtered = filterForPurpose(all, state.pickerPurpose);
        store.set({ pickerEntries: filtered, pickerIndex: 0 });
      } catch (err) {
        store.set({ error: err.message });
      }
    }

    if (state.screen === SCREENS.PIPELINE && !pipelineStarted) {
      pipelineStarted = true;
      pipelineScreen.run(state, actions).catch((err) => {
        store.set({ error: err.message, pipelineRunning: false });
      });
    }

    if (state.screen !== SCREENS.PIPELINE && pipelineStarted) {
      pipelineStarted = false;
    }
  });

  store.on('quit', () => shutdown(0));

  // --- Key dispatch ---
  const dispatchKey = async (key, ch) => {
    const state = store.getState();
    const impl = SCREEN_IMPL[state.screen];
    if (!impl) return;

    const intent = impl.handleKey(key, ch, state, actions);
    if (!intent) return;

    switch (intent.type) {
      case 'set':
        store.set(intent.patch);
        break;
      case 'transition':
        store.applyTransition(intent.name, intent.payload || {});
        break;
      case 'async': {
        const result = await intent.run();
        if (result && result.transition) {
          store.applyTransition(result.transition, result.payload || {});
        }
        break;
      }
      case 'quit':
        shutdown(0);
        break;
      default:
        throw new Error(`Unknown intent type: ${intent.type}`);
    }
  };

  for (const key of Object.values(KEYS)) {
    if (key === KEYS.CHAR) {
      input.on(key, (ch) => dispatchKey(key, ch).catch(handleFatal));
    } else {
      input.on(key, () => dispatchKey(key).catch(handleFatal));
    }
  }

  // --- Shutdown & cleanup ---
  let shuttingDown = false;
  function shutdown(code) {
    if (shuttingDown) return;
    shuttingDown = true;
    input.stop();
    renderer.stop();
    // Exit the alternate screen buffer and move the cursor below the UI.
    process.stdout.write('\x1b[?1049l');
    process.stdout.write('\x1b[?25h');
    process.exit(code);
  }

  function handleFatal(err) {
    // Last-resort cleanup. Even if a screen's async work throws, we
    // restore the terminal before printing the error.
    input.stop();
    renderer.stop();
    process.stdout.write('\x1b[?1049l');
    process.stdout.write('\x1b[?25h');
    console.error('Fatal:', err && err.stack ? err.stack : String(err));
    process.exit(1);
  }

  // --- Enter the alternate screen buffer ---
  process.stdout.write('\x1b[?1049h');   // alt screen
  renderer.start();
  input.start();
  draw();
}

module.exports = { main };