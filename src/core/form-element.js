/**
 * FormElement: base class for form controls. Form-associated through ElementInternals,
 * so the control submits with native <form>s, resets, restores, validates, and is disabled
 * by a disabled <fieldset>, which also makes it work with framework form libraries.
 *
 * Mirrors the effective disabled state (own or fieldset) as `data-disabled` for CSS.
 *
 * Subclasses own `value`. In `update()`, call `super.update(changed, first)` and then
 * `this.setFormValue(...)` / `this.setValidity(...)` as needed. Implement the standard
 * `formResetCallback()` and `formStateRestoreCallback(state)` to support reset and restore.
 */
import { UIElement } from './element.js';

const FORM_DISABLED = Symbol('formDisabled');

/**
 * Call form methods through the prototype: a control named or id'd "reset", "requestSubmit"
 * or "querySelector" replaces the method on the form object (DOM clobbering).
 */
export const formActions = {
  /** @param {HTMLFormElement} form */
  submit: (form) => HTMLFormElement.prototype.requestSubmit.call(form),
  /** @param {HTMLFormElement} form */
  reset: (form) => HTMLFormElement.prototype.reset.call(form),
  /** @param {HTMLFormElement} form @param {string} selector */
  find: (form, selector) => Element.prototype.querySelector.call(form, selector),
};

export class FormElement extends UIElement {
  static formAssociated = true;

  /** @type {import('./element.js').PropertyDeclarations} */
  static properties = {
    name: { type: String, reflect: true },
    disabled: { type: Boolean, reflect: true },
    required: { type: Boolean, reflect: true },
  };

  constructor() {
    super();
    this[FORM_DISABLED] = false;
  }

  /** True when this control or an ancestor <fieldset> is disabled. */
  get isDisabled() {
    return this.disabled || this[FORM_DISABLED];
  }

  get form() {
    return this.internals.form;
  }

  get labels() {
    return this.internals.labels;
  }

  get validity() {
    return this.internals.validity;
  }

  get validationMessage() {
    return this.internals.validationMessage;
  }

  get willValidate() {
    return this.internals.willValidate;
  }

  checkValidity() {
    return this.internals.checkValidity();
  }

  reportValidity() {
    return this.internals.reportValidity();
  }

  /**
   * Set the submitted value (null submits nothing) and the state restored on back/forward navigation.
   * @param {string | File | FormData | null} value
   * @param {string | File | FormData | null} [state]
   */
  setFormValue(value, state = value) {
    this.internals.setFormValue(value, state);
  }

  /**
   * Set validity. Pass {} or nothing to mark the control valid.
   * @param {ValidityStateFlags} [flags]
   * @param {string} [message] required when any flag is true
   * @param {HTMLElement} [anchor] element the browser points its validation bubble at
   */
  setValidity(flags = {}, message, anchor) {
    this.internals.setValidity(flags, message, anchor);
  }

  formDisabledCallback(disabled) {
    this[FORM_DISABLED] = disabled;
    this.requestUpdate('isDisabled', !disabled);
  }

  update(changed, first) {
    if (first || changed.has('disabled') || changed.has('isDisabled')) {
      this.setAria('ariaDisabled', this.isDisabled ? 'true' : null);
      // CSS can't see a disabled <fieldset> ancestor, so mirror the effective state.
      this.toggleAttribute('data-disabled', this.isDisabled);
    }
    if (first || changed.has('required')) {
      this.setAria('ariaRequired', this.required ? 'true' : null);
    }
  }
}
