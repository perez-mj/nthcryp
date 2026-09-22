'use strict';

/**
 * Algorithm registry.
 *
 * Every cipher exposes the same interface (see caesar.js header).
 * Adding a new one is: require it, then registry.set(id, module).
 * The UI never branches on algorithm id — it reads the contract.
 */

const registry = new Map();

registry.set('caesar', require('./caesar'));
registry.set('aes-256-gcm', require('./aes-gcm')); 

module.exports = {
  get(id) {
    const algo = registry.get(id);
    if (!algo) throw new Error(`Unknown algorithm: ${id}`);
    return algo;
  },
  all() {
    return [...registry.values()];
  },
  has(id) {
    return registry.has(id);
  },
};