/**
 * <kl-otp-input>: one-time codes and PINs, drawn as boxes over a single real input.
 *
 *   <kl-otp-input name="code" length="6" required></kl-otp-input>
 *   <kl-otp-input name="pin" length="4" mask></kl-otp-input>
 *
 * Because it's one <input> underneath, SMS code autofill (autocomplete="one-time-code" on iOS
 * and Android), paste, password managers and screen readers treat it as a single field.
 * - `type="numeric"` (default) keeps digits; `type="alphanumeric"` keeps letters and digits.
 * - `mask` shows dots and makes the input a password field, so the code isn't read aloud.
 * - Fires `kl-complete` (detail: { value }) when every box is filled, plus native input/change.
 * - Required and partly-filled codes are invalid (valueMissing / tooShort).
 */
import { FormElement } from '../../core/form-element.js';
export declare class KlOtpInput extends FormElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    constructor();
    get control(): HTMLInputElement;
    connected(): void;
    update(changed: any, first: any): void;
    focus(options: any): void;
    /** Clear the code (e.g. after a wrong attempt) and focus the first box. */
    clear(): void;
    setCustomValidity(message: any): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: any): void;
}
