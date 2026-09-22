'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const caesar = require('../src/crypto/caesar');

test('caesar: known answer, shift 1', () => {
  const input = Buffer.from('abc', 'utf8');
  const { data, meta } = caesar.encrypt(input, { shift: 1 });
  assert.strictEqual(data.toString('utf8'), 'bcd');
  assert.strictEqual(meta.shift, 1);
});

test('caesar: roundtrip, shift 3', () => {
  const input = Buffer.from('hello nthcryp world', 'utf8');
  const { data, meta } = caesar.encrypt(input, { shift: 3 });
  const { data: back } = caesar.decrypt(data, {}, meta);
  assert.deepStrictEqual(back, input);
});

test('caesar: byte wrap-around at 0xff', () => {
  const input = Buffer.from([0xff, 0xfe, 0x00, 0x01]);
  const { data, meta } = caesar.encrypt(input, { shift: 3 });
  assert.deepStrictEqual([...data], [0x02, 0x01, 0x03, 0x04]);
  const { data: back } = caesar.decrypt(data, {}, meta);
  assert.deepStrictEqual(back, input);
});

test('caesar: binary buffer passthrough (not text)', () => {
  const input = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0xff]);
  const { data, meta } = caesar.encrypt(input, { shift: 5 });
  const { data: back } = caesar.decrypt(data, {}, meta);
  assert.deepStrictEqual(back, input);
});

test('caesar: default shift is 3 when none given', () => {
  const input = Buffer.from('abc', 'utf8');
  const { meta } = caesar.encrypt(input, {});
  assert.strictEqual(meta.shift, 3);
});

test('caesar: decrypt trusts meta over params', () => {
  const input = Buffer.from('hello', 'utf8');
  const { data, meta } = caesar.encrypt(input, { shift: 7 });
  // Pass a wrong shift in params; meta should win.
  const { data: back } = caesar.decrypt(data, { shift: 1 }, meta);
  assert.deepStrictEqual(back, input);
});

test('caesar: negative shift normalizes', () => {
  const input = Buffer.from('abc', 'utf8');
  const { data, meta } = caesar.encrypt(input, { shift: -1 });
  // -1 mod 256 === 255, so 'a' -> 0x60 (backtick), 'b' -> 0x61, etc.
  assert.strictEqual(meta.shift, 255);
  const { data: back } = caesar.decrypt(data, {}, meta);
  assert.deepStrictEqual(back, input);
});