'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { readFile } = require('../src/io/readFile');
const { writeFile } = require('../src/io/writeFile');
const caesar = require('../src/crypto/caesar');

// Fresh temp dir per test file. Node 18+ has fs.mkdtemp in os.tmpdir.
async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'nthcryp-'));
}

test('io: readFile returns a Buffer and metadata', async () => {
  const dir = await makeTmpDir();
  const file = path.join(dir, 'hello.txt');
  await fs.writeFile(file, 'hello nthcryp');

  const result = await readFile(file);
  assert.ok(Buffer.isBuffer(result.buffer));
  assert.strictEqual(result.name, 'hello.txt');
  assert.strictEqual(result.size, 13);
  assert.strictEqual(result.buffer.toString('utf8'), 'hello nthcryp');
  assert.strictEqual(result.path, file);
});

test('io: readFile throws on missing file', async () => {
  await assert.rejects(
    () => readFile('/definitely/not/here.txt'),
    /File not found/
  );
});

test('io: readFile throws on a directory', async () => {
  const dir = await makeTmpDir();
  await assert.rejects(() => readFile(dir), /is a directory/);
});

test('io: writeFile creates missing parent dirs', async () => {
  const dir = await makeTmpDir();
  const nested = path.join(dir, 'a', 'b', 'c', 'out.bin');
  const payload = Buffer.from([0x01, 0x02, 0x03]);

  const result = await writeFile(nested, payload);
  assert.strictEqual(result.size, 3);

  const onDisk = await fs.readFile(nested);
  assert.deepStrictEqual(onDisk, payload);
});

test('io: writeFile rejects non-Buffer input', async () => {
  const dir = await makeTmpDir();
  await assert.rejects(
    () => writeFile(path.join(dir, 'x.bin'), 'not a buffer'),
    /expects a Buffer/
  );
});

test('io: binary file survives read → write unchanged', async () => {
  const dir = await makeTmpDir();
  const src = path.join(dir, 'fake.png');
  // PNG magic + a null byte + 0xff — bytes that break naive string I/O.
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);

  await fs.writeFile(src, png);
  const { buffer } = await readFile(src);
  assert.deepStrictEqual(buffer, png);

  const dst = path.join(dir, 'copy.png');
  await writeFile(dst, buffer);
  const back = await fs.readFile(dst);
  assert.deepStrictEqual(back, png);
});

test('io + caesar: encrypt a real file on disk and read it back', async () => {
  const dir = await makeTmpDir();
  const src = path.join(dir, 'secret.txt');
  const dst = path.join(dir, 'secret.txt.nth');
  const original = 'the quick brown fox jumps over the lazy dog';

  await fs.writeFile(src, original);

  // Encrypt
  const { buffer } = await readFile(src);
  const { data, meta } = caesar.encrypt(buffer, { shift: 5 });
  await writeFile(dst, data);

  // Decrypt
  const enc = await readFile(dst);
  const { data: back } = caesar.decrypt(enc.buffer, {}, meta);

  assert.strictEqual(back.toString('utf8'), original);
});

test('io + caesar: a binary file survives the roundtrip on disk', async () => {
  const dir = await makeTmpDir();
  const src = path.join(dir, 'image.bin');
  const dst = path.join(dir, 'image.bin.nth');

  // 256 bytes covering the full 0x00–0xff range — the harshest input.
  const original = Buffer.from(Array.from({ length: 256 }, (_, i) => i));
  await fs.writeFile(src, original);

  const { buffer } = await readFile(src);
  const { data, meta } = caesar.encrypt(buffer, { shift: 42 });
  await writeFile(dst, data);

  const enc = await readFile(dst);
  const { data: back } = caesar.decrypt(enc.buffer, {}, meta);

  assert.deepStrictEqual(back, original);
});