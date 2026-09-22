'use strict';

const { Emitter } = require('../util/events');

/**
 * Raw-mode keyboard input → named key events.
 *
 * In raw mode, the terminal delivers keystrokes byte by byte. Arrow keys
 * arrive as 3-byte escape sequences: \x1b[A (up), \x1b[B (down),
 * \x1b[C (right), \x1b[D (left). Enter is \r or \n. Ctrl-C is \x03.
 *
 * This module does the decoding and emits clean names:
 *   'up', 'down', 'left', 'right', 'enter', 'escape', 'backspace',
 *   'ctrl-c', 'char' (with the literal character)
 *
 * It also attaches a hard cleanup to process exit so the terminal is
 * restored even if the app crashes.
 */

const KEYS = {
  UP:        'up',
  DOWN:      'down',
  RIGHT:     'right',
  LEFT:      'left',
  ENTER:     'enter',
  ESCAPE:    'escape',
  BACKSPACE: 'backspace',
  TAB:       'tab',
  CTRL_C:    'ctrl-c',
  CHAR:      'char',
};

class Input extends Emitter {
  constructor(stdin = process.stdin) {
    super();
    this.stdin = stdin;
    this.raw = false;
    this._buffer = '';              // pending escape-sequence bytes
    this._boundData = this._onData.bind(this);
    this._cleanupInstalled = false;
  }

  start() {
    if (this.raw) return;

    if (!this.stdin.isTTY) {
      throw new Error('Input requires a TTY (stdin is not a terminal)');
    }

    this.stdin.setRawMode(true);
    this.stdin.resume();
    this.stdin.setEncoding('utf8');
    this.stdin.on('data', this._boundData);
    this.raw = true;

    if (!this._cleanupInstalled) {
      this._installCleanup();
      this._cleanupInstalled = true;
    }
  }

  stop() {
    if (!this.raw) return;
    this.stdin.removeListener('data', this._boundData);
    this.stdin.setRawMode(false);
    this.stdin.pause();
    this.raw = false;
  }

  /**
   * Guarantee the terminal is restored on any exit path — normal quit,
   * thrown exception, or SIGINT/SIGTERM. Registered once, never removed.
   * The bound function is idempotent.
   */
  _installCleanup() {
    const restore = () => {
      try {
        if (this.stdin.isTTY && this.stdin.isRaw) {
          this.stdin.setRawMode(false);
        }
      } catch {
        // Nothing to do — stdin may already be closed.
      }
      // Show the cursor. If we never hid it, this is a no-op visually.
      process.stdout.write('\x1b[?25h');
    };

    process.on('exit', restore);
    process.on('SIGTERM', () => { restore(); process.exit(0); });
    // SIGINT is handled here so Ctrl-C is delivered as a 'ctrl-c' event
    // first, and the app can shut down gracefully. If nothing listens,
    // we still exit cleanly.
    process.on('SIGINT', () => {
      this.emit(KEYS.CTRL_C);
      // Give listeners a chance to react; if they don't exit, we do.
      setImmediate(() => {
        if (this.raw) {
          restore();
          process.exit(0);
        }
      });
    });
  }

  _onData(chunk) {
    this._buffer += chunk;

    // Escape sequences: start with \x1b. Match the known 3-byte ones.
    // Anything we don't recognize is treated as a bare Escape.
    while (this._buffer.length > 0) {
      const first = this._buffer[0];

      // \x1b[A/B/C/D — arrow keys
      if (first === '\x1b' && this._buffer.length >= 3 && this._buffer[1] === '[') {
        const c = this._buffer[2];
        const map = { A: KEYS.UP, B: KEYS.DOWN, C: KEYS.RIGHT, D: KEYS.LEFT };
        if (map[c]) {
          this._buffer = this._buffer.slice(3);
          this.emit(map[c]);
          continue;
        }
        // Unknown escape sequence — swallow ESC + '[' and let the next
        // char fall through as a normal character.
        this._buffer = this._buffer.slice(2);
        continue;
      }

      // Lone ESC — only treat as Escape if nothing follows. Terminals
      // send lone ESC on its own, but a burst of data could arrive with
      // more bytes. We wait for the next chunk if we're at end-of-buffer.
      if (first === '\x1b' && this._buffer.length === 1) {
        // Delay one tick to see if more bytes arrive.
        setTimeout(() => {
          if (this._buffer === '\x1b') {
            this._buffer = '';
            this.emit(KEYS.ESCAPE);
          }
        }, 10);
        return;
      }

      // Normalize CR/LF to a single 'enter'
      if (first === '\r' || first === '\n') {
        this._buffer = this._buffer.slice(1);
        this.emit(KEYS.ENTER);
        continue;
      }

      // Backspace: \x7f on most Unix terminals, \b occasionally.
      if (first === '\x7f' || first === '\b') {
        this._buffer = this._buffer.slice(1);
        this.emit(KEYS.BACKSPACE);
        continue;
      }

      // Tab
      if (first === '\t') {
        this._buffer = this._buffer.slice(1);
        this.emit(KEYS.TAB);
        continue;
      }

      // Ctrl-C as a raw byte (only fires if SIGINT is somehow not caught,
      // which shouldn't happen, but belt-and-braces)
      if (first === '\x03') {
        this._buffer = this._buffer.slice(1);
        this.emit(KEYS.CTRL_C);
        continue;
      }

      // Anything else: a printable character.
      this._buffer = this._buffer.slice(1);
      this.emit(KEYS.CHAR, first);
    }
  }
}

module.exports = { Input, KEYS };