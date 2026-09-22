'use strict';

const { KEYS } = require('../../state/input');
const { drawBox } = require('../components/box');
const { drawErrorBanner } = require('../components/errorBanner');
const { ansi } = require('../ansi');
const registry = require('../../crypto');

/**
 * Algorithm picker. Reads the registry, not a hard-coded list.
 * Adding an algorithm is one registry line — this screen updates itself.
 */

function items() {
  return registry.all().map((algo) => ({
    id: algo.id,
    label: algo.name,
    generatesKey: algo.generatesKey,
    requiresPassword: algo.requiresPassword,
    options: algo.options,
  }));
}

function render(screen, state, { cols, rows }) {
  const list = items();
  const boxW = 56;
  const boxH = list.length + 8;
  const r0 = Math.max(1, Math.floor((rows - boxH) / 2));
  const c0 = Math.max(1, Math.floor((cols - boxW) / 2));

  const inner = drawBox(screen, r0, c0, boxW, boxH, {
    title: 'CHOOSE ALGORITHM',
    style: ansi.cyan,
    titleStyle: ansi.cyan + ansi.bold,
  });

  // File summary line
  const name = state.filePath ? state.filePath.split('/').pop() : '(no file)';
  const sizeLabel = `${state.fileSize} B`;
  screen.text(inner.row, inner.col, `file: ${name}  (${sizeLabel})`, ansi.gray);

  // Separator
  const sepRow = inner.row + 1;
  for (let c = 0; c < inner.width; c++) {
    screen.put(sepRow, inner.col + c, '─', ansi.gray);
  }

  // Items
  const itemRow0 = inner.row + 3;
  for (let i = 0; i < list.length; i++) {
    const selected = i === state.menuIndex;
    const a = list[i];
    const marker = selected ? '▶ ' : '  ';
    const style = selected ? ansi.cyan + ansi.bold : ansi.white;

    screen.text(itemRow0 + i * 2, inner.col, marker + a.label, style);

    // Second line per item: small hint about key generation
    const hintParts = [];
    if (a.generatesKey) hintParts.push('generates key');
    if (a.options.length > 0) hintParts.push(`${a.options.length} option${a.options.length > 1 ? 's' : ''}`);
    if (a.requiresPassword) hintParts.push('needs passphrase');
    if (hintParts.length === 0) hintParts.push('no options');
    const hint = hintParts.join(' · ');
    screen.text(itemRow0 + i * 2 + 1, inner.col + 2, hint, ansi.gray);
  }

  // Footer
  screen.text(r0 + boxH - 2, c0 + 2, '↑↓ move   Enter choose   Esc back', ansi.gray);

  drawErrorBanner(screen, state, { cols, rows });
}

function handleKey(key, ch, state) {
  const list = items();

  switch (key) {
    case KEYS.UP:
      return { type: 'set', patch: { menuIndex: (state.menuIndex - 1 + list.length) % list.length } };
    case KEYS.DOWN:
      return { type: 'set', patch: { menuIndex: (state.menuIndex + 1) % list.length } };
    case KEYS.ENTER: {
      const chosen = list[state.menuIndex];
      if (!chosen) return null;
      // Reset params to defaults from the algorithm's option list.
      const params = {};
      for (const opt of chosen.options) {
        params[opt.key] = opt.default;
      }
      return {
        type: 'set',
        patch: { algorithm: chosen.id, params, screen: require('../../state/screens').SCREENS.PARAMETERS },
      };
    }
    case KEYS.ESCAPE:
      return { type: 'transition', name: 'back' };
    default:
      return null;
  }
}

module.exports = { render, handleKey };