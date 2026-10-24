/**
 * <kl-otp-input>: one-time codes and PINs, drawn as boxes over a single real input.
 *
 *   <kl-otp-input name="code" length="6" required></kl-otp-input>
 *   <kl-otp-input name="pin" length="4" mask></kl-otp-input>
 *
 * Because it's one <input> underneath, SMS code autofill (autocomplete="one-time-code" on iOS
 * and Android), paste, password managers and screen readers treat it as a single field.
 * - `type="numeric"` (default) keeps digits; `type="alphanumeric"` keeps letters and digits.
 * - `mask` shows dots and makes the input a password field, so the code isn't read aloud.
 * - Fires `kl-complete` (detail: { value }) when every box is filled, plus native input/change.
 * - Required and partly-filled codes are invalid (valueMissing / tooShort).
 */
import { FormElement } from '../../core/form-element.js';
import { define } from '../../core/element.js';
import { createInnerInput, connectInnerInput, syncInnerAria } from '../../core/inner-control.js';

export class KlOtpInput extends FormElement {
  static properties = {
    value: { type: String, default: '' },
    length: { type: Number, default: 6 },
    type: { type: String, default: 'numeric' },
    mask: { type: Boolean, reflect: true },
    autocomplete: { type: String, default: 'one-time-code' },
  };

  #input = createInnerInput();
  #slots = document.createElement('div');
  #customError = '';
  #completed = '';

  constructor() {
    super();
    this.#input.spellcheck = false;
    this.#input.setAttribute('autocorrect', 'off');
    this.#input.setAttribute('autocapitalize', 'characters');
    this.#slots.dataset.klPart = 'slots';
    this.#slots.setAttribute('aria-hidden', 'true');
  }

  get control() {
    return this.#input;
  }

  connected() {
    if (this.#slots.parentNode !== this) this.append(this.#slots);
    if (this.#input.parentNode !== this) this.append(this.#input);
    this.listen(this.#input, 'input', () => this.#onInput());
    // Always type at the end: boxes fill left to right.
    const toEnd = () => requestAnimationFrame(() => this.#input.setSelectionRange(this.#input.value.length, this.#input.value.length));
    this.listen(this.#input, 'focus', () => {
      toEnd();
      this.toggleAttribute('data-focused', true);
      this.#renderSlots();
    });
    this.listen(this.#input, 'blur', () => {
      this.removeAttribute('data-focused');
      this.#renderSlots();
    });
    this.listen(this.#input, 'select', toEnd);
    this.listen(this.#input, 'pointerup', toEnd);
    connectInnerInput(this, this.#input);
  }

  update(changed, first) {
    super.update(changed, first);
    const input = this.#input;
    const length = Math.max(1, this.length || 6);
    input.type = this.mask ? 'password' : 'text';
    input.inputMode = this.type === 'alphanumeric' ? 'text' : 'numeric';
    // Attribute, not property: browsers that don't know a token (Firefox: one-time-code) read it back as ''.
    input.setAttribute('autocomplete', this.mask ? 'off' : this.autocomplete);
    input.maxLength = length;
    input.disabled = this.isDisabled;
    input.required = this.required;
    if (!input.hasAttribute('aria-description')) input.setAttribute('aria-description', `${length} ${this.type === 'alphanumeric' ? 'characters' : 'digits'}`);
    const clean = this.#clean(this.value);
    if (clean !== this.value) this.value = clean;
    if (input.value !== clean) input.value = clean;
    this.#renderSlots();

    this.setFormValue(clean || null);
    if (this.#customError) this.setValidity({ customError: true }, this.#customError, input);
    else if (this.required && !clean) this.setValidity({ valueMissing: true }, `Enter the ${length}-digit code.`.replace('digit', this.type === 'alphanumeric' ? 'character' : 'digit'), input);
    else if (clean && clean.length < length) this.setValidity({ tooShort: true }, `Enter all ${length} ${this.type === 'alphanumeric' ? 'characters' : 'digits'}.`, input);
    else this.setValidity();
    syncInnerAria(this, input);
  }

  #clean(text) {
    const pattern = this.type === 'alphanumeric' ? /[^\p{L}\p{N}]/gu : /\D/g;
    return String(text ?? '').replace(pattern, '').slice(0, Math.max(1, this.length || 6));
  }

  #renderSlots() {
    const length = Math.max(1, this.length || 6);
    const chars = [...(this.value ?? '')];
    const active = this.hasAttribute('data-focused') ? Math.min(chars.length, length - 1) : -1;
    if (this.#slots.children.length !== length) {
      this.#slots.replaceChildren(...Array.from({ length }, () => Object.assign(document.createElement('span'), { className: 'kl-otp__slot' })));
    }
    [...this.#slots.children].forEach((slot, i) => {
      slot.textContent = chars[i] ? (this.mask ? '•' : chars[i]) : '';
      slot.toggleAttribute('data-filled', Boolean(chars[i]));
      slot.toggleAttribute('data-active', i === active);
    });
  }

  #onInput() {
    const clean = this.#clean(this.#input.value);
    if (this.#input.value !== clean) this.#input.value = clean;
    this.value = clean;
    this.#renderSlots();
    const length = Math.max(1, this.length || 6);
    if (clean.length === length && clean !== this.#completed) {
      this.#completed = clean;
      this.emit('kl-complete', { value: clean });
    } else if (clean.length < length) {
      this.#completed = '';
    }
  }

  focus(options) {
    this.#input.focus(options);
  }

  /** Clear the code (e.g. after a wrong attempt) and focus the first box. */
  clear() {
    this.value = '';
    this.#input.value = '';
    this.#completed = '';
    this.#input.focus();
  }

  setCustomValidity(message) {
    this.#customError = message ?? '';
    this.requestUpdate();
  }

  formResetCallback() {
    this.value = '';
    this.#completed = '';
  }

  formStateRestoreCallback(state) {
    this.value = typeof state === 'string' ? state : '';
  }
}

define('kl-otp-input', KlOtpInput);
