'use strict';

/**
 * A minimal event emitter. We could use node:events but the whole point
 * is zero dependencies and a tiny surface area. This is 30 lines.
 *
 * Used by the crypto modules to report stage/log events to the UI,
 * and by the store to notify screens of state changes.
 */

class Emitter {
  constructor() {
    this._handlers = new Map();  // event name -> Set of callbacks
  }

  on(event, fn) {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set());
    this._handlers.get(event).add(fn);
    return () => this.off(event, fn);  // returns an unsubscribe fn
  }

  off(event, fn) {
    const set = this._handlers.get(event);
    if (!set) return;
    set.delete(fn);
    if (set.size === 0) this._handlers.delete(event);
  }

  once(event, fn) {
    const unsub = this.on(event, (...args) => {
      unsub();
      fn(...args);
    });
    return unsub;
  }

  emit(event, payload) {
    const set = this._handlers.get(event);
    if (!set) return;
    // Copy to a Set-of-listeners snapshot so a listener that adds/removes
    // during emit doesn't cause a re-iteration surprise.
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        // One bad listener shouldn't kill the emitter.
        // We can't log from here without importing UI, so rethrow async.
        queueMicrotask(() => { throw err; });
      }
    }
  }

  removeAll(event) {
    if (event) this._handlers.delete(event);
    else this._handlers.clear();
  }
}

module.exports = { Emitter };