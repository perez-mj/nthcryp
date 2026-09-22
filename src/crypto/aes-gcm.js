'use strict';

const crypto = require('node:crypto');

/**
 * AES-256-GCM — authenticated encryption.
 *
 * Unlike Caesar, this cipher:
 *   - generates its own key (32 bytes) and nonce (12 bytes)
 *   - produces an auth tag (16 bytes) that detects tampering
 *   - will throw on decrypt if a single ciphertext byte was flipped
 *
 * Same contract as caesar.js. Buffer-in, Buffer-out. meta is richer.
 *
 * GCM nonce reuse is catastrophic — the nonce must be unique per key.
 * We generate a fresh one on every encrypt. In a real system you'd also
 * rotate keys; here the key lives only in the .nth metadata.
 */

const KEY_LEN = 32;    // AES-256
const NONCE_LEN = 12;  // 96 bits — the GCM-recommended size
const TAG_LEN = 16;    // 128 bits

const encryptStages = ['Generate key', 'Generate nonce', 'Encrypt', 'Auth tag'];
const decryptStages = ['Parse metadata', 'Derive key', 'Decrypt', 'Verify auth tag'];

module.exports = {
  name: 'AES-256-GCM',
  id: 'aes-256-gcm',

  options: [],
  generatesKey: true,
  requiresPassword: false,

  stages: encryptStages,
  decryptStages,

  encrypt(input, _params = {}, emit = null) {
    const stage = (name, status) => emit && emit({ type: 'stage', name, status });
    const log = (message) => emit && emit({ type: 'log', message });

    stage('Generate key', 'running');
    const key = crypto.randomBytes(KEY_LEN);
    log(`key generated: ${KEY_LEN} bytes`);
    stage('Generate key', 'done');

    stage('Generate nonce', 'running');
    const nonce = crypto.randomBytes(NONCE_LEN);
    log(`nonce generated: ${nonce.toString('hex')}`);
    stage('Generate nonce', 'done');

    stage('Encrypt', 'running');
    const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
    const data = Buffer.concat([cipher.update(input), cipher.final()]);
    stage('Encrypt', 'done');

    stage('Auth tag', 'running');
    const tag = cipher.getAuthTag();
    stage('Auth tag', 'done');

    return {
      data,
      meta: {
        key: key.toString('hex'),
        nonce: nonce.toString('hex'),
        tag: tag.toString('hex'),
      },
    };
  },

  decrypt(input, _params = {}, meta = {}, emit = null) {
    const stage = (name, status) => emit && emit({ type: 'stage', name, status });
    const log = (message) => emit && emit({ type: 'log', message });

    stage('Parse metadata', 'running');
    if (!meta.key || !meta.nonce || !meta.tag) {
      throw new Error('AES-256-GCM: missing key, nonce, or tag in metadata');
    }
    stage('Parse metadata', 'done');

    stage('Derive key', 'running');
    const key = Buffer.from(meta.key, 'hex');
    const nonce = Buffer.from(meta.nonce, 'hex');
    const tag = Buffer.from(meta.tag, 'hex');
    if (key.length !== KEY_LEN) throw new Error(`AES-256-GCM: bad key length (${key.length})`);
    if (nonce.length !== NONCE_LEN) throw new Error(`AES-256-GCM: bad nonce length (${nonce.length})`);
    if (tag.length !== TAG_LEN) throw new Error(`AES-256-GCM: bad tag length (${tag.length})`);
    log(`key derived: ${key.length} bytes`);
    stage('Derive key', 'done');

    stage('Decrypt', 'running');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
    decipher.setAuthTag(tag);
    let data;
    try {
      data = Buffer.concat([decipher.update(input), decipher.final()]);
    } catch (err) {
      throw new Error('AES-256-GCM: authentication failed (wrong key or tampered ciphertext)');
    }
    stage('Decrypt', 'done');

    stage('Verify auth tag', 'running');
    // The auth tag is verified by decipher.final() above; if we got here, it passed.
    log('auth tag verified');
    stage('Verify auth tag', 'done');

    return { data };
  },
};