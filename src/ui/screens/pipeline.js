'use strict';

const { KEYS } = require('../../state/input');
const { SCREENS } = require('../../state/screens');
const { drawBox } = require('../components/box');
const { drawErrorBanner } = require('../components/errorBanner');
const { ansi, styled } = require('../ansi');
const { drawBar, stageMarker, stageStyle, stageRatio } = require('../components/progress');
const registry = require('../../crypto');
const { pack, unpack, isNth } = require('../../io/formats');
const { writeFile } = require('../../io/writeFile');

/**
 * Pipeline screen.
 *
 * Two jobs:
 *   1. Render the stage list + a scrolling log pane from state.
 *   2. On entry, kick off the real encrypt/decrypt work by calling into
 *      the crypto module with an `emit` callback that writes to state.
 *
 * The crypto module never imports this file. It just calls emit({...}).
 * The pipeline is a passive listener — but it owns the *pacing* of its
 * own animation, which is a presentation concern, not a store concern.
 */

// Minimum time (ms) each stage is shown. Crypto on a small file finishes
// in a few ms; this is what makes the pipeline feel like work is happening.
// Set to 0 for raw speed.
const MIN_STAGE_MS = 150;

// marker(1) + space(1) + label(16) + space(1) + brackets(2) + space(1) + "100%"(4) = 26
const LABEL_W = 16;
const FIXED = 1 + 1 + LABEL_W + 1 + 2 + 1 + 4;   // = 26

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Key handler. While the pipeline is running, keys are ignored
 * (except Ctrl-C, which the input layer handles). Once done,
 * Enter/Esc return to the main menu.
 */
function handleKey(key, ch, state) {
  if (state.pipelineRunning) return null;

  switch (key) {
    case KEYS.ENTER:
    case KEYS.ESCAPE:
      return { type: 'transition', name: 'resultBack' };
    default:
      return null;
  }
}

function render(screen, state, { cols, rows }) {
  const algo = state.algorithm ? registry.get(state.algorithm) : null;

  const boxW = Math.min(76, cols - 4);
  const boxH = Math.min(rows - 4, 20);
  const r0 = Math.max(1, Math.floor((rows - boxH) / 2));
  const c0 = Math.max(1, Math.floor((cols - boxW) / 2));

  const title = state.pipelineMode === 'decrypt' ? 'DECRYPTING' : 'ENCRYPTING';
  const inner = drawBox(screen, r0, c0, boxW, boxH, {
    title: `${title} — ${algo ? algo.name : ''}`,
    style: ansi.cyan,
    titleStyle: ansi.cyan + ansi.bold,
  });

  // Header: file + size
  const fileName = state.filePath ? state.filePath.split('/').pop() : '(no file)';
  screen.text(inner.row, inner.col, `file:  ${fileName} (${state.fileSize} B)`, ansi.white);

  // Separator
  const sepRow = inner.row + 1;
  for (let c = 0; c < inner.width; c++) {
    screen.put(sepRow, inner.col + c, '─', ansi.gray);
  }

  // Stages
  const stages = state.stages;
  const stageTop = inner.row + 3;
  const barWidth = Math.max(10, inner.width - FIXED);
  for (let i = 0; i < stages.length; i++) {
    const s = stages[i];
    const row = stageTop + i;
    const marker = stageMarker(s.status);
    const style = stageStyle(s.status);
    const label = s.name.padEnd(LABEL_W, ' ');
    const bar = drawBar(stageRatio(s.status), barWidth);
    screen.text(row, inner.col, `${marker} ${label} ${bar}`, style);
  }

  // Log pane (below stages)
  const logTop = stageTop + stages.length + 2;
  const logH = (r0 + boxH - 3) - logTop;
  if (logH > 0) {
    for (let c = 0; c < inner.width; c++) {
      screen.put(logTop - 1, inner.col + c, '─', ansi.gray);
    }
    const logs = state.logs.slice(-logH);
    for (let i = 0; i < logs.length; i++) {
      const line = truncate(logs[i].message, inner.width);
      screen.text(logTop + i, inner.col, line, ansi.gray);
    }
  }

  // Footer
  const footer = state.pipelineRunning
    ? 'working…'
    : 'Enter/Esc return to menu';
  screen.text(r0 + boxH - 2, c0 + 2, footer, ansi.gray);

  drawErrorBanner(screen, state, { cols, rows });
}

function truncate(s, width) {
  if (s.length <= width) return s;
  return s.slice(0, width - 1) + '…';
}

/**
 * Build an emitter pair: a synchronous `emit` the crypto module calls,
 * and an async `drain` that replays the buffered events into the store
 * at a readable pace. `await drain()` before transitioning away.
 */
function makePacedEmitter(actions, seedStages) {
  let stages = seedStages;
  let logs = [];
  const pending = [];
  let draining = null;

  const drain = async () => {
    while (pending.length) {
      const evt = pending.shift();
      if (evt.kind === 'stage') {
        stages = stages.map((s) =>
          s.name === evt.name
            ? { ...s, status: evt.status === 'running' ? 'running' : 'done' }
            : s
        );
        actions.set({ stages });
      } else {
        logs = logs.concat({ ts: Date.now(), message: evt.message });
        if (logs.length > 100) logs = logs.slice(-100);
        actions.set({ logs });
      }
      if (MIN_STAGE_MS > 0) await delay(MIN_STAGE_MS);
    }
    draining = null;
  };

  const emit = (evt) => {
    if (evt.type === 'stage') {
      pending.push({ kind: 'stage', name: evt.name, status: evt.status });
    } else if (evt.type === 'log') {
      pending.push({ kind: 'log', message: evt.message });
    } else {
      return;
    }
    if (!draining) draining = drain();
  };

  const waitForDrain = async () => {
    if (draining) await draining;
  };

  return { emit, waitForDrain };
}

/**
 * The actual work. Called once when the pipeline screen is entered.
 * Returns a Promise that resolves when the operation completes.
 */
async function run(state, actions) {
  const input = state.fileBuffer;
  if (!input) {
    actions.set({ error: 'No file loaded.', pipelineRunning: false, result: { ok: false } });
    return;
  }

  const isDecrypt = state.pipelineMode === 'decrypt';

  try {
    if (isDecrypt) {
      await runDecrypt(state, actions);
    } else {
      await runEncrypt(state, actions);
    }
  } catch (err) {
    actions.set({
      pipelineRunning: false,
      error: err.message,
      result: { ok: false, error: err.message },
    });
    actions.transition('pipelineDone');
  }
}

async function runEncrypt(state, actions) {
  const algo = registry.get(state.algorithm);

  const seedStages = algo.stages.map((name) => ({ name, status: 'pending' }));
  actions.set({ stages: seedStages, logs: [], pipelineRunning: true });

  const { emit, waitForDrain } = makePacedEmitter(actions, seedStages);

  // Yield once so the first render lands before the work.
  await new Promise((r) => setImmediate(r));

  // Real crypto — synchronous or promise-returning, both fine.
  const { data, meta } = algo.encrypt(state.fileBuffer, state.params, emit);

  // Let the animation finish before we tear down the screen.
  await waitForDrain();

  const packed = pack(algo.id, meta, data);
  const outputPath = state.filePath + '.nth';
  await writeFile(outputPath, packed);

  actions.set({
    pipelineRunning: false,
    result: {
      ok: true,
      outputPath,
      size: packed.length,
      ciphertextSize: data.length,
      meta,
      algorithm: algo.id,
      mode: 'encrypt',
    },
  });
  actions.transition('pipelineDone');
}

async function runDecrypt(state, actions) {
  const buf = state.fileBuffer;
  if (!isNth(buf)) {
    throw new Error('Not a NTHCRYP file (bad magic bytes).');
  }

  const { algorithmId, meta, ciphertext } = unpack(buf);
  const algo = registry.get(algorithmId);
  const names = algo.decryptStages || algo.stages;
  const seedStages = names.map((name) => ({ name, status: 'pending' }));
  actions.set({
    stages: seedStages,
    logs: [],
    algorithm: algorithmId,
    pipelineRunning: true,
  });

  const { emit, waitForDrain } = makePacedEmitter(actions, seedStages);

  await new Promise((r) => setImmediate(r));

  const { data } = algo.decrypt(ciphertext, {}, meta, emit);

  await waitForDrain();

  const outputPath = state.filePath.endsWith('.nth')
    ? state.filePath.slice(0, -4)
    : state.filePath + '.decrypted';
  await writeFile(outputPath, data);

  actions.set({
    pipelineRunning: false,
    result: {
      ok: true,
      outputPath,
      size: data.length,
      algorithm: algorithmId,
      mode: 'decrypt',
    },
  });
  actions.transition('pipelineDone');
}

module.exports = { render, handleKey, run, MIN_STAGE_MS };