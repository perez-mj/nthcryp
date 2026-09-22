'use strict';

/**
 * The .nth container format.
 *
 * Layout:
 *   MAGIC       "NTHCRYP01"                    9 bytes
 *   ALGO LEN    1 byte (uint8)                 1 byte
 *   ALGO ID     UTF-8 string                   ALGO LEN bytes
 *   META LEN    4 bytes (uint32 big-endian)    4 bytes
 *   META        JSON UTF-8                     META LEN bytes
 *   CIPHERTEXT  raw bytes                      rest of file
 *
 * This is a self-describing container: everything needed to decrypt
 * is inside the file. That is what makes auto-detection possible.
 *
 * WARNING (worth presenting): the key is embedded in META. That is fine
 * for demonstrating mechanics, but NOT how real encryption works. Real
 * systems derive keys from passphrases or use public-key exchange.
 * The registry exposes `requiresPassword` as the seam for that upgrade.
 */

const MAGIC = Buffer.from('NTHCRYP01', 'utf8'); // 9 bytes
const MAGIC_LEN = MAGIC.length;                 // 9
const ALGO_LEN_BYTES = 1;
const META_LEN_BYTES = 4;
const HEADER_MIN = MAGIC_LEN + ALGO_LEN_BYTES + META_LEN_BYTES;

/**
 * Pack a container.
 * @param {string} algorithmId  registry id, e.g. "caesar"
 * @param {object} meta         algorithm metadata, e.g. { shift: 3 }
 * @param {Buffer} ciphertext   raw encrypted bytes
 * @returns {Buffer}
 */
function pack(algorithmId, meta, ciphertext) {
  if (typeof algorithmId !== 'string' || algorithmId.length === 0) {
    throw new TypeError('algorithmId must be a non-empty string');
  }
  if (!Buffer.isBuffer(ciphertext)) {
    throw new TypeError('ciphertext must be a Buffer');
  }

  const algoBuf = Buffer.from(algorithmId, 'utf8');
  if (algoBuf.length > 255) {
    throw new RangeError(`algorithmId too long: ${algoBuf.length} bytes (max 255)`);
  }

  const metaJson = Buffer.from(JSON.stringify(meta ?? {}), 'utf8');

  const header = Buffer.allocUnsafe(
    MAGIC_LEN + ALGO_LEN_BYTES + algoBuf.length + META_LEN_BYTES
  );

  let o = 0;
  MAGIC.copy(header, o);                     o += MAGIC_LEN;
  header.writeUInt8(algoBuf.length, o);      o += ALGO_LEN_BYTES;
  algoBuf.copy(header, o);                   o += algoBuf.length;
  header.writeUInt32BE(metaJson.length, o);  o += META_LEN_BYTES;

  return Buffer.concat([header, metaJson, ciphertext]);
}

/**
 * Unpack a container.
 * @param {Buffer} buf  full file contents
 * @returns {{ algorithmId: string, meta: object, ciphertext: Buffer }}
 * @throws on bad magic, truncated header, malformed metadata
 */
function unpack(buf) {
  if (!Buffer.isBuffer(buf)) {
    throw new TypeError('unpack expects a Buffer');
  }
  if (buf.length < HEADER_MIN) {
    throw new Error(`Not a NTHCRYP file: too short (${buf.length} bytes)`);
  }
  if (!buf.subarray(0, MAGIC_LEN).equals(MAGIC)) {
    throw new Error('Not a NTHCRYP file: bad magic bytes');
  }

  let o = MAGIC_LEN;

  const algoLen = buf.readUInt8(o); o += ALGO_LEN_BYTES;

  if (buf.length < o + algoLen + META_LEN_BYTES) {
    throw new Error('Corrupt NTHCRYP file: truncated algorithm id');
  }
  const algorithmId = buf.subarray(o, o + algoLen).toString('utf8');
  o += algoLen;

  const metaLen = buf.readUInt32BE(o); o += META_LEN_BYTES;

  if (buf.length < o + metaLen) {
    throw new Error('Corrupt NTHCRYP file: truncated metadata');
  }
  const metaBytes = buf.subarray(o, o + metaLen);
  o += metaLen;

  let meta;
  try {
    meta = JSON.parse(metaBytes.toString('utf8'));
  } catch (err) {
    throw new Error(`Corrupt NTHCRYP file: bad metadata JSON (${err.message})`);
  }

  const ciphertext = buf.subarray(o);

  return { algorithmId, meta, ciphertext };
}

/**
 * Cheap check — does this look like a NTHCRYP file?
 * Used by the file picker to gray out non-.nth files before selection.
 */
function isNth(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < MAGIC_LEN) return false;
  return buf.subarray(0, MAGIC_LEN).equals(MAGIC);
}

module.exports = { pack, unpack, isNth, MAGIC };