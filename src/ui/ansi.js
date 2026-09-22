'use strict';

/**
 * ANSI escape codes. No dependencies, no cleverness — just named constants
 * so the rest of the codebase doesn't litter \x1b[... everywhere.
 *
 * All strings are raw escape sequences meant to be embedded in output.
 */

const ESC = '\x1b[';
const CSI = ESC;

// --- Cursor & screen ---
const ansi = {
  hideCursor: `${CSI}?25l`,
  showCursor: `${CSI}?25h`,
  clear:      `${CSI}2J`,
  home:       `${CSI}H`,
  clearLine:  `${CSI}2K`,
  moveTo:     (row, col) => `${CSI}${row + 1};${col + 1}H`,  // 1-based on the wire

  // --- Styles ---
  reset:   `${CSI}0m`,
  bold:    `${CSI}1m`,
  dim:     `${CSI}2m`,
  reverse: `${CSI}7m`,

  // --- Foreground colors (16-color) ---
  black:   `${CSI}30m`,
  red:     `${CSI}31m`,
  green:   `${CSI}32m`,
  yellow:  `${CSI}33m`,
  blue:    `${CSI}34m`,
  magenta: `${CSI}35m`,
  cyan:    `${CSI}36m`,
  white:   `${CSI}37m`,
  gray:    `${CSI}90m`,

  // --- Background colors ---
  bgBlack:   `${CSI}40m`,
  bgRed:     `${CSI}41m`,
  bgGreen:   `${CSI}42m`,
  bgBlue:    `${CSI}44m`,
  bgCyan:    `${CSI}46m`,
  bgWhite:   `${CSI}47m`,
};

/**
 * Wrap text in a style, then reset. Nesting works because ANSI is a stack
 * of last-write-wins, and `reset` clears everything — so if you nest, do it
 * consciously. For our components, one style per run of characters.
 */
function styled(text, ...codes) {
  return codes.join('') + text + ansi.reset;
}

module.exports = { ansi, styled, CSI };