/**
 * <kl-button>: the element itself is the button. Your content stays where you put it.
 *
 *   <kl-button variant="outline" size="sm">Cancel</kl-button>
 *   <kl-button type="submit" loading>Pay ₦45,000</kl-button>
 *
 * Inside a form it submits (type="submit", the default, like <button>) or resets (type="reset").
 * For links, use <a class="kl-btn" href="…">; a real link beats a fake one.
 */
import { FormElement, formActions } from '../../core/form-element.js';
import { define } from '../../core/element.js';
import { press, onPressEnd } from '../../core/press.js';

export class KlButton extends FormElement {
  static properties = {
    variant: { type: String, data: true, default: 'solid' },
    size: { type: String, data: true, default: 'md' },
    icon: { type: Boolean, data: true },
    loading: { type: Boolean, reflect: true, data: true },
    type: { type: String, default: 'submit' },
  };

  /** Disabled or loading: activation is ignored. */
  get inactive() {
    return this.isDisabled || this.loading;
  }

  connected() {
    this.internals.role = 'button';
    // Capture phase on the host, so page handlers never see clicks on an inactive button.
    this.listen(this, 'click', (e) => this.#onClick(e), { capture: true });
    this.listen(this, 'keydown', (e) => this.#onKeyDown(e));
    this.listen(this, 'keyup', (e) => this.#onKeyUp(e));
    this.listen(this, 'pointerdown', (e) => e.button === 0 && !this.inactive && press(this, e));
    this.listen(this, 'animationend', onPressEnd);
  }

  update(changed, first) {
    super.update(changed, first);
    this.tabIndex = this.isDisabled ? -1 : 0;
    this.internals.ariaBusy = this.loading ? 'true' : null;
  }

  #onClick(e) {
    if (this.inactive) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // Run the form action after the whole dispatch (like <button>), and only if no handler
    // prevented it. Not a microtask: browsers run microtasks between listeners for user clicks.
    setTimeout(() => {
      if (e.defaultPrevented || !this.form) return;
      if (this.type === 'submit') formActions.submit(this.form);
      else if (this.type === 'reset') formActions.reset(this.form);
    });
  }

  #onKeyDown(e) {
    if (e.target !== this || this.inactive) return;
    if (e.key === 'Enter' && !e.repeat) {
      e.preventDefault();
      press(this, e);
      this.click();
    } else if (e.key === ' ') {
      e.preventDefault(); // no page scroll; activate on keyup, like <button>
      if (!e.repeat) press(this, e);
    }
  }

  #onKeyUp(e) {
    if (e.target === this && e.key === ' ' && !this.inactive) this.click();
  }
}

define('kl-button', KlButton);
