/**
 * <kl-button>: the element itself is the button. Your content stays where you put it.
 *
 *   <kl-button variant="outline" size="sm">Cancel</kl-button>
 *   <kl-button type="submit" loading>Pay ₦45,000</kl-button>
 *
 * Inside a form it submits (type="submit", the default, like <button>) or resets (type="reset").
 * For links, use <a class="kl-btn" href="…">; a real link beats a fake one.
 *
 * `popovertarget="id"` (and `popovertargetaction="show|hide|toggle"`) work like on <button>, which
 * the browser only supports natively for built-in buttons:
 *   <kl-button popovertarget="menu">Account</kl-button> <kl-menu id="menu">…</kl-menu>
 */
import { FormElement } from '../../core/form-element.js';
export declare class KlButton extends FormElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    /** Disabled or loading: activation is ignored. */
    get inactive(): any;
    connected(): void;
    update(changed: any, first: any): void;
}
