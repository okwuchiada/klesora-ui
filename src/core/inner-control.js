/**
 * Shared plumbing for elements that wrap their own inner <input> (kl-input, kl-amount-input,
 * kl-otp-input):
 * - forwards aria-label/-labelledby/-describedby/-invalid/-errormessage from the host;
 * - names the inner input from the host's <label for> (aria-labelledby);
 * - Enter submits the form (implicit submission), like a native text field;
 * - the inner input belongs to no form, so it never submits or blocks submission itself.
 */
import { formActions } from './form-element.js';

export const FORWARDED_ARIA = ['aria-label', 'aria-labelledby', 'aria-describedby', 'aria-invalid', 'aria-errormessage'];
export const VALIDITY_FLAGS = [
  'valueMissing', 'typeMismatch', 'patternMismatch', 'tooLong', 'tooShort',
  'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError',
];

let uid = 0;
const ensureId = (el) => (el.id ||= `kl-${++uid}`);

/** Prepare an inner input: owned by no form, marked as the control part. */
export function createInnerInput() {
  const input = document.createElement('input');
  input.setAttribute('form', 'kl-detached');
  input.dataset.klPart = 'control';
  return input;
}

/** Copy the host's ARIA attributes to the inner input and name it from the host's labels. */
export function syncInnerAria(host, input) {
  for (const attr of FORWARDED_ARIA) {
    const value = host.getAttribute(attr);
    if (value === null) input.removeAttribute(attr);
    else input.setAttribute(attr, value);
  }
  if (!host.hasAttribute('aria-labelledby') && !host.hasAttribute('aria-label') && host.labels?.length) {
    input.setAttribute('aria-labelledby', [...host.labels].map(ensureId).join(' '));
  }
}

/**
 * Wire an inner input to its host while connected (call from `connected()`).
 * @param {import('./form-element.js').FormElement} host
 * @param {HTMLInputElement} input
 */
export function connectInnerInput(host, input) {
  host.listen(host, 'focusin', () => syncInnerAria(host, input));
  host.listen(host, 'click', (e) => {
    if (!e.target.closest('a, button, input, select, textarea, kl-button, [tabindex]')) input.focus();
  });
  host.listen(input, 'keydown', (e) => {
    // Implicit submission: Enter in a text field submits the form.
    if (e.key !== 'Enter' || e.isComposing || !host.form) return;
    setTimeout(() => {
      if (e.defaultPrevented) return;
      const submitter = formActions.find(
        host.form,
        'button:not([type]), button[type="submit"], input[type="submit"], kl-button:not([type="button"], [type="reset"])',
      );
      if (submitter) submitter.click();
      else formActions.submit(host.form);
    });
  });
  const observer = new MutationObserver(() => syncInnerAria(host, input));
  observer.observe(host, { attributes: true, attributeFilter: FORWARDED_ARIA });
  host.addCleanup(() => observer.disconnect());
}

/** Copy the inner input's validity (plus an optional custom error) onto the host. */
export function copyValidity(host, input, customError = '') {
  input.setCustomValidity(customError);
  if (input.validity.valid) host.setValidity();
  else host.setValidity(Object.fromEntries(VALIDITY_FLAGS.map((f) => [f, input.validity[f]])), input.validationMessage, input);
}
