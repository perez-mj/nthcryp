'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Directory listing for the file picker. No UI, no state, just data.
 *
 * Returns an array of entries, sorted:
 *   1. `..` parent entry, always first (unless at filesystem root)
 *   2. directories, alphabetical (case-insensitive)
 *   3. files, alphabetical (case-insensitive)
 *
 * Each entry: { name, path, isDir, size, ext }
 */

async function listDirectory(dirPath) {
  const abs = path.resolve(dirPath);

  let dirents;
  try {
    dirents = await fs.readdir(abs, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'EACCES') throw new Error(`Permission denied: ${abs}`);
    if (err.code === 'ENOENT') throw new Error(`Directory not found: ${abs}`);
    if (err.code === 'ENOTDIR') throw new Error(`Not a directory: ${abs}`);
    throw err;
  }

  const dirs = [];
  const files = [];

  for (const d of dirents) {
    // Skip hidden files by default. If the user wants them, we add a
    // toggle in a later pass.
    if (d.name.startsWith('.')) continue;

    const entryPath = path.join(abs, d.name);

    if (d.isDirectory()) {
      dirs.push({ name: d.name, path: entryPath, isDir: true, size: 0, ext: '' });
    } else if (d.isFile()) {
      let size = 0;
      try {
        const stat = await fs.stat(entryPath);
        size = stat.size;
      } catch {
        // If we can't stat, show 0 — don't crash the whole listing.
      }
      files.push({
        name: d.name,
        path: entryPath,
        isDir: false,
        size,
        ext: path.extname(d.name).toLowerCase(),
      });
    }
    // Skip symlinks and special files for v0.1. Simplest correct behavior.
  }

  const cmp = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  dirs.sort(cmp);
  files.sort(cmp);

  const entries = [];

  // Parent entry — unless we're at the filesystem root.
  const parent = path.dirname(abs);
  if (parent !== abs) {
    entries.push({
      name: '..',
      path: parent,
      isDir: true,
      size: 0,
      ext: '',
    });
  }

  return entries.concat(dirs, files);
}

/**
 * For decrypt mode, we only care about `.nth` files. This filters the
 * entries list to directories + `.nth` files. Directories stay so you can
 * navigate into them.
 */
function filterForPurpose(entries, purpose) {
  if (purpose !== 'decrypt') return entries;
  return entries.filter((e) => e.isDir || e.ext === '.nth');
}

/**
 * Human-readable file size. Small enough to inline; no dependency.
 */
function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

module.exports = { listDirectory, filterForPurpose, formatSize };