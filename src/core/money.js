/**
 * Money helpers. Amounts are exact decimal strings in the main unit ("45000.50"), never
 * floating-point numbers. Maths goes through BigInt minor units; formatting through Intl,
 * which accepts decimal strings exactly. Zero dependencies; safe to import without a DOM.
 */

/** @typedef {{ locale?: string, currency?: string }} MoneyOptions */

const cache = new Map();
/** Cached Intl.NumberFormat (they're expensive to create). */
export function numberFormat(locale, options) {
  const key = JSON.stringify([locale ?? null, options]);
  if (!cache.has(key)) cache.set(key, new Intl.NumberFormat(locale, options));
  return cache.get(key);
}

/** The page's locale: <html lang>, else the browser's, else en-NG. */
export function defaultLocale() {
  return globalThis.document?.documentElement.lang || globalThis.navigator?.language || 'en-NG';
}

/** Decimal places for a currency (NGN 2, JPY 0, KWD 3). */
export function currencyDigits(currency = 'NGN') {
  return numberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

/** The locale's decimal and group separators. */
export function separators(locale) {
  const parts = numberFormat(locale, { useGrouping: true }).formatToParts(12345.6);
  return {
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? '.',
    group: parts.find((p) => p.type === 'group')?.value ?? ',',
  };
}

/**
 * The currency symbol for a locale, and whether it goes before or after the number.
 * @returns {{ symbol: string, position: 'start' | 'end', name: string }}
 */
export function currencySymbol(currency = 'NGN', locale) {
  const parts = numberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' }).formatToParts(1);
  const index = parts.findIndex((p) => p.type === 'currency');
  const first = parts.findIndex((p) => p.type === 'integer');
  let name = currency;
  try {
    name = new Intl.DisplayNames(locale, { type: 'currency' }).of(currency) ?? currency;
  } catch {
    /* DisplayNames unsupported: fall back to the code */
  }
  return { symbol: parts[index]?.value ?? currency, position: index < first ? 'start' : 'end', name };
}

/**
 * Normalise a decimal string: "007.50" → "7.50", "-0" → "0", "" stays "". Returns null when
 * it isn't a plain decimal.
 * @param {string} value
 */
export function normalizeDecimal(value) {
  const text = String(value ?? '').trim();
  if (text === '') return '';
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === '' && (match[3] ?? '') === '')) return null;
  const int = match[2].replace(/^0+(?=\d)/, '') || '0';
  const frac = match[3];
  const negative = match[1] && (/[1-9]/.test(int) || /[1-9]/.test(frac ?? ''));
  return `${negative ? '-' : ''}${int}${frac !== undefined ? `.${frac}` : ''}`;
}

/** Truncate to `digits` decimals and pad ("45000.5", 2 → "45000.50"). Never rounds. */
export function fixDecimal(value, digits) {
  const n = normalizeDecimal(value);
  if (!n) return n;
  const [int, frac = ''] = n.split('.');
  return digits > 0 ? `${int}.${frac.padEnd(digits, '0').slice(0, digits)}` : int;
}

/** "45000.50" → 4500050n (BigInt minor units, exact). */
export function toMinor(value, digits) {
  const fixed = fixDecimal(value, digits);
  if (!fixed) return null;
  const negative = fixed.startsWith('-');
  const digitsOnly = fixed.replace(/[-.]/g, '');
  const minor = BigInt(digitsOnly || '0');
  return negative ? -minor : minor;
}

/** 4500050n → "45000.50". */
export function fromMinor(minor, digits) {
  const big = BigInt(minor);
  const negative = big < 0n;
  const text = (negative ? -big : big).toString().padStart(digits + 1, '0');
  const int = digits ? text.slice(0, -digits) : text;
  const frac = digits ? text.slice(-digits) : '';
  return `${negative ? '-' : ''}${int}${digits ? `.${frac}` : ''}`;
}

/** Compare two decimal strings: -1, 0 or 1. */
export function compareDecimal(a, b, digits = 6) {
  const x = toMinor(a, digits);
  const y = toMinor(b, digits);
  return x === y ? 0 : x < y ? -1 : 1;
}

/**
 * Format an amount for display, e.g. formatMoney("45000.5", { currency: "NGN" }) → "₦45,000.50".
 * @param {string | number | bigint} amount a decimal string (exact), number or BigInt
 * @param {MoneyOptions & Intl.NumberFormatOptions} [options]
 */
export function formatMoney(amount, { locale, currency = 'NGN', ...rest } = {}) {
  const value = typeof amount === 'string' ? normalizeDecimal(amount) : amount;
  if (value === null || value === '') return '';
  return numberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol', ...rest }).format(
    /** @type {any} */ (value),
  );
}

/** Group the integer part for the locale ("1234567" → "1,234,567"), exactly (BigInt). */
export function groupInteger(int, locale) {
  if (!int) return '';
  return numberFormat(locale, { useGrouping: true, maximumFractionDigits: 0 }).format(BigInt(int));
}
