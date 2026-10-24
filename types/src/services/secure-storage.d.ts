export declare class SecureStorageError extends Error {
    code: string;
    /** @param {string} code @param {string} message @param {unknown} [cause] */
    constructor(code: string, message: string, cause?: unknown);
}
export type OpenOptions = {
    /**
     * use a passphrase/PIN-derived key instead of a device key
     */
    passphrase?: string;
    /**
     * PBKDF2 iterations for a new passphrase store (default 600,000)
     */
    iterations?: number;
    /**
     * minutes of inactivity before the key is forgotten (passphrase
     * stores; default 5; 0 = never)
     */
    autoLock?: number;
    /**
     * also lock when the page is hidden (tab switched, app backgrounded)
     */
    lockOnHide?: boolean;
};
/**
 * @typedef {object} OpenOptions
 * @property {string} [passphrase] use a passphrase/PIN-derived key instead of a device key
 * @property {number} [iterations] PBKDF2 iterations for a new passphrase store (default 600,000)
 * @property {number} [autoLock] minutes of inactivity before the key is forgotten (passphrase
 *   stores; default 5; 0 = never)
 * @property {boolean} [lockOnHide] also lock when the page is hidden (tab switched, app backgrounded)
 */
declare class SecureStore {
    #private;
    constructor(name: any, meta: any, key: any, options: any);
    /** The store's name. */
    get name(): any;
    /** 'device' or 'passphrase'. */
    get mode(): any;
    /** True when a passphrase store has forgotten its key; call unlock(passphrase). Device stores never lock. */
    get locked(): boolean;
    /** Forget the key (passphrase stores). Data stays encrypted on disk. */
    lock(): void;
    /** Re-derive the key from the passphrase. Throws 'wrong-passphrase'. */
    unlock(passphrase: any): Promise<void>;
    /** The stored value, or undefined when there is none. Throws 'corrupt' if it fails to decrypt. */
    get(key: any): Promise<any>;
    has(key: any): Promise<boolean>;
    /** Encrypt and save a JSON value or bytes. */
    set(key: any, value: any): Promise<void>;
    delete(key: any): Promise<void>;
    /** Key names in this store (names are not encrypted). */
    keys(): Promise<any>;
    /** Remove every value, keeping the store and its key. */
    clear(): Promise<void>;
    /**
     * Re-encrypt everything under a new passphrase (passphrase stores; must be unlocked).
     * @param {string} next
     */
    changePassphrase(next: string): Promise<void>;
    /** Delete the store, its key and all its values. */
    destroy(): Promise<void>;
    /** Stop timers and listeners (the store stays on disk). */
    close(): void;
}
export declare const secureStorage: {
    /**
     * Open (or create) an encrypted store.
     * @param {string} name
     * @param {OpenOptions} [options]
     * @returns {Promise<SecureStore>}
     */
    open(name: string, options?: OpenOptions): Promise<SecureStore>;
    /** Does a store with this name exist? */
    exists(name: any): Promise<boolean>;
    /** Delete a store, its key and all its values, without opening it (e.g. "forgot PIN"). */
    delete(name: any): Promise<void>;
};
export {};
