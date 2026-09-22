'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const aes = require('../src/crypto/aes-gcm');

test('aes-gcm: roundtrip a text buffer', () => {
  const input = Buffer.from('hello nthcryp world', 'utf8');
  const { data, meta } = aes.encrypt(input);
  assert.notDeepStrictEqual(data, input);
  const { data: back } = aes.decrypt(data, {}, meta);
  assert.deepStrictEqual(back, input);
});

test('aes-gcm: roundtrip a binary buffer (all 256 byte values)', () => {
  const input = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
  const { data, meta } = aes.encrypt(input);
  const { data: back } = aes.decrypt(data, {}, meta);
  assert.deepStrictEqual(back, input);
});

test('aes-gcm: meta contains key, nonce, tag — all correct lengths', () => {
  const { meta } = aes.encrypt(Buffer.from('x'));
  assert.strictEqual(typeof meta.key, 'string');
  assert.strictEqual(typeof meta.nonce, 'string');
  assert.strictEqual(typeof meta.tag, 'string');
  assert.strictEqual(Buffer.from(meta.key, 'hex').length, 32);
  assert.strictEqual(Buffer.from(meta.nonce, 'hex').length, 12);
  assert.strictEqual(Buffer.from(meta.tag, 'hex').length, 16);
});

test('aes-gcm: two encrypts of the same input produce different ciphertext', () => {
  const input = Buffer.from('same plaintext every time');
  const a = aes.encrypt(input);
  const b = aes.encrypt(input);
  // Fresh key + fresh nonce every call.
  assert.notDeepStrictEqual(a.data, b.data);
  assert.notStrictEqual(a.meta.key, b.meta.key);
  assert.notStrictEqual(a.meta.nonce, b.meta.nonce);
});

test('aes-gcm: tampering with the ciphertext makes decrypt throw', () => {
  const input = Buffer.from('do not touch');
  const { data, meta } = aes.encrypt(input);
  // Flip one bit in the middle of the ciphertext.
  const tampered = Buffer.from(data);
  tampered[Math.floor(tampered.length / 2)] ^= 0x01;

  assert.throws(() => aes.decrypt(tampered, {}, meta), /authentication failed/);
});

test('aes-gcm: tampering with the tag makes decrypt throw', () => {
  const input = Buffer.from('do not touch');
  const { data, meta } = aes.encrypt(input);
  const badMeta = { ...meta, tag: '00'.repeat(16) };
  assert.throws(() => aes.decrypt(data, {}, badMeta), /authentication failed/);
});

test('aes-gcm: missing meta fields throws a clear error', () => {
  assert.throws(() => aes.decrypt(Buffer.from('x'), {}, {}), /missing key, nonce, or tag/);
});

test('aes-gcm: empty input round-trips', () => {
  const { data, meta } = aes.encrypt(Buffer.alloc(0));
  const { data: back } = aes.decrypt(data, {}, meta);
  assert.strictEqual(back.length, 0);
});