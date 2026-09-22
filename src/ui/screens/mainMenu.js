'use strict';

const { SCREENS } = require('../../state/screens');
const { KEYS } = require('../../state/input');
const { drawBox } = require('../components/box');
const { drawErrorBanner } = require('../components/errorBanner');
const { ansi } = require('../ansi');

/**
 * Main menu. Three items:
 *   Encrypt file
 *   Decrypt file
 *   Quit
 *
 * Arrow keys move the selection. Enter dispatches a transition.
 * Esc quits — a small convenience, since there's nowhere to go back to.
 */

const ITEMS = [
  { label: 'Encrypt file', transition: 'selectEncrypt' },
  { label: 'Decrypt file', transition: 'selectDecrypt' },
  { label: 'Quit', transition: 'selectQuit' },
];

function render(screen, state, { cols, rows }) {
  const boxW = 44;
  const contentH = 1 + 1 + (ITEMS.length * 2 - 1) + 1 + 1;
  const boxH = contentH + 2;
  const r0 = Math.floor((rows - boxH) / 2);
  const c0 = Math.floor((cols - boxW) / 2);

  const inner = drawBox(screen, r0, c0, boxW, boxH, {
    title: 'NTHCRYP',
    style: ansi.cyan,
    titleStyle: ansi.cyan + ansi.bold,
  });

  // The inside of the box starts one row below the top border.
  const top = r0 + 1;

  // Tagline
  screen.text(top, inner.col, 'The Nth layer of encryption.', ansi.gray);

  // Items, starting two rows below the tagline, one blank between each.
  const itemRow0 = top + 2;
  for (let i = 0; i < ITEMS.length; i++) {
    const selected = i === state.menuIndex;
    const marker = selected ? '▶ ' : '  ';
    const style = selected ? ansi.cyan + ansi.bold : ansi.white;
    screen.text(itemRow0 + i * 2, inner.col, marker + ITEMS[i].label, style);
  }

  // Footer, one row above the bottom border.
  const footerRow = r0 + boxH - 2;
  screen.text(footerRow, c0 + 2, '↑↓ move   Enter select', ansi.gray);

  drawErrorBanner(screen, state, { cols, rows });
}

/**
 * Handle a key event. Return a transition name (string), or null to stay.
 * The store applies the transition.
 */
function handleKey(key, ch, state) {
  switch (key) {
    case KEYS.UP:
      return { type: 'set', patch: { menuIndex: (state.menuIndex - 1 + ITEMS.length) % ITEMS.length } };
    case KEYS.DOWN:
      return { type: 'set', patch: { menuIndex: (state.menuIndex + 1) % ITEMS.length } };
    case KEYS.ENTER:
      return { type: 'transition', name: ITEMS[state.menuIndex].transition };
    case KEYS.ESCAPE:
      return { type: 'transition', name: 'selectQuit' };
    default:
      return null;
  }
}

module.exports = { render, handleKey, ITEMS };