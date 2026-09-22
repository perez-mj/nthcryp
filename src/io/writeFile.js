'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Write a Buffer to disk.
 * Creates parent directories if they don't exist.
 *
 * Returns { path, size }.
 */
async function writeFile(filePath, buffer) {
  if (!Buffer.isBuffer(buffer)) {
    throw new TypeError('writeFile expects a Buffer');
  }

  const abs = path.resolve(filePath);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, buffer);

  return { path: abs, size: buffer.length };
}

module.exports = { writeFile };