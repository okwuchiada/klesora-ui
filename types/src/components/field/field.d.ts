/**
 * <kl-field>: label + control + hint + error, wired together.
 *
 *   <kl-field>
 *     <label>Email</label>
 *     <kl-input name="email" type="email" required></kl-input>
 *     <p slot="hint">We'll send the receipt here.</p>
 *   </kl-field>
 *
 * - Finds its parts and never moves them: the first label, the first control (kl-input, kl-checkbox,
 *   kl-switch, input, select, textarea or [data-kl-control]), [slot="hint"] and [slot="error"].
 *   It marks them with data-kl-part and connects ids, `for` and `aria-describedby`.
 * - Errors show inline after the user leaves the field or tries to submit, using the control's
 *   validation message (or your [slot="error"] text). The browser's bubble is suppressed for
 *   controls inside a field; the first invalid control is focused on a submit attempt.
 * - `error="…"` shows a message right away (e.g. from the server) and makes the control invalid
 *   until it is cleared.
 * Reflects data-invalid, data-required, data-disabled and data-filled for styling.
 */
import { UIElement } from '../../core/element.js';
export declare class KlField extends UIElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    /** The wired control, if any. */
    get control(): any;
    connected(): void;
    update(changed: any): void;
}
