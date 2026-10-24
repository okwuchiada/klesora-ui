/**
 * <kl-stepper>: step indicator for multi-step flows. Your app moves between steps.
 *
 *   <kl-stepper value="2" aria-label="Transfer">
 *     <div class="kl-stepper__step">Recipient</div>
 *     <div class="kl-stepper__step">Amount <span class="kl-stepper__description">₦ and narration</span></div>
 *     <div class="kl-stepper__step">Confirm</div>
 *   </kl-stepper>
 *
 * `value` is the current step number (1-based). Steps before it get data-state="complete" (and
 * aria-description "Completed"), the current one data-state="current" + aria-current="step", the rest
 * "upcoming". The host is a list (role="list"), each step a listitem. Your elements stay in place.
 * `labels.completed` overrides "Completed".
 */
import { UIElement } from '../../core/element.js';
export declare class KlStepper extends UIElement {
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    connected(): void;
    update(): void;
}
