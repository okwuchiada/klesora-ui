/**
 * <kl-amount-input>: money entry with live, locale-aware formatting.
 *
 *   <kl-amount-input name="amount" currency="NGN" min="100" max="5000000" required></kl-amount-input>
 *   <kl-amount-input currency="USD" locale="en-US" value="12.5"></kl-amount-input>
 *
 * - `value` is an exact decimal string in the main unit ("45000.50"), never a float. It's what the
 *   form submits (padded to the currency's decimals). `minorUnits` gives integer kobo/cents
 *   (a Number, or a BigInt beyond Number.MAX_SAFE_INTEGER); `valueAsNumber` is for display maths.
 * - Thousands separators appear as you type and the caret stays put; decimals pad on blur.
 *   Paste "₦45,000.00" and it becomes 45000.00. The currency's own decimals apply (₦ 2, ¥ 0).
 * - The currency symbol sits where the locale puts it (₦45,000 / 45.000 €). Screen readers hear
 *   the currency name, not the symbol.
 * - min / max / required validate with messages that include the formatted limits.
 *   `allow-negative` permits a leading minus.
 */
import { FormElement } from '../../core/form-element.js';
import { define } from '../../core/element.js';
import { createInnerInput, connectInnerInput, syncInnerAria } from '../../core/inner-control.js';
import {
  compareDecimal,
  currencyDigits,
  currencySymbol,
  defaultLocale,
  fixDecimal,
  formatMoney,
  groupInteger,
  normalizeDecimal,
  separators,
  toMinor,
} from '../../core/money.js';

export class KlAmountInput extends FormElement {
  static properties = {
    value: { type: String, default: '' },
    currency: { type: String, default: 'NGN' },
    locale: { type: String },
    min: { type: String },
    max: { type: String },
    placeholder: { type: String },
    allowNegative: { type: Boolean, attribute: 'allow-negative' },
    readOnly: { type: Boolean, attribute: 'readonly', reflect: true },
    size: { type: String, data: true, default: 'md' },
  };

  #input = createInnerInput();
  #symbol = document.createElement('span');
  #customError = '';
  #defaultValue = null;

  constructor() {
    super();
    this.#input.inputMode = 'decimal';
    this.#input.autocomplete = 'off';
    this.#input.setAttribute('autocorrect', 'off');
    this.#input.spellcheck = false;
    this.#symbol.dataset.klPart = 'currency';
    this.#symbol.setAttribute('aria-hidden', 'true');
  }

  get control() {
    return this.#input;
  }

  get #loc() {
    return this.locale || defaultLocale();
  }

  get #digits() {
    return currencyDigits(this.currency);
  }

  /** Integer minor units (kobo, cents), or null when empty. BigInt only beyond MAX_SAFE_INTEGER. */
  get minorUnits() {
    const minor = toMinor(this.value, this.#digits);
    if (minor === null) return null;
    return minor <= BigInt(Number.MAX_SAFE_INTEGER) && minor >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(minor) : minor;
  }

  set minorUnits(units) {
    const big = BigInt(units);
    const digits = this.#digits;
    const negative = big < 0n;
    const text = (negative ? -big : big).toString().padStart(digits + 1, '0');
    this.value = `${negative ? '-' : ''}${digits ? `${text.slice(0, -digits)}.${text.slice(-digits)}` : text}`;
  }

  /** The value as a Number (for display maths only), or NaN when empty. */
  get valueAsNumber() {
    return this.value ? Number(this.value) : NaN;
  }

  connected() {
    if (this.#defaultValue === null) this.#defaultValue = this.getAttribute('value') ?? '';
    if (this.#input.parentNode !== this) this.append(this.#input);
    if (this.#symbol.parentNode !== this) this.prepend(this.#symbol);
    this.listen(this.#input, 'beforeinput', (e) => this.#onBeforeInput(e));
    this.listen(this.#input, 'input', (e) => this.#onInput(e));
    this.listen(this.#input, 'blur', () => this.#onBlur());
    connectInnerInput(this, this.#input);
  }

  update(changed, first) {
    super.update(changed, first);
    const input = this.#input;
    const loc = this.#loc;
    if (first || changed.has('currency') || changed.has('locale')) {
      const { symbol, position, name } = currencySymbol(this.currency, loc);
      this.#symbol.textContent = symbol;
      this.#symbol.slot = position;
      input.setAttribute('aria-description', name);
    }
    input.disabled = this.isDisabled;
    input.readOnly = this.readOnly;
    input.required = this.required;
    input.placeholder = this.placeholder ?? groupInteger('0', loc) + (this.#digits ? separators(loc).decimal + '0'.repeat(this.#digits) : '');
    // Not while typing: the input event already wrote the live text.
    if (document.activeElement !== input) input.value = this.#display(this.value, true);
    this.toggleAttribute('data-filled', Boolean(this.value));

    const canonical = this.value ? fixDecimal(this.value, this.#digits) : '';
    this.setFormValue(canonical || null);
    this.#validate();
    syncInnerAria(this, input);
  }

  /** Locale text for a decimal string; `pad` fills the decimals ("45000" → "45,000.00"). */
  #display(value, pad) {
    const n = normalizeDecimal(value);
    if (!n) return '';
    const { decimal } = separators(this.#loc);
    const fixed = pad ? fixDecimal(n, this.#digits) : n;
    const negative = fixed.startsWith('-');
    const [int, frac] = fixed.replace('-', '').split('.');
    return `${negative ? '-' : ''}${groupInteger(int, this.#loc)}${frac !== undefined ? decimal + frac : ''}`;
  }

  /** Backspace just after a group separator deletes the digit before it (not the separator). */
  #onBeforeInput(e) {
    const input = this.#input;
    const { group } = separators(this.#loc);
    const at = input.selectionStart;
    if (e.inputType !== 'deleteContentBackward' || at !== input.selectionEnd || !at) return;
    // The locale's separator, plus the no-break spaces French and others use for grouping.
    const groupChars = [group, '\u00a0', '\u202f'];
    if (!groupChars.includes(input.value[at - 1]) || at < 2) return;
    e.preventDefault();
    input.value = input.value.slice(0, at - 2) + input.value.slice(at);
    input.setSelectionRange(at - 2, at - 2);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true, inputType: 'deleteContentBackward' }));
  }

  #onInput(e) {
    const input = this.#input;
    const { decimal } = separators(this.#loc);
    const raw = input.value;
    const caret = input.selectionStart ?? raw.length;
    const digits = this.#digits;
    const significant = (ch) => /\d/.test(ch) || ch === decimal || ch === '-';

    // Keep only digits, the first decimal separator (if the currency has decimals) and a leading minus.
    let int = '';
    let frac = '';
    let seenDecimal = false;
    let negative = false;
    let before = 0; // significant characters before the caret, counted in the cleaned text
    [...raw].forEach((ch, i) => {
      let kept = false;
      if (/\d/.test(ch)) {
        if (seenDecimal) {
          if (frac.length < digits) (frac += ch), (kept = true);
        } else (int += ch), (kept = true);
      } else if (ch === decimal && digits > 0 && !seenDecimal) {
        seenDecimal = kept = true;
      } else if (ch === '-' && this.allowNegative && !negative && !int && !seenDecimal) {
        negative = kept = true;
      }
      if (kept && i < caret) before++;
    });
    const trimmed = int.replace(/^0+(?=\d)/, '');
    before -= int.length - trimmed.length;

    const text = `${negative ? '-' : ''}${trimmed ? groupInteger(trimmed, this.#loc) : seenDecimal ? '0' : ''}${seenDecimal ? decimal + frac : ''}`;
    if (!trimmed && seenDecimal) before++; // the "0" we inserted before the separator
    input.value = text;
    // Put the caret after the same number of significant characters.
    let pos = 0;
    for (let seen = 0; pos < text.length && seen < before; pos++) if (significant(text[pos])) seen++;
    if (e.inputType !== 'insertReplacementText') input.setSelectionRange(pos, pos);

    const next = trimmed || seenDecimal ? `${negative ? '-' : ''}${trimmed || '0'}${seenDecimal ? `.${frac}` : ''}` : '';
    this.value = next;
  }

  #onBlur() {
    if (this.value) this.value = fixDecimal(this.value, this.#digits);
    this.#input.value = this.#display(this.value, true);
  }

  #validate() {
    const money = (v) => formatMoney(v, { locale: this.#loc, currency: this.currency });
    let flags = {};
    let message = '';
    if (this.#customError) [flags, message] = [{ customError: true }, this.#customError];
    else if (this.required && !this.value) [flags, message] = [{ valueMissing: true }, 'Enter an amount.'];
    else if (this.value && this.min && compareDecimal(this.value, this.min) < 0) [flags, message] = [{ rangeUnderflow: true }, `Enter at least ${money(this.min)}.`];
    else if (this.value && this.max && compareDecimal(this.value, this.max) > 0) [flags, message] = [{ rangeOverflow: true }, `Enter no more than ${money(this.max)}.`];
    if (message) this.setValidity(flags, message, this.#input);
    else this.setValidity();
  }

  focus(options) {
    this.#input.focus(options);
  }

  blur() {
    this.#input.blur();
  }

  /** A non-empty message makes the control invalid (e.g. "Insufficient balance"). */
  setCustomValidity(message) {
    this.#customError = message ?? '';
    this.requestUpdate();
  }

  formResetCallback() {
    this.value = this.#defaultValue ?? '';
    this.#input.value = this.#display(this.value, true);
  }

  formStateRestoreCallback(state) {
    this.value = typeof state === 'string' ? state : '';
  }
}

define('kl-amount-input', KlAmountInput);
