import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/security.html');
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        const r = indexedDB.deleteDatabase('klesora-secure');
        r.onsuccess = r.onerror = r.onblocked = () => resolve(null);
      }),
  );
  await page.evaluate(() => import('/src/index.js').then((m) => (window.kl = m)));
});

/** Read a raw record from IndexedDB, bypassing the library. */
const rawRecord = (store: string, key: string) =>
  `new Promise((resolve) => {
    const open = indexedDB.open('klesora-secure');
    open.onsuccess = () => {
      const get = open.result.transaction('values').objectStore('values').get([${JSON.stringify(store)}, ${JSON.stringify(key)}]);
      get.onsuccess = () => { resolve(get.result); open.result.close(); };
    };
  })`;

test.describe('encryption', () => {
  test('round-trips JSON and bytes; fresh IV each time; keys are non-extractable', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { encryption } = window.kl;
      const key = await encryption.generateKey();
      const a = await encryption.encrypt(key, { pan: '5399 8300 0000 0000', amount: '45000.50' });
      const b = await encryption.encrypt(key, { pan: '5399 8300 0000 0000', amount: '45000.50' });
      const bytes = await encryption.encrypt(key, new Uint8Array([1, 2, 3]));
      let exported = 'exported';
      try {
        await crypto.subtle.exportKey('raw', key);
      } catch (e) {
        exported = e.name;
      }
      return {
        json: await encryption.decrypt(key, a),
        bytes: [...(await encryption.decrypt(key, bytes))],
        sameIv: a.iv.join() === b.iv.join(),
        sameCt: a.ct.join() === b.ct.join(),
        exported,
        roundTrip: await encryption.decrypt(key, encryption.parse(encryption.serialize(a))),
      };
    });
    expect(r).toEqual({
      json: { pan: '5399 8300 0000 0000', amount: '45000.50' },
      bytes: [1, 2, 3],
      sameIv: false,
      sameCt: false,
      exported: 'InvalidAccessError',
      roundTrip: { pan: '5399 8300 0000 0000', amount: '45000.50' },
    });
  });

  test('tampering, a wrong key or a wrong aad all fail loudly', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { encryption } = window.kl;
      const key = await encryption.generateKey();
      const other = await encryption.generateKey();
      const box = await encryption.encrypt(key, 'secret', { aad: 'card:1' });
      const tampered = { ...box, ct: box.ct.map((b, i) => (i === 0 ? b ^ 1 : b)) };
      const attempt = async (fn) => {
        try {
          await fn();
          return 'ok';
        } catch (e) {
          return e.code;
        }
      };
      return [
        await attempt(() => encryption.decrypt(key, box, { aad: 'card:1' })),
        await attempt(() => encryption.decrypt(key, tampered, { aad: 'card:1' })),
        await attempt(() => encryption.decrypt(other, box, { aad: 'card:1' })),
        await attempt(() => encryption.decrypt(key, box, { aad: 'card:2' })),
        await attempt(() => encryption.decrypt(key, box)),
      ];
    });
    expect(r).toEqual(['ok', 'decrypt-failed', 'decrypt-failed', 'decrypt-failed', 'decrypt-failed']);
  });

  test('deriveKey is deterministic for the same salt and rejects weak inputs', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { encryption } = window.kl;
      const salt = encryption.randomSalt();
      const k1 = await encryption.deriveKey('correct horse', { salt, iterations: 1000 });
      const k2 = await encryption.deriveKey('correct horse', { salt, iterations: 1000 });
      const box = await encryption.encrypt(k1, 'hello');
      const errors = [];
      for (const args of [['', { salt }], ['x', { salt: new Uint8Array(4) }]]) {
        try {
          await encryption.deriveKey(...args);
        } catch (e) {
          errors.push(e.code);
        }
      }
      return { same: await encryption.decrypt(k2, box), errors };
    });
    expect(r).toEqual({ same: 'hello', errors: ['invalid-input', 'invalid-input'] });
  });
});

test.describe('secureStorage: device key', () => {
  test('persists across reloads and stores only ciphertext', async ({ page }) => {
    await page.evaluate(async () => {
      const s = await window.kl.secureStorage.open('prefs');
      await s.set('account', { number: '0123456789', bank: 'GTBank' });
    });
    const raw = await page.evaluate(rawRecord('prefs', 'account'));
    const plaintextOnDisk = await page.evaluate((record) => {
      const text = new TextDecoder().decode(record.box.ct);
      return text.includes('0123456789') || JSON.stringify(record).includes('0123456789');
    }, raw);
    await page.reload();
    const r = await page.evaluate(async () => {
      const { secureStorage } = await import('/src/index.js');
      const s = await secureStorage.open('prefs');
      return { value: await s.get('account'), mode: s.mode, locked: s.locked, keys: await s.keys(), missing: await s.get('nope') };
    });
    expect(plaintextOnDisk).toBe(false);
    expect(r).toEqual({ value: { number: '0123456789', bank: 'GTBank' }, mode: 'device', locked: false, keys: ['account'], missing: undefined });
  });

  test('the stored device key cannot be exported', async ({ page }) => {
    const r = await page.evaluate(async () => {
      await window.kl.secureStorage.open('prefs');
      const meta = await new Promise((resolve) => {
        const open = indexedDB.open('klesora-secure');
        open.onsuccess = () => {
          const get = open.result.transaction('stores').objectStore('stores').get('prefs');
          get.onsuccess = () => resolve(get.result);
        };
      });
      try {
        await crypto.subtle.exportKey('raw', meta.key);
        return 'exported';
      } catch (e) {
        return [meta.key.extractable, e.name];
      }
    });
    expect(r).toEqual([false, 'InvalidAccessError']);
  });

  test('a ciphertext moved to another key or store is rejected (authenticated names)', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { secureStorage } = window.kl;
      const s = await secureStorage.open('prefs');
      await s.set('limit', '50000');
      // Attacker with disk access copies the ciphertext of "limit" over "balance".
      await new Promise((resolve) => {
        const open = indexedDB.open('klesora-secure');
        open.onsuccess = () => {
          const store = open.result.transaction('values', 'readwrite').objectStore('values');
          store.get(['prefs', 'limit']).onsuccess = (e) => {
            store.put({ ...e.target.result, key: 'balance' }).onsuccess = resolve;
          };
        };
      });
      try {
        await s.get('balance');
        return 'accepted';
      } catch (e) {
        return e.code;
      }
    });
    expect(r).toBe('corrupt');
  });

  test('has, delete, clear and destroy', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { secureStorage } = window.kl;
      const s = await secureStorage.open('prefs');
      const other = await secureStorage.open('other');
      await s.set('a', 1);
      await s.set('b', new Uint8Array([9]));
      await other.set('a', 'keep');
      const before = [await s.has('a'), [...(await s.get('b'))]];
      await s.delete('a');
      const afterDelete = await s.keys();
      await s.clear();
      const afterClear = await s.keys();
      await s.destroy();
      return { before, afterDelete, afterClear, exists: await secureStorage.exists('prefs'), otherKept: await other.get('a') };
    });
    expect(r).toEqual({ before: [true, [9]], afterDelete: ['b'], afterClear: [], exists: false, otherKept: 'keep' });
  });
});

test.describe('secureStorage: passphrase', () => {
  test('wrong passphrase fails; right one opens after a reload; modes cannot be mixed', async ({ page }) => {
    await page.evaluate(async () => {
      const s = await window.kl.secureStorage.open('wallet', { passphrase: '2580', iterations: 1000 });
      await s.set('pan', '5399830000000000');
    });
    await page.reload();
    const r = await page.evaluate(async () => {
      const { secureStorage } = await import('/src/index.js');
      const code = async (fn) => {
        try {
          await fn();
          return 'ok';
        } catch (e) {
          return e.code;
        }
      };
      const wrong = await code(() => secureStorage.open('wallet', { passphrase: '0000' }));
      const noPass = await code(() => secureStorage.open('wallet'));
      const right = await secureStorage.open('wallet', { passphrase: '2580' });
      const device = await secureStorage.open('prefs');
      const passOnDevice = await code(() => secureStorage.open('prefs', { passphrase: 'x' }));
      return { wrong, noPass, value: await right.get('pan'), passOnDevice, deviceMode: device.mode };
    });
    expect(r).toEqual({ wrong: 'wrong-passphrase', noPass: 'mode-mismatch', value: '5399830000000000', passOnDevice: 'mode-mismatch', deviceMode: 'device' });
  });

  test('auto-locks after inactivity and unlocks again', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const s = await window.kl.secureStorage.open('wallet', { passphrase: 'pin-1234', iterations: 1000, autoLock: 0.005 }); // 300ms
      await s.set('n', 1);
      await new Promise((r) => setTimeout(r, 500));
      const locked = s.locked;
      let error = null;
      try {
        await s.get('n');
      } catch (e) {
        error = e.code;
      }
      let wrong = null;
      try {
        await s.unlock('nope');
      } catch (e) {
        wrong = e.code;
      }
      await s.unlock('pin-1234');
      const value = await s.get('n');
      s.close();
      return { locked, error, wrong, value, after: s.locked };
    });
    expect(r).toEqual({ locked: true, error: 'locked', wrong: 'wrong-passphrase', value: 1, after: false });
  });

  test('lockOnHide locks when the page is hidden', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const s = await window.kl.secureStorage.open('wallet', { passphrase: 'pin', iterations: 1000, lockOnHide: true, autoLock: 0 });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
      const locked = s.locked;
      delete document.visibilityState;
      s.close();
      return locked;
    });
    expect(r).toBe(true);
  });

  test('changePassphrase re-encrypts everything under the new one', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { secureStorage } = window.kl;
      const s = await secureStorage.open('wallet', { passphrase: 'old-pass', iterations: 1000 });
      await s.set('a', 'alpha');
      await s.set('b', { n: 2 });
      await s.changePassphrase('new-pass');
      s.close();
      let old = null;
      try {
        await secureStorage.open('wallet', { passphrase: 'old-pass' });
      } catch (e) {
        old = e.code;
      }
      const reopened = await secureStorage.open('wallet', { passphrase: 'new-pass' });
      return { old, a: await reopened.get('a'), b: await reopened.get('b') };
    });
    expect(r).toEqual({ old: 'wrong-passphrase', a: 'alpha', b: { n: 2 } });
  });

  test('defaults to 600,000 PBKDF2 iterations', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const started = performance.now();
      const s = await window.kl.secureStorage.open('slow', { passphrase: 'a long passphrase' });
      const ms = performance.now() - started;
      const meta = await new Promise((resolve) => {
        const open = indexedDB.open('klesora-secure');
        open.onsuccess = () => {
          const get = open.result.transaction('stores').objectStore('stores').get('slow');
          get.onsuccess = () => resolve(get.result);
        };
      });
      s.close();
      return { iterations: meta.iterations, salt: meta.salt.length, hasKeyOnDisk: 'key' in meta, ms };
    });
    expect({ ...r, ms: undefined }).toEqual({ iterations: 600000, salt: 16, hasKeyOnDisk: false, ms: undefined });
    console.log(`600k PBKDF2 derive took ${Math.round(r.ms)}ms`);
  });
});
