/**
 * ToggleElement: shared base for <kl-checkbox> and <kl-switch>. The element is the control;
 * its children are the label text, so clicking the text toggles it.
 *
 * Submits `value` (default "on") when checked, like a native checkbox. Fires native-style
 * `input` and `change` events (bubbling) on user toggles. Space toggles; Enter does not.
 */
import { FormElement } from './form-element.js';

/** Localised browser message for a required, unchecked box. */
let requiredMessage = '';
function valueMissingMessage() {
  if (!requiredMessage) {
    const probe = document.createElement('input');
    probe.type = 'checkbox';
    probe.required = true;
    requiredMessage = probe.validationMessage || 'Check this box to continue.';
  }
  return requiredMessage;
}

export class ToggleElement extends FormElement {
  /** @type {import('./element.js').PropertyDeclarations} */
  static properties = {
    checked: { type: Boolean, reflect: true },
    value: { type: String, default: 'on' },
  };

  /** ARIA role of the host; subclasses set 'checkbox' or 'switch'. */
  static role = 'checkbox';

  #defaultChecked = null;
  #customError = '';

  connected() {
    this.setAria('role', this.constructor.role);
    this.#defaultChecked ??= this.hasAttribute('checked');
    this.listen(this, 'click', (e) => this.#onClick(e));
    this.listen(this, 'keydown', (e) => {
      if (e.key === ' ' && e.target === this) e.preventDefault(); // no page scroll
    });
    this.listen(this, 'keyup', (e) => {
      if (e.key === ' ' && e.target === this) this.click();
    });
  }

  update(changed, first) {
    super.update(changed, first);
    this.tabIndex = this.isDisabled ? -1 : 0;
    this.setAria('ariaChecked', this.ariaCheckedState());
    this.setFormValue(this.checked ? this.value : null, this.checked ? 'checked' : null);
    if (this.#customError) this.setValidity({ customError: true }, this.#customError);
    else if (this.required && !this.checked) this.setValidity({ valueMissing: true }, valueMissingMessage());
    else this.setValidity();
  }

  /** @returns {'true' | 'false' | 'mixed'} */
  ariaCheckedState() {
    return this.checked ? 'true' : 'false';
  }

  /** Toggle as a user would: updates state, then fires `input` and `change`. */
  toggle() {
    this.checked = !this.checked;
    this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    this.dispatchEvent(new Event('change', { bubbles: true }));
  }

  #onClick(e) {
    if (this.isDisabled) {
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    // Links and other controls inside the label text keep their own behaviour.
    const inner = e.target.closest('a, button, input, select, textarea');
    if (inner && this.contains(inner)) return;
    this.toggle();
  }

  setCustomValidity(message) {
    this.#customError = message ?? '';
    this.requestUpdate();
  }

  formResetCallback() {
    this.checked = this.#defaultChecked;
  }

  formStateRestoreCallback(state) {
    this.checked = state === 'checked';
  }
}
