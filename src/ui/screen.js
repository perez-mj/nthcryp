'use strict';

const { ansi, styled } = require('./ansi');

/**
 * Screen — a 2D grid of single-character cells, each with an optional style.
 *
 * The whole render pipeline is: build a Screen, mutate it with put/text/box,
 * then call render(screen) once and write the result. This is what keeps the
 * terminal from flickering: one write per frame, not one per cell.
 *
 * Coordinates are 0-based, (row, col). Row 0 is the top.
 */

const BLANK = ' ';

class Screen {
  constructor(cols, rows) {
    this.cols = cols;
    this.rows = rows;
    this.cells = new Array(cols * rows);
    this.clear();
  }

  clear() {
    for (let i = 0; i < this.cells.length; i++) {
      this.cells[i] = { ch: BLANK, style: '' };
    }
  }

  inBounds(row, col) {
    return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
  }

  /**
   * Put one character at (row, col). Out-of-bounds writes are silently
   * dropped — drawing a box that slightly overflows shouldn't crash.
   */
  put(row, col, ch, style = '') {
    if (!this.inBounds(row, col)) return;
    this.cells[row * this.cols + col] = { ch: ch[0] ?? BLANK, style };
  }

  /**
   * Put a whole string at (row, col). Anything past the right edge is
   * truncated, never wrapped. Multi-line strings are the caller's problem.
   */
  text(row, col, str, style = '') {
    for (let i = 0; i < str.length; i++) {
      this.put(row, col + i, str[i], style);
    }
  }

  /**
   * Draw a bordered box with an optional title.
   * The border uses single-line box-drawing characters.
   *
   *   ┌─ TITLE ─────────────┐
   *   │                     │
   *   └─────────────────────┘
   */
  box(row, col, width, height, { title = '', style = '', titleStyle = '' } = {}) {
    if (width < 2 || height < 2) return;

    const top    = row;
    const bottom = row + height - 1;
    const left   = col;
    const right  = col + width - 1;

    // Corners
    this.put(top,    left,  '┌', style);
    this.put(top,    right, '┐', style);
    this.put(bottom, left,  '└', style);
    this.put(bottom, right, '┘', style);

    // Horizontal edges
    for (let c = left + 1; c < right; c++) {
      this.put(top,    c, '─', style);
      this.put(bottom, c, '─', style);
    }

    // Vertical edges
    for (let r = top + 1; r < bottom; r++) {
      this.put(r, left,  '│', style);
      this.put(r, right, '│', style);
    }

    // Optional title, centered-ish starting two cells in
    if (title) {
      const innerWidth = width - 4;               // 1 for │, 1 for space, 1 for space, 1 for │
      const label = title.length > innerWidth
        ? title.slice(0, innerWidth)
        : title;
      this.text(top, left + 2, ` ${label} `, titleStyle || style);
    }
  }

  /**
   * Render the whole screen to a single string with ANSI escapes.
   * One string, one write — that's the frame.
   */
  render() {
    const lines = new Array(this.rows);
    for (let r = 0; r < this.rows; r++) {
      let line = '';
      let currentStyle = '';
      let run = '';
      for (let c = 0; c < this.cols; c++) {
        const cell = this.cells[r * this.cols + c];
        if (cell.style !== currentStyle) {
          if (run) line += currentStyle ? styled(run, currentStyle) : run;
          currentStyle = cell.style;
          run = cell.ch;
        } else {
          run += cell.ch;
        }
      }
      if (run) line += currentStyle ? styled(run, currentStyle) : run;
      lines[r] = line;
    }
    return lines.join('\n');
  }
}

module.exports = { Screen };