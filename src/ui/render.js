'use strict';

const { ansi } = require('./ansi');

/**
 * The frame writer. One function, one write.
 *
 * - Hides the cursor while rendering (no flicker)
 * - HOMEs to top-left instead of clearing (no flash on every frame)
 * - Writes the whole frame as one string to stdout
 *
 * Usage:
 *   const screen = new Screen(80, 24);
 *   screen.text(0, 0, 'hello');
 *   renderer.draw(screen);
 */

class Renderer {
  constructor(out = process.stdout) {
    this.out = out;
    this.started = false;
  }

  start() {
    if (this.started) return;
    this.out.write(ansi.hideCursor);
    this.started = true;
  }

  stop() {
    if (!this.started) return;
    this.out.write(ansi.showCursor);
    this.started = false;
  }

  /**
   * Draw a screen. Frame = HOME + screen string.
   *
   * We don't clear the terminal each frame — we overwrite in place.
   * Cells we didn't touch keep their previous content, so we either
   * rebuild the screen from scratch each frame or accept ghosting.
   * Our screens will rebuild from scratch every frame; that's cheap.
   */
  draw(screen) {
    const frame = ansi.home + screen.render();
    this.out.write(frame);
  }
}

module.exports = { Renderer };