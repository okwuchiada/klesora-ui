/**
 * <kl-field>: label + control + hint + error, wired together.
 *
 *   <kl-field>
 *     <label>Email</label>
 *     <kl-input name="email" type="email" required></kl-input>
 *     <p slot="hint">We'll send the receipt here.</p>
 *   </kl-field>
 *
 * - Finds its parts and never moves them: the first label, the first control (kl-input, kl-checkbox,
 *   kl-switch, input, select, textarea or [data-kl-control]), [slot="hint"] and [slot="error"].
 *   It marks them with data-kl-part and connects ids, `for` and `aria-describedby`.
 * - Errors show inline after the user leaves the field or tries to submit, using the control's
 *   validation message (or your [slot="error"] text). The browser's bubble is suppressed for
 *   controls inside a field; the first invalid control is focused on a submit attempt.
 * - `error="…"` shows a message right away (e.g. from the server) and makes the control invalid
 *   until it is cleared.
 * Reflects data-invalid, data-required, data-disabled and data-filled for styling.
 */
import { UIElement, define } from '../../core/element.js';

const CONTROL = 'kl-input, kl-checkbox, kl-switch, input:not([type="hidden"]), select, textarea, [data-kl-control]';
const TEXT_CONTROL = 'kl-input, input:not([type="checkbox"], [type="radio"], [type="range"], [type="color"], [type="file"]), select, textarea';
const ATTEMPT = Symbol('submitAttempt');

let uid = 0;
const ensureId = (el, prefix) => (el.id ||= `kl-${prefix}-${++uid}`);
let focusQueued = null;

export class KlField extends UIElement {
  static properties = {
    error: { type: String },
  };

  #control = null;
  #label = null;
  #hint = null;
  #error = null;
  #ownError = null; // the error element we created, if the author gave none
  #authorErrorText = '';
  #authorDescribedBy = '';
  #touched = false;

  /** The wired control, if any. */
  get control() {
    return this.#control;
  }

  connected() {
    this.#wire();
    const observer = new MutationObserver(() => this.#wire());
    observer.observe(this, { childList: true, subtree: true });
    this.addCleanup(() => observer.disconnect());

    this.listen(this, 'focusout', (e) => {
      if (!this.#control?.contains(e.target) || this.#control.contains(e.relatedTarget)) return;
      this.#touched = true;
      this.#refreshSoon();
    });
    this.listen(this, 'input', () => this.#refreshSoon());
    this.listen(this, 'change', () => this.#refreshSoon());
    // `invalid` doesn't bubble: catch it on the way down.
    this.listen(this, 'invalid', (e) => this.#onInvalid(e), { capture: true });

    const form = this.closest('form');
    if (form) {
      const mark = () => (form[ATTEMPT] = performance.now());
      this.listen(form, 'click', mark, { capture: true });
      this.listen(form, 'keydown', (e) => e.key === 'Enter' && mark(), { capture: true });
      this.listen(form, 'reset', () => {
        this.#touched = false;
        setTimeout(() => this.#refresh());
      });
    }
  }

  update(changed) {
    if (changed.has('error')) {
      this.#control?.setCustomValidity?.(this.error || '');
    }
    this.#refreshSoon();
  }

  #wire() {
    const control = this.querySelector(CONTROL);
    const label = [...this.querySelectorAll('label, [slot="label"]')].find((l) => !control?.contains(l)) ?? null;
    const hint = this.querySelector('[slot="hint"]');
    const error = this.querySelector('[slot="error"]') ?? this.#ownError;
    if (control === this.#control && label === this.#label && hint === this.#hint && error === this.#error && error) return;

    if (control !== this.#control) {
      this.#authorDescribedBy = control?.getAttribute('aria-describedby') ?? '';
      if (this.error) control?.setCustomValidity?.(this.error);
    }
    this.#control = control;
    this.#label = label;
    this.#hint = hint;

    if (!error) {
      this.#ownError = document.createElement('p');
      this.#ownError.hidden = true;
      this.append(this.#ownError); // adds a node at the end; nothing of yours moves
      this.#error = this.#ownError;
    } else if (error !== this.#error) {
      this.#error = error;
      this.#authorErrorText = error === this.#ownError ? '' : error.textContent.trim();
    }

    for (const [el, part] of [[control, 'control'], [label, 'label'], [hint, 'hint'], [this.#error, 'error']]) {
      if (el && el.dataset.klPart !== part) el.dataset.klPart = part;
    }
    this.#error.setAttribute('aria-live', 'polite');
    ensureId(this.#error, 'error');
    if (hint) ensureId(hint, 'hint');
    if (control) {
      ensureId(control, 'control');
      if (label?.localName === 'label' && !label.contains(control)) label.htmlFor = control.id;
      this.dataset.control = control.matches(TEXT_CONTROL) ? 'text' : 'choice';
    }
    this.#refresh();
  }

  #onInvalid(e) {
    if (!this.#control?.contains(e.target) && e.target !== this.#control) return;
    e.preventDefault(); // inline message instead of the browser bubble
    this.#touched = true;
    this.#refresh();
    // On a submit attempt, focus the first invalid control (what the browser would have done).
    const form = this.closest('form');
    if (form && performance.now() - (form[ATTEMPT] ?? -Infinity) < 1000 && !focusQueued) {
      focusQueued = this.#control;
      setTimeout(() => {
        focusQueued?.focus();
        focusQueued = null;
      });
    }
  }

  /** Controls update their validity in a microtask; read it after that. */
  #refreshSoon() {
    Promise.resolve(this.#control?.updateComplete).then(() => this.#refresh());
  }

  #refresh() {
    const control = this.#control;
    if (!control || !this.#error) return;
    const invalid = control.validity ? !control.validity.valid : false;
    const message = this.error || (this.#touched && invalid ? this.#authorErrorText || control.validationMessage : '');
    const showing = Boolean(message);

    if (this.#error === this.#ownError || !this.#authorErrorText) {
      if (this.#error.textContent !== message) this.#error.textContent = message;
    }
    this.#error.hidden = !showing;

    const ids = [this.#authorDescribedBy, this.#hint?.id, showing ? this.#error.id : '']
      .filter(Boolean)
      .join(' ');
    if (ids) control.setAttribute('aria-describedby', ids);
    else control.removeAttribute('aria-describedby');
    if (showing) control.setAttribute('aria-invalid', 'true');
    else control.removeAttribute('aria-invalid');

    const required = control.required ?? control.hasAttribute('required');
    const disabled = control.isDisabled ?? control.disabled ?? false;
    const value = control.localName === 'select' ? 'x' : control.value;
    this.toggleAttribute('data-invalid', showing);
    this.toggleAttribute('data-required', Boolean(required));
    this.toggleAttribute('data-disabled', Boolean(disabled));
    this.toggleAttribute('data-filled', this.dataset.control === 'text' && Boolean(value));
  }
}

define('kl-field', KlField);
