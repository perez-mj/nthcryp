'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');

/**
 * Read a file from disk as a Buffer.
 * Never assumes text. Never decodes UTF-8 unless asked.
 *
 * Returns { path, name, size, buffer }.
 */
async function readFile(filePath) {
  const abs = path.resolve(filePath);

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch (err) {
    if (err.code === 'ENOENT') throw new Error(`File not found: ${abs}`);
    throw err;
  }

  if (stat.isDirectory()) {
    throw new Error(`Not a file (is a directory): ${abs}`);
  }

  const buffer = await fs.readFile(abs);

  return {
    path: abs,
    name: path.basename(abs),
    size: buffer.length,
    buffer,
  };
}

module.exports = { readFile };