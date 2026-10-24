/**
 * Money helpers. Amounts are exact decimal strings in the main unit ("45000.50"), never
 * floating-point numbers. Maths goes through BigInt minor units; formatting through Intl,
 * which accepts decimal strings exactly. Zero dependencies; safe to import without a DOM.
 */
export type MoneyOptions = {
    locale?: string;
    currency?: string;
};
/** Cached Intl.NumberFormat (they're expensive to create). */
export declare function numberFormat(locale: any, options: any): any;
/** The page's locale: <html lang>, else the browser's, else en-NG. */
export declare function defaultLocale(): string;
/** Decimal places for a currency (NGN 2, JPY 0, KWD 3). */
export declare function currencyDigits(currency?: string): any;
/** The locale's decimal and group separators. */
export declare function separators(locale: any): {
    decimal: any;
    group: any;
};
/**
 * The currency symbol for a locale, and whether it goes before or after the number.
 * @returns {{ symbol: string, position: 'start' | 'end', name: string }}
 */
export declare function currencySymbol(currency: string, locale: any): {
    symbol: string;
    position: 'start' | 'end';
    name: string;
};
/**
 * Normalise a decimal string: "007.50" → "7.50", "-0" → "0", "" stays "". Returns null when
 * it isn't a plain decimal.
 * @param {string} value
 */
export declare function normalizeDecimal(value: string): string;
/** Truncate to `digits` decimals and pad ("45000.5", 2 → "45000.50"). Never rounds. */
export declare function fixDecimal(value: any, digits: any): string;
/** "45000.50" → 4500050n (BigInt minor units, exact). */
export declare function toMinor(value: any, digits: any): bigint;
/** 4500050n → "45000.50". */
export declare function fromMinor(minor: any, digits: any): string;
/** Compare two decimal strings: -1, 0 or 1. */
export declare function compareDecimal(a: any, b: any, digits?: number): -1 | 0 | 1;
/**
 * Format an amount for display, e.g. formatMoney("45000.5", { currency: "NGN" }) → "₦45,000.50".
 * @param {string | number | bigint} amount a decimal string (exact), number or BigInt
 * @param {MoneyOptions & Intl.NumberFormatOptions} [options]
 */
export declare function formatMoney(amount: string | number | bigint, { locale, currency, ...rest }?: MoneyOptions & Intl.NumberFormatOptions): any;
/** Group the integer part for the locale ("1234567" → "1,234,567"), exactly (BigInt). */
export declare function groupInteger(int: any, locale: any): any;
