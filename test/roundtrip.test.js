'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const registry = require('../src/crypto');

/**
 * For every registered algorithm, encrypt a sample buffer with defaults,
 * decrypt with the returned meta, and assert the bytes match.
 *
 * Adding an algorithm is: one file + one registry line. This test picks
 * it up automatically.
 */

const samples = [
  { name: 'ascii text', bytes: Buffer.from('hello nthcryp world', 'utf8') },
  { name: 'empty',      bytes: Buffer.alloc(0) },
  { name: 'full byte range', bytes: Buffer.from(Array.from({ length: 256 }, (_, i) => i)) },
];

for (const algo of registry.all()) {
  for (const sample of samples) {
    test(`roundtrip: ${algo.id} — ${sample.name}`, () => {
      // Default params. Caesar falls back to shift 3; AES ignores params.
      const { data, meta } = algo.encrypt(sample.bytes, {});
      const { data: back } = algo.decrypt(data, {}, meta);
      assert.deepStrictEqual(back, sample.bytes);
    });
  }
}