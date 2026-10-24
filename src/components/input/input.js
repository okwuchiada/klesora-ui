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
import { FormElement, formActions } from '../../core/form-element.js';
import { define } from '../../core/element.js';

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
const ARIA = ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid', 'aria-errormessage'];
const FLAGS = [
  'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
  'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError',
];

let uid = 0;
const ensureId = (el) => (el.id ||= `kl-${++uid}`);

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

  #input = document.createElement('input');
  #customError = '';

  constructor() {
    super();
    // Owned by no form: it must not submit or block submission itself.
    this.#input.setAttribute('form', 'kl-detached');
    this.#input.dataset.klPart = 'control';
  }

  /** The inner <input>, for selection APIs and advanced use. */
  get control() {
    return this.#input;
  }

  connected() {
    if (this.#input.parentNode !== this) this.append(this.#input);
    this.listen(this.#input, 'input', () => (this.value = this.#input.value));
    this.listen(this.#input, 'keydown', (e) => this.#onKeyDown(e));
    this.listen(this, 'click', (e) => {
      if (!e.target.closest('a, button, input, select, textarea, kl-button, [tabindex]')) this.#input.focus();
    });
    this.listen(this, 'focusin', () => this.#syncAria());
    const observer = new MutationObserver(() => this.#syncAria());
    observer.observe(this, { attributes: true, attributeFilter: ARIA });
    this.addCleanup(() => observer.disconnect());
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
    input.setCustomValidity(this.#customError);
    if (input.validity.valid) this.setValidity();
    else this.setValidity(Object.fromEntries(FLAGS.map((f) => [f, input.validity[f]])), input.validationMessage, input);
    this.#syncAria();
  }

  #syncAria() {
    const input = this.#input;
    for (const attr of ARIA) {
      const value = this.getAttribute(attr);
      if (value === null) input.removeAttribute(attr);
      else input.setAttribute(attr, value);
    }
    // <label for="this-id"> names the inner textbox.
    if (!this.hasAttribute('aria-labelledby') && !this.hasAttribute('aria-label') && this.labels?.length) {
      input.setAttribute('aria-labelledby', [...this.labels].map(ensureId).join(' '));
    }
  }

  #onKeyDown(e) {
    // Implicit submission: Enter in a text field submits the form, like a native input.
    if (e.key !== 'Enter' || e.isComposing || !this.form) return;
    setTimeout(() => {
      if (e.defaultPrevented) return;
      const submitter = formActions.find(
        this.form,
        'button:not([type]), button[type="submit"], input[type="submit"], kl-button:not([type="button"], [type="reset"])',
      );
      if (submitter) submitter.click();
      else formActions.submit(this.form);
    });
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
