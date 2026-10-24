/**
 * <kl-input>: a form-associated text input.
 *
 *   <kl-input name="email" type="email" required placeholder="you@example.com"></kl-input>
 *   <kl-input name="amount" inputmode="decimal"><span slot="start">₦</span></kl-input>
 *
 * The element is the box. It creates its own <input> (the textbox screen readers see) and never
 * moves your children. The inner input belongs to no form: the element submits through
 * ElementInternals and copies the inner input's native validity (type, pattern, min/max, length).
 * Native `input` and `change` events bubble from the inner input as usual.
 */
import { FormElement } from '../../core/form-element.js';
export declare class KlInput extends FormElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    /** The inner <input>, for selection APIs and advanced use. */
    get control(): HTMLInputElement;
    connected(): void;
    update(changed: any, first: any): void;
    focus(options: any): void;
    blur(): void;
    select(): void;
    /** Like HTMLInputElement.setCustomValidity: a non-empty message makes the control invalid. */
    setCustomValidity(message: any): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: any): void;
}
