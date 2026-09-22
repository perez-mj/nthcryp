'use strict';

/**
 * Box component — a tiny helper on top of Screen.box, with a title
 * and (optionally) inset content drawn by a callback.
 *
 * Screens will use this instead of calling screen.box() directly, so
 * the padding convention stays in one place.
 */

const PADDING_X = 1;
const PADDING_Y = 1;

/**
 * Draw a box with a title, and return the inner region's origin + size
 * so the caller can draw content inside it with correct padding.
 *
 *   const inner = drawBox(screen, 0, 0, 40, 10, { title: 'MENU' });
 *   screen.text(inner.row, inner.col, 'item 1');
 */
function drawBox(screen, row, col, width, height, { title = '', style = '', titleStyle = '' } = {}) {
  screen.box(row, col, width, height, { title, style, titleStyle });
  return {
    row: row + 1 + PADDING_Y,
    col: col + 1 + PADDING_X,
    width: width - 2 - PADDING_X * 2,
    height: height - 2 - PADDING_Y * 2,
  };
}

module.exports = { drawBox, PADDING_X, PADDING_Y };