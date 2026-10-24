/**
 * Dropdown menu.
 *
 *   <button class="kl-btn" popovertarget="acct-menu">Account</button>
 *   <kl-menu id="acct-menu">
 *     <kl-menu-item value="statement">Download statement</kl-menu-item>
 *     <kl-menu-item value="freeze">Freeze card</kl-menu-item>
 *   </kl-menu>
 *
 * Opening and light dismiss (Escape, outside click) come from the native popover API via
 * `popovertarget`. The menu adds:
 * - positioning next to the button that opened it;
 * - aria-haspopup/expanded/controls on that button;
 * - arrow keys, Home/End and type-to-find (ArrowDown/Up on the button opens it too);
 * - closing on Tab;
 * - focus back to the button on close;
 * - a `kl-select` event (detail: { item, value }, cancelable) when an item is chosen.
 *
 * Items: <kl-menu-item>, or any element with class kl-menu__item or a menuitem role
 * (e.g. <button class="kl-menu__item">). Add data-keep-open to an item to keep the menu open.
 * Class layer: <div class="kl-menu" popover data-kl-menu> gets the same behaviour from the
 * data-kl-menu directive (src/directives/menu.js).
 */
import { UIElement } from '../../core/element.js';
export declare const ITEM = "kl-menu-item, .kl-menu__item, [role=\"menuitem\"], [role=\"menuitemcheckbox\"], [role=\"menuitemradio\"]";
/**
 * Attach menu behaviour to a popover panel. Used by <kl-menu> and the data-kl-menu directive.
 * @param {HTMLElement} panel
 * @param {{ signal: AbortSignal, placement?: () => string, onSelect?: (item: Element, value: string | null) => boolean }} options
 *   onSelect returns false when the selection was cancelled.
 */
export declare function menuController(panel: HTMLElement, { signal, placement, onSelect }: {
    signal: AbortSignal;
    placement?: () => string;
    onSelect?: (item: Element, value: string | null) => boolean;
}): void;
export declare class KlMenu extends UIElement {
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    connected(): void;
}
export declare class KlMenuItem extends UIElement {
    static properties: {
        value: {
            type: StringConstructor;
        };
        disabled: {
            type: BooleanConstructor;
            reflect: boolean;
        };
    };
    connected(): void;
    update(): void;
}
