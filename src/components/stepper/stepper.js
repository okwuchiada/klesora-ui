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
import { UIElement, define } from '../../core/element.js';

export class KlStepper extends UIElement {
  /** @type {import('../../core/element.js').PropertyDeclarations} */
  static properties = {
    value: { type: Number, reflect: true, default: 1 },
    orientation: { type: String, data: true, default: 'horizontal' },
    labels: { type: Object, default: () => ({}) },
  };

  connected() {
    this.setAria('role', 'list');
    const observer = new MutationObserver(() => this.requestUpdate());
    observer.observe(this, { childList: true });
    this.addCleanup(() => observer.disconnect());
  }

  update() {
    const steps = [...this.children].filter((c) => c.classList.contains('kl-stepper__step'));
    const current = Math.min(Math.max(1, this.value || 1), steps.length || 1);
    const completed = this.labels?.completed ?? 'Completed';
    steps.forEach((step, i) => {
      const n = i + 1;
      const state = n < current ? 'complete' : n === current ? 'current' : 'upcoming';
      if (!step.hasAttribute('role')) step.setAttribute('role', 'listitem');
      step.dataset.state = state;
      if (state === 'current') step.setAttribute('aria-current', 'step');
      else step.removeAttribute('aria-current');
      if (state === 'complete') step.setAttribute('aria-description', completed);
      else step.removeAttribute('aria-description');
    });
  }
}

define('kl-stepper', KlStepper);
