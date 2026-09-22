'use strict';

/**
 * Hex helpers for previews and diagnostics.
 * Never used in crypto decisions — only for display.
 */

/**
 * Render a Buffer as a hex preview with ASCII sidebar, like xxd.
 *
 *   hexPreview(buf, 4)
 *   → "4e 54 48 43  NTHC
 *      52 59 50 30  RYP0"
 */
function hexPreview(buf, maxBytes = 16) {
  const slice = buf.subarray(0, maxBytes);
  const lines = [];
  for (let i = 0; i < slice.length; i += 8) {
    const row = slice.subarray(i, i + 8);
    const hex = [...row].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...row]
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
      .join('');
    lines.push({ hex: hex.padEnd(23, ' '), ascii });
  }
  return lines;
}

/**
 * Shorten a hex string for display: "a4f2c1e8b9d3..." → "a4f2…b9d3".
 */
function shortHex(hex, keep = 6) {
  if (hex.length <= keep * 2 + 1) return hex;
  return hex.slice(0, keep) + '…' + hex.slice(-keep);
}

module.exports = { hexPreview, shortHex };