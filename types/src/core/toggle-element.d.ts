/**
 * ToggleElement: shared base for <kl-checkbox> and <kl-switch>. The element is the control;
 * its children are the label text, so clicking the text toggles it.
 *
 * Submits `value` (default "on") when checked, like a native checkbox. Fires native-style
 * `input` and `change` events (bubbling) on user toggles. Space toggles; Enter does not.
 */
import { FormElement } from './form-element.js';
export declare class ToggleElement extends FormElement {
    #private;
    /** @type {import('./element.js').PropertyDeclarations} */
    static properties: import('./element.js').PropertyDeclarations;
    /** ARIA role of the host; subclasses set 'checkbox' or 'switch'. */
    static role: string;
    connected(): void;
    update(changed: any, first: any): void;
    /** @returns {'true' | 'false' | 'mixed'} */
    ariaCheckedState(): 'true' | 'false' | 'mixed';
    /** Toggle as a user would: updates state, then fires `input` and `change`. */
    toggle(): void;
    setCustomValidity(message: any): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: any): void;
}
