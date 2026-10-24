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
export declare const DEFAULT_ITERATIONS = 600000;
/** Errors carry a `code`: 'decrypt-failed' | 'not-supported' | 'invalid-input'. */
export declare class EncryptionError extends Error {
    code: string;
    /** @param {string} code @param {string} message @param {unknown} [cause] */
    constructor(code: string, message: string, cause?: unknown);
}
/** Cryptographically random bytes. */
export declare function randomBytes(length: any): Uint8Array<any>;
/** Base64 (standard alphabet) for bytes, for sending or storing envelopes as text. */
export declare function toBase64(bytes: any): string;
export declare function fromBase64(text: any): Uint8Array<ArrayBuffer>;
export type Envelope = {
    /**
     * format version
     */
    v: 1;
    alg: 'A256GCM';
    /**
     * how the plaintext is decoded
     */
    t: 'json' | 'bytes';
    iv: Uint8Array;
    /**
     * ciphertext + GCM tag
     */
    ct: Uint8Array;
};
/**
 * @typedef {object} Envelope
 * @property {1} v format version
 * @property {'A256GCM'} alg
 * @property {'json' | 'bytes'} t how the plaintext is decoded
 * @property {Uint8Array} iv
 * @property {Uint8Array} ct ciphertext + GCM tag
 */
export declare const encryption: {
    /**
     * A new random AES-GCM 256 key.
     * @param {{ extractable?: boolean }} [options] extractable defaults to false: your code can use the key but never read it
     */
    generateKey({ extractable }?: {
        extractable?: boolean;
    }): Promise<CryptoKey>;
    /** A random salt for deriveKey (store it next to the data; it isn't secret). */
    randomSalt(length?: number): Uint8Array<any>;
    /**
     * Derive a non-extractable AES-GCM key from a passphrase (PBKDF2-SHA256).
     * @param {string} passphrase
     * @param {{ salt: Uint8Array, iterations?: number }} options
     */
    deriveKey(passphrase: string, { salt, iterations }: {
        salt: Uint8Array;
        iterations?: number;
    }): Promise<CryptoKey>;
    /**
     * Encrypt a JSON value or bytes.
     * @param {CryptoKey} key
     * @param {unknown} data
     * @param {{ aad?: string | Uint8Array }} [options] additional authenticated data: not secret, but must match on decrypt
     * @returns {Promise<Envelope>}
     */
    encrypt(key: CryptoKey, data: unknown, { aad }?: {
        aad?: string | Uint8Array;
    }): Promise<Envelope>;
    /**
     * Decrypt an envelope. Throws EncryptionError('decrypt-failed') if the key, aad or data don't match.
     * @param {CryptoKey} key
     * @param {Envelope} envelope
     * @param {{ aad?: string | Uint8Array }} [options]
     */
    decrypt(key: CryptoKey, envelope: Envelope, { aad }?: {
        aad?: string | Uint8Array;
    }): Promise<any>;
    /** Envelope → compact string (base64 parts), e.g. to send to a server. */
    serialize(envelope: any): string;
    /** String from serialize() → envelope. */
    parse(text: any): any;
};
