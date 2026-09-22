'use strict';

const { ansi } = require('../ansi');

/**
 * Draw an error banner at the bottom of the screen, if state.error is set.
 * Returns true if it drew something, false otherwise.
 *
 * Deliberately a single line. Multi-line errors turn every layout into a
 * negotiation with the error banner. One line, truncated with an ellipsis.
 */
function drawErrorBanner(screen, state, { cols, rows }) {
  if (!state.error) return false;

  const row = rows - 1;
  const msg = ` ✗ ${state.error} `;
  const padded = msg.length > cols ? msg.slice(0, cols - 1) + '…' : msg;

  screen.text(row, 0, padded, ansi.white + ansi.bgRed);
  // Fill the rest of the row with the same background.
  const remaining = cols - padded.length;
  for (let i = 0; i < remaining; i++) {
    screen.put(row, padded.length + i, ' ', ansi.white + ansi.bgRed);
  }
  return true;
}

module.exports = { drawErrorBanner };