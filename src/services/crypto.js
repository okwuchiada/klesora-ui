/**
 * encryption: small, safe-by-default helpers over Web Crypto (AES-GCM 256, PBKDF2-SHA256).
 *
 *   import { encryption } from 'klesora-ui/services/crypto';
 *   const key = await encryption.generateKey();                  // non-extractable
 *   const box = await encryption.encrypt(key, { pan: '5399…' }, { aad: 'card:1' });
 *   const data = await encryption.decrypt(key, box, { aad: 'card:1' });
 *
 * - Every encrypt uses a fresh random 96-bit IV. AES-GCM authenticates: any change to the
 *   ciphertext, IV or additional data (aad) makes decrypt throw.
 * - Values: anything JSON can hold, or raw bytes (Uint8Array / ArrayBuffer).
 * - deriveKey turns a passphrase into a key with PBKDF2-SHA256, 600,000 iterations by default
 *   (OWASP 2023). A short PIN is still guessable offline; see SECURITY.md.
 * - Exported as `encryption`, not `crypto`, so it never shadows the global `crypto`.
 *
 * Read SECURITY.md before relying on this: client-side encryption protects data at rest in the
 * browser, not against code running on your page.
 */

export const DEFAULT_ITERATIONS = 600_000;
const ALGORITHM = 'A256GCM';

/** Errors carry a `code`: 'decrypt-failed' | 'not-supported' | 'invalid-input'. */
export class EncryptionError extends Error {
  /** @param {string} code @param {string} message @param {unknown} [cause] */
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'EncryptionError';
    this.code = code;
  }
}

function subtle() {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new EncryptionError('not-supported', 'Web Crypto is unavailable (it needs a secure context: https or localhost).');
  return s;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBytes = (data) => (data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null);
/** AES-GCM params. additionalData only when given: Chromium rejects an explicit undefined. */
const gcm = (iv, aad) => {
  const params = { name: 'AES-GCM', iv };
  if (aad !== undefined && aad !== null) params.additionalData = typeof aad === 'string' ? encoder.encode(aad) : toBytes(aad);
  return params;
};

/** Cryptographically random bytes. */
export function randomBytes(length) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return bytes;
}

/** Base64 (standard alphabet) for bytes, for sending or storing envelopes as text. */
export function toBase64(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function fromBase64(text) {
  const binary = atob(text);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * @typedef {object} Envelope
 * @property {1} v format version
 * @property {'A256GCM'} alg
 * @property {'json' | 'bytes'} t how the plaintext is decoded
 * @property {Uint8Array} iv
 * @property {Uint8Array} ct ciphertext + GCM tag
 */

export const encryption = {
  /**
   * A new random AES-GCM 256 key.
   * @param {{ extractable?: boolean }} [options] extractable defaults to false: your code can use the key but never read it
   */
  async generateKey({ extractable = false } = {}) {
    return subtle().generateKey({ name: 'AES-GCM', length: 256 }, extractable, ['encrypt', 'decrypt']);
  },

  /** A random salt for deriveKey (store it next to the data; it isn't secret). */
  randomSalt(length = 16) {
    return randomBytes(length);
  },

  /**
   * Derive a non-extractable AES-GCM key from a passphrase (PBKDF2-SHA256).
   * @param {string} passphrase
   * @param {{ salt: Uint8Array, iterations?: number }} options
   */
  async deriveKey(passphrase, { salt, iterations = DEFAULT_ITERATIONS }) {
    if (typeof passphrase !== 'string' || !passphrase) throw new EncryptionError('invalid-input', 'A non-empty passphrase is required.');
    if (!(salt instanceof Uint8Array) || salt.length < 16) throw new EncryptionError('invalid-input', 'A salt of at least 16 bytes is required.');
    const s = subtle();
    const material = await s.importKey('raw', encoder.encode(passphrase.normalize('NFKC')), 'PBKDF2', false, ['deriveKey']);
    return s.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  },

  /**
   * Encrypt a JSON value or bytes.
   * @param {CryptoKey} key
   * @param {unknown} data
   * @param {{ aad?: string | Uint8Array }} [options] additional authenticated data: not secret, but must match on decrypt
   * @returns {Promise<Envelope>}
   */
  async encrypt(key, data, { aad } = {}) {
    const bytes = toBytes(data);
    const t = bytes ? 'bytes' : 'json';
    let plain = bytes;
    if (!bytes) {
      const json = JSON.stringify(data);
      if (json === undefined) throw new EncryptionError('invalid-input', 'Only JSON values or bytes can be encrypted.');
      plain = encoder.encode(json);
    }
    const iv = randomBytes(12);
    const ct = new Uint8Array(await subtle().encrypt(gcm(iv, aad), key, plain));
    return { v: 1, alg: ALGORITHM, t, iv, ct };
  },

  /**
   * Decrypt an envelope. Throws EncryptionError('decrypt-failed') if the key, aad or data don't match.
   * @param {CryptoKey} key
   * @param {Envelope} envelope
   * @param {{ aad?: string | Uint8Array }} [options]
   */
  async decrypt(key, envelope, { aad } = {}) {
    if (!envelope || envelope.v !== 1 || envelope.alg !== ALGORITHM) throw new EncryptionError('invalid-input', 'Not a Klesora encryption envelope.');
    let plain;
    try {
      plain = new Uint8Array(await subtle().decrypt(gcm(envelope.iv, aad), key, envelope.ct));
    } catch (error) {
      throw new EncryptionError('decrypt-failed', 'Decryption failed: wrong key, wrong aad, or the data was altered.', error);
    }
    return envelope.t === 'bytes' ? plain : JSON.parse(decoder.decode(plain));
  },

  /** Envelope → compact string (base64 parts), e.g. to send to a server. */
  serialize(envelope) {
    return JSON.stringify({ ...envelope, iv: toBase64(envelope.iv), ct: toBase64(envelope.ct) });
  },

  /** String from serialize() → envelope. */
  parse(text) {
    const raw = JSON.parse(text);
    return { ...raw, iv: fromBase64(raw.iv), ct: fromBase64(raw.ct) };
  },
};
