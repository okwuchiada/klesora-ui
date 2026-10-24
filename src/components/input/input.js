/**
 * <kl-input>: a form-associated text input.
 *
 *   <kl-input name="email" type="email" required placeholder="you@example.com"></kl-input>
 *   <kl-input name="amount" inputmode="decimal"><span slot="start">₦</span></kl-input>
 *
 * The element is the box. It creates its own <input> (the textbox screen readers see) and never
 * moves your children. The inner input belongs to no form: the element submits through
 * ElementInternals and copies the inner input's native validity (type, pattern, min/max, length).
 * Native `input` and `change` events bubble from the inner input as usual.
 */
import { FormElement } from '../../core/form-element.js';
import { define } from '../../core/element.js';
import { createInnerInput, connectInnerInput, syncInnerAria, copyValidity } from '../../core/inner-control.js';

/** Host property → attribute forwarded to the inner input. */
const FORWARD = {
  type: 'type',
  placeholder: 'placeholder',
  autocomplete: 'autocomplete',
  inputMode: 'inputmode',
  minLength: 'minlength',
  maxLength: 'maxlength',
  pattern: 'pattern',
  readOnly: 'readonly',
  min: 'min',
  max: 'max',
  step: 'step',
  required: 'required',
};

export class KlInput extends FormElement {
  static properties = {
    value: { type: String, default: '' },
    type: { type: String, default: 'text' },
    placeholder: { type: String },
    autocomplete: { type: String },
    inputMode: { type: String, attribute: 'inputmode' },
    minLength: { type: Number, attribute: 'minlength' },
    maxLength: { type: Number, attribute: 'maxlength' },
    pattern: { type: String },
    readOnly: { type: Boolean, attribute: 'readonly', reflect: true },
    min: { type: String },
    max: { type: String },
    step: { type: String },
    size: { type: String, data: true, default: 'md' },
  };

  #input = createInnerInput();
  #customError = '';

  /** The inner <input>, for selection APIs and advanced use. */
  get control() {
    return this.#input;
  }

  connected() {
    if (this.#input.parentNode !== this) this.append(this.#input);
    this.listen(this.#input, 'input', () => (this.value = this.#input.value));
    connectInnerInput(this, this.#input);
  }

  update(changed, first) {
    super.update(changed, first);
    const input = this.#input;
    for (const [prop, attr] of Object.entries(FORWARD)) {
      if (!first && !changed.has(prop)) continue;
      const value = this[prop];
      if (value === null || value === false || value === undefined) input.removeAttribute(attr);
      else input.setAttribute(attr, value === true ? '' : String(value));
    }
    input.disabled = this.isDisabled;
    if (input.value !== this.value) input.value = this.value ?? '';
    this.toggleAttribute('data-filled', Boolean(this.value));

    this.setFormValue(this.value || null);
    copyValidity(this, input, this.#customError);
    syncInnerAria(this, input);
  }

  focus(options) {
    this.#input.focus(options);
  }

  blur() {
    this.#input.blur();
  }

  select() {
    this.#input.select();
  }

  /** Like HTMLInputElement.setCustomValidity: a non-empty message makes the control invalid. */
  setCustomValidity(message) {
    this.#customError = message ?? '';
    this.requestUpdate();
  }

  formResetCallback() {
    this.value = this.getAttribute('value') ?? '';
  }

  formStateRestoreCallback(state) {
    this.value = typeof state === 'string' ? state : '';
  }
}

define('kl-input', KlInput);
