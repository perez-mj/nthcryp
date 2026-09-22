'use strict';

const { Emitter } = require('../util/events');
const { SCREENS } = require('./screens');

/**
 * The store. One state object. One reducer. One emitter.
 *
 * State is immutable in the sense that we never mutate the object
 * in place — every update produces a new object via Object.assign.
 * Screens receive a frozen snapshot and render from it.
 *
 * Why? Because debugging a UI where "something changed somewhere" is a
 * nightmare. With this model, every render sees a state object that
 * cannot have been mutated since the last one.
 */

const INITIAL_STATE = Object.freeze({
  screen: SCREENS.MAIN_MENU,

  // Main menu
  menuIndex: 0,

  // File picker
  cwd: process.cwd(),
  pickerEntries: [],   // populated by the file picker screen
  pickerIndex: 0,
  pickerPurpose: null, // 'encrypt' | 'decrypt'

  // Chosen file (encrypt path)
  filePath: null,
  fileBuffer: null,
  fileSize: 0,

  // Algorithm + params
  algorithm: null,     // registry id
  params: {},          // e.g. { shift: 3 }

  // Pipeline
  pipelineMode: null,     // 'encrypt' | 'decrypt'
  pipelineRunning: false,
  stages: [],          // [{ name, status: 'pending'|'running'|'done' }]
  logs: [],            // [{ ts, message }]

  // Result
  result: null,        // { ok, outputPath, size, preview, error }

  // Generic error surface (used by the result screen)
  error: null,
});

class Store extends Emitter {
  constructor(initial = INITIAL_STATE) {
    super();
    this._state = initial;
  }

  getState() {
    return this._state;
  }

  /**
   * Apply a patch (a plain object) and emit 'change'.
   * Passing the same reference as before is a no-op.
   */
  set(patch) {
    const next = Object.assign({}, this._state, patch);
    if (shallowEqual(next, this._state)) return;
    this._state = Object.freeze(next);
    this.emit('change', this._state);
  }

  /**
   * The transition applier. Screens return a transition name; the top-level
   * loop calls this with that name; the store decides what it means.
   */
  applyTransition(name, payload = {}) {
    switch (name) {
      case 'selectEncrypt':
        this.set({
          screen: SCREENS.FILE_PICKER,
          pickerPurpose: 'encrypt',
          pickerIndex: 0,
          filePath: null,
          fileBuffer: null,
          fileSize: 0,
          algorithm: null,
          params: {},
          stages: [],
          logs: [],
          result: null,
          error: null,
        });
        return;

      case 'selectDecrypt':
        this.set({
          screen: SCREENS.FILE_PICKER,
          pickerPurpose: 'decrypt',
          pickerIndex: 0,
          filePath: null,
          fileBuffer: null,
          fileSize: 0,
          algorithm: null,
          params: {},
          stages: [],
          logs: [],
          result: null,
          error: null,
        });
        return;

      case 'selectQuit':
        this.emit('quit');
        return;

      case 'pick':
        this.set({ error: null });
        if (this._state.pickerPurpose === 'decrypt') {
          this.set({
            screen: SCREENS.PIPELINE,
            pipelineMode: 'decrypt',
            pipelineRunning: false,
            stages: [],
            logs: [],
          });
        } else {
          this.set({ screen: SCREENS.ALGORITHM_PICKER, menuIndex: 0 });
        }
        return;

      case 'parametersDone':
        this.set({
          screen: SCREENS.PIPELINE,
          pipelineMode: 'encrypt',
          pipelineRunning: false,
          stages: [],
          logs: [],
          error: null,
        });
        return;

      case 'pipelineDone':
        this.set({ screen: SCREENS.RESULT, error: null });
        return;

      case 'resultBack':
        this.set({
          screen: SCREENS.MAIN_MENU,
          menuIndex: 0,
          // Reset everything below the menu.
          filePath: null, fileBuffer: null, fileSize: 0,
          algorithm: null, params: {},
          stages: [], logs: [],
          pipelineMode: null, pipelineRunning: false,
          result: null, error: null,
          pickerEntries: [], pickerIndex: 0, pickerPurpose: null,
        });
        return;

      case 'back':
        // back goes to the previous logical screen based on current.
        {
          const s = this._state.screen;
          if (s === SCREENS.FILE_PICKER) {
            this.set({ screen: SCREENS.MAIN_MENU, menuIndex: 0, error: null });
          } else if (s === SCREENS.ALGORITHM_PICKER) {
            this.set({ screen: SCREENS.FILE_PICKER, error: null });
          } else if (s === SCREENS.PARAMETERS) {
            this.set({ screen: SCREENS.ALGORITHM_PICKER, error: null });
          } else {
            this.set({ screen: SCREENS.MAIN_MENU, menuIndex: 0, error: null });
          }
        }
        return;

      default:
        throw new Error(`Unknown transition: ${name}`);
    }
  }
}

function shallowEqual(a, b) {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

module.exports = { Store, INITIAL_STATE };