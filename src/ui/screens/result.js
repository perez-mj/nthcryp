'use strict';

const { KEYS } = require('../../state/input');
const { drawBox } = require('../components/box');
const { drawErrorBanner } = require('../components/errorBanner');
const { ansi } = require('../ansi');
const { hexPreview, shortHex } = require('../../util/hex');
const { formatSize } = require('../../io/filePicker');
const registry = require('../../crypto');

/**
 * Result screen. Shows what just happened — output path, size, and the
 * metadata that makes the file self-describing (key / nonce / tag for AES,
 * shift for Caesar).
 *
 * Also renders failures. state.result.ok === false → red box, error text.
 *
 * The hex preview at the bottom is drawn from state.fileBuffer for
 * encryption, and from the decrypted output for decryption. For decrypt
 * the buffer is what was just written; for encrypt it's the *plaintext*
 * (the ciphertext is on disk, uninteresting to preview here — hex of
 * ciphertext looks like noise).
 */

function handleKey(key, ch, state) {
  switch (key) {
    case KEYS.ENTER:
    case KEYS.ESCAPE:
      return { type: 'transition', name: 'resultBack' };
    default:
      return null;
  }
}

function render(screen, state, { cols, rows }) {
  const result = state.result;

  if (!result || !result.ok) {
    renderFailure(screen, state, { cols, rows });
    return;
  }

  const algo = registry.get(result.algorithm);
  const boxW = Math.min(76, cols - 4);
  const boxH = Math.min(rows - 2, 22);
  const r0 = Math.max(1, Math.floor((rows - boxH) / 2));
  const c0 = Math.max(1, Math.floor((cols - boxW) / 2));

  const titleVerb = result.mode === 'decrypt' ? 'DECRYPTED' : 'ENCRYPTED';
  const inner = drawBox(screen, r0, c0, boxW, boxH, {
    title: `${titleVerb} — ${algo.name}`,
    style: ansi.green,
    titleStyle: ansi.green + ansi.bold,
  });

  let row = inner.row;

  // Output path
  const outName = result.outputPath;
  screen.text(row++, inner.col, '✓ done', ansi.green + ansi.bold);
  row++;
  screen.text(row++, inner.col, 'output:', ansi.gray);
  screen.text(row++, inner.col + 2, shortenPath(outName, inner.width - 2), ansi.white);
  row++;

  // Sizes
  screen.text(row++, inner.col, `size:  ${formatSize(result.size)} (${result.size} bytes)`, ansi.white);
  if (result.ciphertextSize != null) {
    screen.text(row++, inner.col, `plaintext size: ${result.ciphertextSize} bytes`, ansi.gray);
  }
  row++;

  // Metadata block — different per algorithm
  screen.text(row++, inner.col, 'metadata:', ansi.gray);
  const metaRows = metadataLines(result.algorithm, result.meta, inner.width - 2);
  for (const line of metaRows) {
    screen.text(row++, inner.col + 2, line, ansi.gray);
  }
  row++;

  // Hex preview
  const previewLabel = result.mode === 'decrypt' ? 'preview (decrypted):' : 'preview (plaintext):';
  screen.text(row++, inner.col, previewLabel, ansi.gray);
  const previewBuf = state.fileBuffer;
  if (previewBuf && previewBuf.length > 0) {
    const lines = hexPreview(previewBuf, 16);
    for (const line of lines) {
      screen.text(row, inner.col + 2, line.hex, ansi.white);
      screen.text(row, inner.col + 2 + line.hex.length + 2, line.ascii, ansi.gray);
      row++;
    }
  } else {
    screen.text(row++, inner.col + 2, '(empty file)', ansi.gray);
  }

  // Footer
  screen.text(r0 + boxH - 2, c0 + 2, 'Enter/Esc return to menu', ansi.gray);

  drawErrorBanner(screen, state, { cols, rows });
}

function renderFailure(screen, state, { cols, rows }) {
  const boxW = Math.min(72, cols - 4);
  const boxH = 10;
  const r0 = Math.max(1, Math.floor((rows - boxH) / 2));
  const c0 = Math.max(1, Math.floor((cols - boxW) / 2));

  const inner = drawBox(screen, r0, c0, boxW, boxH, {
    title: 'FAILED',
    style: ansi.red,
    titleStyle: ansi.red + ansi.bold,
  });

  const err = (state.result && state.result.error) || state.error || 'Unknown error.';
  screen.text(inner.row + 1, inner.col, '✗ operation failed', ansi.red + ansi.bold);
  screen.text(inner.row + 3, inner.col, truncate(err, inner.width), ansi.white);

  screen.text(r0 + boxH - 2, c0 + 2, 'Enter/Esc return to menu', ansi.gray);

  drawErrorBanner(screen, state, { cols, rows });
}

/**
 * Algorithm-specific metadata lines. Falls through to a generic renderer
 * for anything we don't specifically handle, so adding an algorithm
 * doesn't require touching this file.
 */
function metadataLines(algorithmId, meta, width) {
  if (!meta) return ['(none)'];

  if (algorithmId === 'caesar') {
    return [`shift: ${meta.shift}`];
  }

  if (algorithmId === 'aes-256-gcm') {
    return [
      `key:   ${shortHex(meta.key, 8)}   (${meta.key.length / 2} bytes)`,
      `nonce: ${shortHex(meta.nonce, 8)} (${meta.nonce.length / 2} bytes)`,
      `tag:   ${shortHex(meta.tag, 8)}   (${meta.tag.length / 2} bytes)`,
    ];
  }

  // Generic fallback — dump the JSON, one key per line.
  return Object.entries(meta).map(([k, v]) => {
    const s = typeof v === 'string' ? shortHex(v, 8) : JSON.stringify(v);
    return `${k}: ${truncate(s, width - k.length - 3)}`;
  });
}

function shortenPath(p, width) {
  if (p.length <= width) return p;
  return '…' + p.slice(p.length - (width - 1));
}

function truncate(s, width) {
  if (s.length <= width) return s;
  return s.slice(0, width - 1) + '…';
}

module.exports = { render, handleKey };