'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { listDirectory, filterForPurpose, formatSize } = require('../src/io/filePicker');

async function makeTmpDir() {
  return fs.mkdtemp(path.join(os.tmpdir(), 'nthcryp-picker-'));
}

test('filePicker: returns entries sorted dirs-first, then files', async () => {
  const dir = await makeTmpDir();
  await fs.mkdir(path.join(dir, 'zdir'));
  await fs.mkdir(path.join(dir, 'adir'));
  await fs.writeFile(path.join(dir, 'zfile.txt'), 'z');
  await fs.writeFile(path.join(dir, 'afile.txt'), 'a');

  const entries = await listDirectory(dir);
  const names = entries.map((e) => e.name);

  // First entry is always '..' (parent), then dirs, then files.
  assert.strictEqual(names[0], '..');
  assert.deepStrictEqual(names.slice(1), ['adir', 'zdir', 'afile.txt', 'zfile.txt']);
});

test('filePicker: parent entry is absent at filesystem root', async () => {
  const entries = await listDirectory('/');
  assert.notStrictEqual(entries[0].name, '..');
});

test('filePicker: hidden files are skipped', async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, '.hidden'), 'x');
  await fs.writeFile(path.join(dir, 'visible.txt'), 'x');

  const entries = await listDirectory(dir);
  const names = entries.map((e) => e.name);
  assert.ok(!names.includes('.hidden'));
  assert.ok(names.includes('visible.txt'));
});

test('filePicker: each file entry carries size and ext', async () => {
  const dir = await makeTmpDir();
  await fs.writeFile(path.join(dir, 'doc.PDF'), 'hello');

  const entries = await listDirectory(dir);
  const pdf = entries.find((e) => e.name === 'doc.PDF');
  assert.strictEqual(pdf.size, 5);
  assert.strictEqual(pdf.ext, '.pdf');  // lowercased
  assert.strictEqual(pdf.isDir, false);
});

test('filePicker: throws a clear error on a non-directory path', async () => {
  const dir = await makeTmpDir();
  const file = path.join(dir, 'file.txt');
  await fs.writeFile(file, 'x');
  await assert.rejects(() => listDirectory(file), /Not a directory/);
});

test('filePicker: throws a clear error on a missing directory', async () => {
  await assert.rejects(() => listDirectory('/definitely/not/here'), /Directory not found/);
});

test('filePicker: filterForPurpose keeps dirs + .nth for decrypt', async () => {
  const entries = [
    { name: '..',          isDir: true,  ext: '' },
    { name: 'sub',         isDir: true,  ext: '' },
    { name: 'photo.jpg',   isDir: false, ext: '.jpg' },
    { name: 'secret.nth',  isDir: false, ext: '.nth' },
    { name: 'notes.txt',   isDir: false, ext: '.txt' },
  ];
  const filtered = filterForPurpose(entries, 'decrypt');
  const names = filtered.map((e) => e.name);
  assert.deepStrictEqual(names, ['..', 'sub', 'secret.nth']);
});

test('filePicker: filterForPurpose is a no-op for encrypt', async () => {
  const entries = [
    { name: 'photo.jpg',  isDir: false, ext: '.jpg' },
    { name: 'secret.nth', isDir: false, ext: '.nth' },
  ];
  const filtered = filterForPurpose(entries, 'encrypt');
  assert.strictEqual(filtered.length, 2);
});

test('filePicker: formatSize humanizes bytes', () => {
  assert.strictEqual(formatSize(0), '0 B');
  assert.strictEqual(formatSize(512), '512 B');
  assert.strictEqual(formatSize(2048), '2.0 KB');
  assert.strictEqual(formatSize(3 * 1024 * 1024), '3.0 MB');
});