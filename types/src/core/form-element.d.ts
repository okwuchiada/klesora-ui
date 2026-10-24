/**
 * FormElement: base class for form controls. Form-associated through ElementInternals,
 * so the control submits with native <form>s, resets, restores, validates, and is disabled
 * by a disabled <fieldset>, which also makes it work with framework form libraries.
 *
 * Mirrors the effective disabled state (own or fieldset) as `data-disabled` for CSS.
 *
 * Subclasses own `value`. In `update()`, call `super.update(changed, first)` and then
 * `this.setFormValue(...)` / `this.setValidity(...)` as needed. Implement the standard
 * `formResetCallback()` and `formStateRestoreCallback(state)` to support reset and restore.
 */
import { UIElement } from './element.js';
/**
 * Call form methods through the prototype: a control named or id'd "reset", "requestSubmit"
 * or "querySelector" replaces the method on the form object (DOM clobbering).
 */
export declare const formActions: {
    /** @param {HTMLFormElement} form */
    submit: (form: HTMLFormElement) => any;
    /** @param {HTMLFormElement} form */
    reset: (form: HTMLFormElement) => any;
    /** @param {HTMLFormElement} form @param {string} selector */
    find: (form: HTMLFormElement, selector: string) => any;
};
export declare class FormElement extends UIElement {
    static formAssociated: boolean;
    /** @type {import('./element.js').PropertyDeclarations} */
    static properties: import('./element.js').PropertyDeclarations;
    constructor();
    /** True when this control or an ancestor <fieldset> is disabled. */
    get isDisabled(): any;
    get form(): HTMLFormElement;
    get labels(): NodeList;
    get validity(): ValidityState;
    get validationMessage(): string;
    get willValidate(): boolean;
    checkValidity(): boolean;
    reportValidity(): boolean;
    /**
     * Set the submitted value (null submits nothing) and the state restored on back/forward navigation.
     * @param {string | File | FormData | null} value
     * @param {string | File | FormData | null} [state]
     */
    setFormValue(value: string | File | FormData | null, state?: string | File | FormData | null): void;
    /**
     * Set validity. Pass {} or nothing to mark the control valid.
     * @param {ValidityStateFlags} [flags]
     * @param {string} [message] required when any flag is true
     * @param {HTMLElement} [anchor] element the browser points its validation bubble at
     */
    setValidity(flags?: ValidityStateFlags, message?: string, anchor?: HTMLElement): void;
    formDisabledCallback(disabled: any): void;
    update(changed: any, first: any): void;
}
