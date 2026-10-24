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
import { FormElement, formActions } from '../../core/form-element.js';
import { define } from '../../core/element.js';
import { press, onPressEnd } from '../../core/press.js';

export class KlButton extends FormElement {
  /** @type {import('../../core/element.js').PropertyDeclarations} */
  static properties = {
    variant: { type: String, data: true, default: 'solid' },
    size: { type: String, data: true, default: 'md' },
    icon: { type: Boolean, data: true },
    loading: { type: Boolean, reflect: true, data: true },
    type: { type: String, default: 'submit' },
    popoverTarget: { type: String, attribute: 'popovertarget' },
    popoverTargetAction: { type: String, attribute: 'popovertargetaction', default: 'toggle' },
  };

  #targetOpenAtPointerDown = false;

  /** Disabled or loading: activation is ignored. */
  get inactive() {
    return this.isDisabled || this.loading;
  }

  connected() {
    this.setAria('role', 'button');
    // Capture phase on the host, so page handlers never see clicks on an inactive button.
    this.listen(this, 'click', (e) => this.#onClick(e), { capture: true });
    this.listen(this, 'keydown', (e) => this.#onKeyDown(e));
    this.listen(this, 'keyup', (e) => this.#onKeyUp(e));
    this.listen(this, 'pointerdown', (e) => {
      if (e.button !== 0 || this.inactive) return;
      press(this, e);
      // Light dismiss closes the popover on this press (we aren't a native invoker); remember
      // it was open so the click doesn't reopen it.
      this.#targetOpenAtPointerDown = Boolean(this.#popoverTarget()?.matches(':popover-open'));
    });
    this.listen(this, 'animationend', onPressEnd);
  }

  update(changed, first) {
    super.update(changed, first);
    this.tabIndex = this.isDisabled ? -1 : 0;
    this.setAria('ariaBusy', this.loading ? 'true' : null);
  }

  #onClick(e) {
    if (this.inactive) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // Run the form action after the whole dispatch (like <button>), and only if no handler
    // prevented it. Not a microtask: browsers run microtasks between listeners for user clicks.
    const targetWasOpen = e.detail > 0 ? this.#targetOpenAtPointerDown : null;
    this.#targetOpenAtPointerDown = false;
    setTimeout(() => {
      if (e.defaultPrevented) return;
      const target = this.#popoverTarget();
      if (target) return this.#togglePopover(target, targetWasOpen);
      if (!this.form) return;
      if (this.type === 'submit') formActions.submit(this.form);
      else if (this.type === 'reset') formActions.reset(this.form);
    });
  }

  #popoverTarget() {
    if (!this.popoverTarget) return null;
    const target = this.getRootNode().getElementById?.(this.popoverTarget) ?? document.getElementById(this.popoverTarget);
    return target?.hasAttribute('popover') ? target : null;
  }

  #togglePopover(target, wasOpen) {
    const open = target.matches(':popover-open');
    const action = this.popoverTargetAction;
    if (action === 'hide' || (action === 'toggle' && (wasOpen ?? open))) {
      if (open) target.hidePopover();
    } else if (!open) {
      target.showPopover();
    }
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
