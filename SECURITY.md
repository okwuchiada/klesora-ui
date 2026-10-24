# Security

## What client-side encryption does and does not protect

Klesora UI includes `encryption` (`klesora-ui/services/crypto`) and `secureStorage`
(`klesora-ui/services/secure-storage`). They encrypt data in the browser with Web Crypto
(AES-GCM 256, PBKDF2-SHA256). That's useful, but narrow. Read this before relying on it.

### It protects against

- **Reading stored data at rest.** Someone who copies the browser profile, a device backup or
  the IndexedDB files sees only ciphertext.
- **Casual inspection.** A curious person in DevTools → Application → IndexedDB sees ciphertext,
  not account numbers.
- **Other websites.** Browsers already isolate storage per origin, and encryption adds nothing
  here. It's listed so you don't count it twice.
- **Tampering with stored values.** AES-GCM is authenticated: altered data, or a value copied to
  another key or store, fails to decrypt (`'corrupt'`) instead of being silently accepted.
- **Copied data without the passphrase** (passphrase stores only). The key isn't stored, so the
  copied data needs the passphrase. That's only as strong as the passphrase; see below.

### It does not protect against

- **Code running on your page.** XSS, a compromised npm dependency, a malicious browser
  extension or a third-party script can call `store.get()` exactly like your code can. A
  non-extractable key can't be *exported*, but it can still be *used* to decrypt. This is the
  most important limit: client-side encryption is no defence against script injection. Use a
  strict Content Security Policy, few dependencies and lockfile review.
- **Someone using the unlocked device or session.** If the app is open and a store is unlocked,
  whoever holds the device holds the data. Auto-lock (`autoLock`, `lockOnHide`) narrows that window.
- **Weak passphrases.** PBKDF2 slows guessing (600,000 iterations by default), but a 4-digit PIN
  has only 10,000 possibilities. An attacker with a copy of the data can try them all offline,
  in seconds to minutes. Rate limits or "wipe after N attempts" in the UI don't help against an
  offline copy. Use PINs only for convenience locks over data that's also protected elsewhere,
  and longer passphrases for anything that matters.
- **Your server, the network, or the user's OS.** Encryption here is local. It doesn't replace
  HTTPS, server-side authorisation or server-side encryption. Never treat client-side checks as
  security boundaries.
- **Metadata.** Store names, key names, the number of entries and value sizes are visible.
  Only values are encrypted.
- **Lost keys.** If the browser clears site data, the device key and everything encrypted with
  it are gone. A forgotten passphrase can't be recovered. Treat secure storage as a cache of
  data your server can re-issue, not the only copy.

### Good fits

- Caching sensitive-but-reissuable data on the device: masked card details, recent
  beneficiaries, a refresh token you'd rather not keep in plain localStorage.
- A "quick unlock" PIN in front of locally cached data, alongside proper server authentication.
- Encrypting a blob before upload with a key derived from a user passphrase (end-to-end style),
  when the server must not read it.

### Poor fits

- Hiding secrets from your own users (API keys in the frontend are always extractable).
- Anything where losing the local copy would lose the data.
- Replacing server-side access control.

## Details

- **Cipher:** AES-GCM 256, a fresh random 96-bit IV per value, and the store and key names bound
  as additional authenticated data.
- **Device keys:** `generateKey` with `extractable: false`, kept in IndexedDB (structured clone of
  the CryptoKey).
- **Passphrase keys:** PBKDF2-SHA256, 600,000 iterations (OWASP 2023), a random 16-byte salt per
  store, and the passphrase normalised with NFKC. The derived key is held only in memory. A
  small encrypted check value detects a wrong passphrase.
- **Changing the passphrase** re-encrypts every value and swaps the salt in one IndexedDB
  transaction.
- **Secure context:** Web Crypto needs one (https or localhost).

## Reporting a vulnerability

Please report security issues privately via GitHub security advisories on
[okwuchiada/klesora-ui](https://github.com/okwuchiada/klesora-ui/security/advisories/new), not in public issues.
