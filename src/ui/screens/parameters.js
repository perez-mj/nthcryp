'use strict';

const { KEYS } = require('../../state/input');
const { SCREENS } = require('../../state/screens');
const { drawBox } = require('../components/box');
const { drawErrorBanner } = require('../components/errorBanner');
const { ansi } = require('../ansi');
const registry = require('../../crypto');

/**
 * Parameters screen. Reads algo.options and renders one editable field
 * per option. If the algorithm has no options (AES), this screen still
 * shows a confirmation — no dead-end.
 *
 * Currently supports numeric options (Caesar: shift amount). String
 * options are trivially addable by adding a 'string' branch.
 */

function render(screen, state, { cols, rows }) {
  const algo = registry.get(state.algorithm);
  const opts = algo.options;
  const boxW = 60;
  const boxH = Math.max(8, opts.length * 3 + 8);
  const r0 = Math.max(1, Math.floor((rows - boxH) / 2));
  const c0 = Math.max(1, Math.floor((cols - boxW) / 2));

  const inner = drawBox(screen, r0, c0, boxW, boxH, {
    title: `PARAMETERS — ${algo.name}`,
    style: ansi.cyan,
    titleStyle: ansi.cyan + ansi.bold,
  });

  // Explanation
  screen.text(inner.row, inner.col, 'Configure this algorithm, then continue.', ansi.gray);

  if (opts.length === 0) {
    screen.text(inner.row + 2, inner.col, 'No parameters needed. Press Enter to continue.', ansi.white);
  } else {
    const fieldRow0 = inner.row + 2;
    for (let i = 0; i < opts.length; i++) {
      const opt = opts[i];
      const selected = i === state.menuIndex;
      const value = state.params[opt.key];
      const marker = selected ? '▶ ' : '  ';
      const style = selected ? ansi.cyan + ansi.bold : ansi.white;

      const valueLabel = `< ${value} >`;
      screen.text(fieldRow0 + i * 3, inner.col, marker + opt.label + ':', style);
      screen.text(fieldRow0 + i * 3 + 1, inner.col + 2, valueLabel, style);

      if (selected) {
        // Hint line for the selected field
        const hint = opt.type === 'number'
          ? '←/→ decrement/increment   type digits to enter'
          : '';
        if (hint) screen.text(fieldRow0 + i * 3 + 2, inner.col + 2, hint, ansi.gray);
      }
    }
  }

  // Footer
  screen.text(r0 + boxH - 2, c0 + 2, '↑↓ field   ←/→ adjust   Enter continue   Esc back', ansi.gray);

  drawErrorBanner(screen, state, { cols, rows });
}

function handleKey(key, ch, state) {
  const algo = registry.get(state.algorithm);
  const opts = algo.options;

  if (opts.length === 0) {
    if (key === KEYS.ENTER) return { type: 'transition', name: 'parametersDone' };
    if (key === KEYS.ESCAPE) return { type: 'transition', name: 'back' };
    return null;
  }

  const current = opts[state.menuIndex];
  const currentVal = state.params[current.key];

  switch (key) {
    case KEYS.UP:
      return { type: 'set', patch: { menuIndex: (state.menuIndex - 1 + opts.length) % opts.length } };
    case KEYS.DOWN:
      return { type: 'set', patch: { menuIndex: (state.menuIndex + 1) % opts.length } };

    case KEYS.LEFT:
      if (current.type === 'number') {
        return { type: 'set', patch: { params: { ...state.params, [current.key]: currentVal - 1 } } };
      }
      return null;

    case KEYS.RIGHT:
      if (current.type === 'number') {
        return { type: 'set', patch: { params: { ...state.params, [current.key]: currentVal + 1 } } };
      }
      return null;

    case KEYS.CHAR: {
      // Digits extend the current value if it's a number.
      if (current.type !== 'number') return null;
      if (!/^[0-9]$/.test(ch)) return null;
      const next = Number(String(currentVal) + ch);
      return { type: 'set', patch: { params: { ...state.params, [current.key]: next } } };
    }

    case KEYS.BACKSPACE: {
      if (current.type !== 'number') return null;
      const s = String(currentVal);
      if (s.length <= 1) return { type: 'set', patch: { params: { ...state.params, [current.key]: 0 } } };
      return { type: 'set', patch: { params: { ...state.params, [current.key]: Number(s.slice(0, -1)) } } };
    }

    case KEYS.ENTER:
      return { type: 'transition', name: 'parametersDone' };

    case KEYS.ESCAPE:
      return { type: 'transition', name: 'back' };

    default:
      return null;
  }
}

module.exports = { render, handleKey };