/**
 * <kl-amount-input>: money entry with live, locale-aware formatting.
 *
 *   <kl-amount-input name="amount" currency="NGN" min="100" max="5000000" required></kl-amount-input>
 *   <kl-amount-input currency="USD" locale="en-US" value="12.5"></kl-amount-input>
 *
 * - `value` is an exact decimal string in the main unit ("45000.50"), never a float. It's what the
 *   form submits (padded to the currency's decimals). `minorUnits` gives integer kobo/cents
 *   (a Number, or a BigInt beyond Number.MAX_SAFE_INTEGER); `valueAsNumber` is for display maths.
 * - Thousands separators appear as you type and the caret stays put; decimals pad on blur.
 *   Paste "₦45,000.00" and it becomes 45000.00. The currency's own decimals apply (₦ 2, ¥ 0).
 * - The currency symbol sits where the locale puts it (₦45,000 / 45.000 €). Screen readers hear
 *   the currency name, not the symbol.
 * - min / max / required validate with messages that include the formatted limits.
 *   `allow-negative` permits a leading minus.
 */
import { FormElement } from '../../core/form-element.js';
export declare class KlAmountInput extends FormElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    constructor();
    get control(): HTMLInputElement;
    /** Integer minor units (kobo, cents), or null when empty. BigInt only beyond MAX_SAFE_INTEGER. */
    get minorUnits(): number | bigint;
    set minorUnits(units: number | bigint);
    /** The value as a Number (for display maths only), or NaN when empty. */
    get valueAsNumber(): number;
    connected(): void;
    update(changed: any, first: any): void;
    focus(options: any): void;
    blur(): void;
    /** A non-empty message makes the control invalid (e.g. "Insufficient balance"). */
    setCustomValidity(message: any): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: any): void;
}
