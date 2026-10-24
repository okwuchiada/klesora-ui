/**
 * <kl-checkbox>: the element is the checkbox; its content is the label.
 *
 *   <kl-checkbox name="save" checked>Save beneficiary</kl-checkbox>
 *   <kl-checkbox indeterminate>Select all</kl-checkbox>
 *
 * `indeterminate` shows a dash (aria-checked="mixed") and clears on the next user toggle.
 */
import { ToggleElement } from '../../core/toggle-element.js';
export declare class KlCheckbox extends ToggleElement {
    static role: string;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    ariaCheckedState(): "false" | "mixed" | "true";
    toggle(): void;
}
