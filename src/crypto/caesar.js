'use strict';

/**
 * Caesar cipher — the trivial end of the NTHCRYP spectrum.
 *
 * Contract (must match every other algorithm in the registry):
 *   name             string   human-readable label
 *   id               string   registry key
 *   options          array    user-supplied params (each { key, label, type, default })
 *   generatesKey     bool     does it create its own key?
 *   requiresPassword bool     does it need a passphrase?
 *   stages           string[] stage names this module emits during encrypt
 *   decryptStages    string[] stage names this module emits during decrypt
 *                             (optional; falls back to `stages`)
 *   encrypt(input, params, emit?) -> { data: Buffer, meta: object }
 *   decrypt(input, params, meta, emit?) -> { data: Buffer }
 *
 * Buffer-in, Buffer-out. Never strings. This is why the same cipher can
 * encrypt a text file or a .png without changing a line.
 *
 * Note: neither `stages` nor `decryptStages` includes "Write output".
 * Writing is done by the pipeline screen, which adds that row itself.
 * A module's stage list is a promise about what the module will emit.
 */

const DEFAULT_SHIFT = 3;

function normalizeShift(shift) {
  // Any integer works; mod 256 keeps the math tidy for byte-level shifting.
  const n = Number.isInteger(shift) ? shift : DEFAULT_SHIFT;
  return ((n % 256) + 256) % 256;
}

function shiftBuffer(input, shift) {
  const out = Buffer.allocUnsafe(input.length);
  for (let i = 0; i < input.length; i++) {
    out[i] = (input[i] + shift) & 0xff;
  }
  return out;
}

module.exports = {
  name: 'Caesar',
  id: 'caesar',

  options: [
    {
      key: 'shift',
      label: 'Shift amount',
      type: 'number',
      default: DEFAULT_SHIFT,
    },
  ],

  generatesKey: false,
  requiresPassword: false,

  // Encrypt and decrypt both just "Apply shift". Same name, same row.
  stages: ['Apply shift'],
  decryptStages: ['Apply shift'],

  encrypt(input, params = {}, emit = null) {
    const shift = normalizeShift(params.shift);
    const stage = (status) =>
      emit && emit({ type: 'stage', name: 'Apply shift', status });

    stage('running');
    const data = shiftBuffer(input, shift);
    stage('done');

    return { data, meta: { shift } };
  },

  decrypt(input, params = {}, meta = {}, emit = null) {
    // Trust meta over params — the file knows how it was encrypted.
    const shift = normalizeShift(meta.shift ?? params.shift);
    const stage = (status) =>
      emit && emit({ type: 'stage', name: 'Apply shift', status });

    stage('running');
    const data = shiftBuffer(input, (256 - shift) % 256);
    stage('done');

    return { data };
  },
};