/**
 * secureStorage: an encrypted key-value store in IndexedDB.
 *
 *   import { secureStorage } from 'klesora-ui/services/secure-storage';
 *
 *   // Device key (default): a non-extractable AES key kept by the browser. No user input.
 *   const prefs = await secureStorage.open('prefs');
 *   await prefs.set('lastAccount', '0123456789');
 *
 *   // Passphrase / PIN: the key is derived from what the user types and kept only in memory.
 *   const wallet = await secureStorage.open('wallet', { passphrase: pin, autoLock: 5 });
 *   await wallet.set('cards', [{ last4: '4242' }]);
 *   wallet.locked;                 // true after 5 idle minutes (or on tab hide with lockOnHide)
 *   await wallet.unlock(pin);
 *
 * - Values: anything JSON can hold, or bytes. Each value is AES-GCM encrypted with a fresh IV.
 *   The store and key names are bound as authenticated data, so a ciphertext copied to another
 *   key or store fails to decrypt (code 'corrupt') instead of being silently accepted.
 * - Errors are SecureStorageError with a `code`: 'wrong-passphrase', 'locked', 'mode-mismatch',
 *   'corrupt', 'not-supported'.
 * - Key names and the number of entries are not encrypted (only values are).
 *
 * Read SECURITY.md: this protects data at rest in the browser, not against code on your page.
 */
import { encryption, DEFAULT_ITERATIONS } from './crypto.js';

const DB_NAME = 'klesora-secure';
const DB_VERSION = 1;
const CHECK = 'klesora-check';

export class SecureStorageError extends Error {
  /** @param {string} code @param {string} message @param {unknown} [cause] */
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'SecureStorageError';
    this.code = code;
  }
}

/* ---------- IndexedDB, promisified ---------- */

let dbPromise = null;
function db() {
  if (!globalThis.indexedDB) throw new SecureStorageError('not-supported', 'IndexedDB is unavailable.');
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const d = request.result;
      if (!d.objectStoreNames.contains('stores')) d.createObjectStore('stores', { keyPath: 'name' });
      if (!d.objectStoreNames.contains('values')) {
        const values = d.createObjectStore('values', { keyPath: ['store', 'key'] });
        values.createIndex('store', 'store');
      }
    };
    request.onsuccess = () => {
      const d = request.result;
      d.onversionchange = () => {
        d.close();
        dbPromise = null;
      };
      resolve(d);
    };
    request.onerror = () => reject(new SecureStorageError('not-supported', 'Could not open IndexedDB.', request.error));
    request.onblocked = () => reject(new SecureStorageError('not-supported', 'IndexedDB is blocked by another tab.'));
  });
  return dbPromise;
}

const done = (request) =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

/** Run `fn` in one transaction; resolves with fn's result once the transaction has committed. */
async function tx(storeNames, mode, fn) {
  const d = await db();
  const t = d.transaction(storeNames, mode);
  // Listen before any request runs, so completion can't be missed.
  const committed = new Promise((resolve, reject) => {
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('Transaction aborted'));
  });
  committed.catch(() => {}); // a failing request rejects below; don't also report this as unhandled
  const result = await fn(t);
  await committed;
  return result;
}

const aad = (store, key) => `klesora:v1:${store}:${key}`;

/* ---------- Store ---------- */

/**
 * @typedef {object} OpenOptions
 * @property {string} [passphrase] use a passphrase/PIN-derived key instead of a device key
 * @property {number} [iterations] PBKDF2 iterations for a new passphrase store (default 600,000)
 * @property {number} [autoLock] minutes of inactivity before the key is forgotten (passphrase
 *   stores; default 5; 0 = never)
 * @property {boolean} [lockOnHide] also lock when the page is hidden (tab switched, app backgrounded)
 */

class SecureStore {
  #name;
  #meta;
  #key;
  #timer = 0;
  #options;
  #onHide = () => document.visibilityState === 'hidden' && this.lock();

  constructor(name, meta, key, options) {
    this.#name = name;
    this.#meta = meta;
    this.#key = key;
    this.#options = options;
    if (meta.kind === 'passphrase' && options.lockOnHide) document.addEventListener('visibilitychange', this.#onHide);
    this.#touch();
  }

  /** The store's name. */
  get name() {
    return this.#name;
  }

  /** 'device' or 'passphrase'. */
  get mode() {
    return this.#meta.kind;
  }

  /** True when a passphrase store has forgotten its key; call unlock(passphrase). Device stores never lock. */
  get locked() {
    return this.#key === null;
  }

  #touch() {
    clearTimeout(this.#timer);
    const minutes = this.#options.autoLock ?? 5;
    if (this.#meta.kind === 'passphrase' && minutes > 0 && this.#key) this.#timer = setTimeout(() => this.lock(), minutes * 60_000);
  }

  #requireKey() {
    if (!this.#key) throw new SecureStorageError('locked', `The "${this.#name}" store is locked. Call unlock(passphrase).`);
    this.#touch();
    return this.#key;
  }

  /** Forget the key (passphrase stores). Data stays encrypted on disk. */
  lock() {
    if (this.#meta.kind !== 'passphrase') return;
    this.#key = null;
    clearTimeout(this.#timer);
  }

  /** Re-derive the key from the passphrase. Throws 'wrong-passphrase'. */
  async unlock(passphrase) {
    if (this.#meta.kind !== 'passphrase') return;
    this.#key = await keyFromPassphrase(this.#meta, passphrase);
    this.#touch();
  }

  /** The stored value, or undefined when there is none. Throws 'corrupt' if it fails to decrypt. */
  async get(key) {
    const cryptoKey = this.#requireKey();
    const record = await tx(['values'], 'readonly', (t) => done(t.objectStore('values').get([this.#name, String(key)])));
    if (!record) return undefined;
    try {
      return await encryption.decrypt(cryptoKey, record.box, { aad: aad(this.#name, String(key)) });
    } catch (error) {
      throw new SecureStorageError('corrupt', `The value for "${key}" could not be decrypted (altered, moved, or wrong key).`, error);
    }
  }

  async has(key) {
    this.#requireKey();
    return (await tx(['values'], 'readonly', (t) => done(t.objectStore('values').count([this.#name, String(key)])))) > 0;
  }

  /** Encrypt and save a JSON value or bytes. */
  async set(key, value) {
    const cryptoKey = this.#requireKey();
    const box = await encryption.encrypt(cryptoKey, value, { aad: aad(this.#name, String(key)) });
    await tx(['values'], 'readwrite', (t) => done(t.objectStore('values').put({ store: this.#name, key: String(key), box })));
  }

  async delete(key) {
    this.#requireKey();
    await tx(['values'], 'readwrite', (t) => done(t.objectStore('values').delete([this.#name, String(key)])));
  }

  /** Key names in this store (names are not encrypted). */
  async keys() {
    this.#requireKey();
    const records = await tx(['values'], 'readonly', (t) => done(t.objectStore('values').index('store').getAllKeys(this.#name)));
    return records.map(([, key]) => key);
  }

  /** Remove every value, keeping the store and its key. */
  async clear() {
    this.#requireKey();
    await tx(['values'], 'readwrite', (t) => done(t.objectStore('values').delete(IDBKeyRange.bound([this.#name], [this.#name, []]))));
  }

  /**
   * Re-encrypt everything under a new passphrase (passphrase stores; must be unlocked).
   * @param {string} next
   */
  async changePassphrase(next) {
    if (this.#meta.kind !== 'passphrase') throw new SecureStorageError('mode-mismatch', 'Only passphrase stores have a passphrase.');
    const oldKey = this.#requireKey();
    const salt = encryption.randomSalt();
    const iterations = this.#meta.iterations;
    const newKey = await encryption.deriveKey(next, { salt, iterations });
    const records = await tx(['values'], 'readonly', (t) => done(t.objectStore('values').index('store').getAll(this.#name)));
    const updated = [];
    for (const record of records) {
      const value = await encryption.decrypt(oldKey, record.box, { aad: aad(this.#name, record.key) });
      updated.push({ ...record, box: await encryption.encrypt(newKey, value, { aad: aad(this.#name, record.key) }) });
    }
    const meta = { ...this.#meta, salt, check: await encryption.encrypt(newKey, CHECK, { aad: aad(this.#name, '') }) };
    // One transaction: either everything moves to the new passphrase, or nothing does.
    await tx(['stores', 'values'], 'readwrite', (t) => {
      for (const record of updated) t.objectStore('values').put(record);
      return done(t.objectStore('stores').put(meta));
    });
    this.#meta = meta;
    this.#key = newKey;
    this.#touch();
  }

  /** Delete the store, its key and all its values. */
  async destroy() {
    this.lock();
    this.#key = null;
    document.removeEventListener('visibilitychange', this.#onHide);
    await removeStore(this.#name);
  }

  /** Stop timers and listeners (the store stays on disk). */
  close() {
    clearTimeout(this.#timer);
    document.removeEventListener('visibilitychange', this.#onHide);
  }
}

async function keyFromPassphrase(meta, passphrase) {
  const key = await encryption.deriveKey(passphrase, { salt: meta.salt, iterations: meta.iterations });
  try {
    if ((await encryption.decrypt(key, meta.check, { aad: aad(meta.name, '') })) === CHECK) return key;
  } catch {
    /* fall through */
  }
  throw new SecureStorageError('wrong-passphrase', 'Wrong passphrase.');
}

async function removeStore(name) {
  await tx(['stores', 'values'], 'readwrite', (t) => {
    t.objectStore('values').delete(IDBKeyRange.bound([name], [name, []]));
    return done(t.objectStore('stores').delete(name));
  });
}

export const secureStorage = {
  /**
   * Open (or create) an encrypted store.
   * @param {string} name
   * @param {OpenOptions} [options]
   * @returns {Promise<SecureStore>}
   */
  async open(name, options = {}) {
    if (!name) throw new SecureStorageError('invalid-input', 'A store name is required.');
    const wanted = options.passphrase !== undefined ? 'passphrase' : 'device';
    let meta = await tx(['stores'], 'readonly', (t) => done(t.objectStore('stores').get(name)));

    if (meta && meta.kind !== wanted) {
      throw new SecureStorageError(
        'mode-mismatch',
        meta.kind === 'passphrase' ? `"${name}" is a passphrase store: pass { passphrase }.` : `"${name}" uses a device key: don't pass a passphrase.`,
      );
    }

    let key;
    if (!meta && wanted === 'device') {
      key = await encryption.generateKey({ extractable: false });
      meta = { name, kind: 'device', key, created: Date.now() };
      await tx(['stores'], 'readwrite', (t) => done(t.objectStore('stores').add(meta)));
    } else if (!meta) {
      const salt = encryption.randomSalt();
      const iterations = options.iterations ?? DEFAULT_ITERATIONS;
      key = await encryption.deriveKey(options.passphrase, { salt, iterations });
      meta = { name, kind: 'passphrase', salt, iterations, check: await encryption.encrypt(key, CHECK, { aad: aad(name, '') }), created: Date.now() };
      await tx(['stores'], 'readwrite', (t) => done(t.objectStore('stores').add(meta)));
    } else if (meta.kind === 'device') {
      key = meta.key;
    } else {
      key = await keyFromPassphrase(meta, options.passphrase);
    }
    return new SecureStore(name, meta, key, options);
  },

  /** Does a store with this name exist? */
  async exists(name) {
    return Boolean(await tx(['stores'], 'readonly', (t) => done(t.objectStore('stores').get(name))));
  },

  /** Delete a store, its key and all its values, without opening it (e.g. "forgot PIN"). */
  async delete(name) {
    await removeStore(name);
  },
};
