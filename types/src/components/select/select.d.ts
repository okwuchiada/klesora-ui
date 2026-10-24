/**
 * <kl-select>: a custom select (WAI-ARIA select-only combobox).
 *
 *   <kl-select name="bank" placeholder="Choose a bank" required>
 *     <kl-option value="gtb">GTBank</kl-option>
 *     <kl-option value="zenith" disabled>Zenith Bank</kl-option>
 *   </kl-select>
 *
 * The element is the combobox. Your <kl-option>s stay where you put them (hidden). The element
 * draws its own listbox in a popover it owns, re-rendered when the options change, so frameworks
 * keep full control of their nodes. Focus stays on the element; aria-activedescendant follows
 * the highlighted option.
 *
 * Keys: Enter/Space/ArrowDown/ArrowUp open. While open: arrows, Home/End, PageUp/PageDown,
 * type-to-find, Enter/Space choose, Escape/Tab close. While closed, typing picks a match
 * directly (like a native select). Fires native-style `input` and `change` on user choice.
 *
 * Use <select class="kl-select"> instead when you want the OS picker (e.g. long lists on phones).
 */
import { FormElement } from '../../core/form-element.js';
import { UIElement } from '../../core/element.js';
export declare class KlOption extends UIElement {
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    /** Text shown in the closed select. */
    get label(): string;
    /** The submitted value: `value`, or the label when no value is set. */
    get optionValue(): any;
    update(): void;
}
export declare class KlSelect extends FormElement {
    #private;
    static properties: {
        value: {
            type: StringConstructor;
            default: string;
        };
        placeholder: {
            type: StringConstructor;
        };
        placement: {
            type: StringConstructor;
            default: string;
        };
        size: {
            type: StringConstructor;
            data: boolean;
            default: string;
        };
    };
    constructor();
    /** The <kl-option> children, in order. */
    get options(): Element[];
    get selectedOption(): Element;
    get open(): boolean;
    connected(): void;
    update(changed: any, first: any): void;
    show(): void;
    hide(): void;
    setCustomValidity(message: any): void;
    formResetCallback(): void;
    formStateRestoreCallback(state: any): void;
}
