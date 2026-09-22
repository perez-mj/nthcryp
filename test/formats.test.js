'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { pack, unpack, isNth, MAGIC } = require('../src/io/formats');
const { readFile } = require('../src/io/readFile');
const { writeFile } = require('../src/io/writeFile');
const caesar = require('../src/crypto/caesar');

async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'nthcryp-'));
}

test('formats: pack → unpack round-trips algorithm id, meta, ciphertext', () => {
  const ct = Buffer.from([0x01, 0x02, 0x03, 0xfe, 0xff]);
  const packed = pack('caesar', { shift: 7 }, ct);
  const out = unpack(packed);

  assert.strictEqual(out.algorithmId, 'caesar');
  assert.deepStrictEqual(out.meta, { shift: 7 });
  assert.deepStrictEqual(out.ciphertext, ct);
});

test('formats: magic bytes are exactly NTHCRYP01 at offset 0', () => {
  const packed = pack('caesar', {}, Buffer.alloc(0));
  assert.strictEqual(packed.subarray(0, 9).toString('utf8'), 'NTHCRYP01');
  assert.strictEqual(MAGIC.length, 9);
});

test('formats: unpack rejects a non-NTHCRYP buffer', () => {
  const notOurs = Buffer.from('this is just a text file, no magic here');
  assert.throws(() => unpack(notOurs), /bad magic bytes/);
  assert.strictEqual(isNth(notOurs), false);
});

test('formats: unpack rejects a too-short buffer', () => {
  assert.throws(() => unpack(Buffer.from('NTH')), /too short/);
});

test('formats: unpack rejects truncated metadata', () => {
  const full = pack('caesar', { shift: 3 }, Buffer.from('x'));
  // Chop the last few bytes of the metadata + ciphertext.
  const chopped = full.subarray(0, full.length - 4);
  assert.throws(() => unpack(chopped), /truncated metadata/);
});

test('formats: unpack rejects malformed metadata JSON', () => {
  // Hand-build a container with garbage inside the metadata slot.
  const algo = Buffer.from('caesar', 'utf8');
  const junkMeta = Buffer.from('{not json', 'utf8');
  const buf = Buffer.concat([
    MAGIC,
    Buffer.from([algo.length]),
    algo,
    (() => { const b = Buffer.alloc(4); b.writeUInt32BE(junkMeta.length); return b; })(),
    junkMeta,
    Buffer.from([0x00]),
  ]);
  assert.throws(() => unpack(buf), /bad metadata JSON/);
});

test('formats: empty ciphertext is valid', () => {
  const packed = pack('caesar', { shift: 1 }, Buffer.alloc(0));
  const out = unpack(packed);
  assert.strictEqual(out.ciphertext.length, 0);
});

test('formats: isNth is cheap and correct', () => {
  const packed = pack('caesar', {}, Buffer.from('hi'));
  assert.strictEqual(isNth(packed), true);
  assert.strictEqual(isNth(Buffer.from('NTH')), false);
  assert.strictEqual(isNth(null), false);
});

test('formats: rejects an oversized algorithm id', () => {
  const huge = 'x'.repeat(300);
  assert.throws(() => pack(huge, {}, Buffer.alloc(0)), /too long/);
});

test('formats + caesar: full pipeline on disk with auto-detect', async () => {
  const dir = await makeTmpDir();
  const src = path.join(dir, 'secret.txt');
  const dst = path.join(dir, 'secret.txt.nth');
  const original = 'auto-detect me, please';

  await fs.writeFile(src, original);

  // --- Encrypt ---
  const plain = await readFile(src);
  const algoIn = caesar;
  const { data: ct, meta } = algoIn.encrypt(plain.buffer, { shift: 11 });
  const packed = pack(algoIn.id, meta, ct);
  await writeFile(dst, packed);

  // --- Decrypt: no algorithm chosen, no shift chosen ---
  const onDisk = await readFile(dst);
  assert.strictEqual(isNth(onDisk.buffer), true);

  const { algorithmId, meta: readMeta, ciphertext } = unpack(onDisk.buffer);
  assert.strictEqual(algorithmId, 'caesar');
  assert.strictEqual(readMeta.shift, 11);

  // Look up the algorithm from the header alone.
  const registry = require('../src/crypto');
  const algoOut = registry.get(algorithmId);
  const { data: back } = algoOut.decrypt(ciphertext, {}, readMeta);

  assert.strictEqual(back.toString('utf8'), original);
});

test('formats + aes-gcm: on-disk auto-detect, no algorithm chosen', async () => {
  const dir = await makeTmpDir();
  const src = path.join(dir, 'photo.bin');
  const dst = path.join(dir, 'photo.bin.nth');

  const original = Buffer.from(Array.from({ length: 512 }, (_, i) => (i * 7) & 0xff));
  await fs.writeFile(src, original);

  const aes = require('../src/crypto/aes-gcm');
  const registry = require('../src/crypto');

  // Encrypt with AES, wrap in .nth.
  const { buffer } = await readFile(src);
  const { data, meta } = aes.encrypt(buffer, {});
  await writeFile(dst, pack(aes.id, meta, data));

  // Decrypt knowing nothing but the file.
  const onDisk = await readFile(dst);
  const { algorithmId, meta: readMeta, ciphertext } = unpack(onDisk.buffer);

  assert.strictEqual(algorithmId, 'aes-256-gcm');
  assert.ok(readMeta.key);
  assert.ok(readMeta.nonce);
  assert.ok(readMeta.tag);

  const algo = registry.get(algorithmId);
  const { data: back } = algo.decrypt(ciphertext, {}, readMeta);
  assert.deepStrictEqual(back, original);
});