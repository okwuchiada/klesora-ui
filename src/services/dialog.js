/**
 * dialog: alert, confirm and prompt as Promises, built on native <dialog class="kl-dialog">.
 *
 *   import { dialog } from 'klesora-ui/services/dialog';
 *   if (await dialog.confirm({ title: 'Send ₦45,000 to Ada Obi?', confirmText: 'Send' })) …
 *   const name = await dialog.prompt({ title: 'Rename card', label: 'Card name', defaultValue: 'Travel' });
 *
 * Built from class-layer markup only (no custom elements needed). Focus goes to the safest
 * control (Cancel for tone: 'danger', the field for prompts, otherwise the main button) and
 * returns to where it was when the dialog closes. Escape cancels. The dialog is removed after
 * it closes. Strings default to English; pass your own text for other languages.
 * No side effects on import; nothing touches the DOM until a method is called.
 */

/**
 * @typedef {object} DialogOptions
 * @property {string} [title]
 * @property {string} [message] supporting text under the title
 * @property {string} [confirmText]
 * @property {string} [cancelText]
 * @property {'default' | 'danger'} [tone] danger: red confirm button, Cancel focused first
 * @property {boolean} [dismissible] close on backdrop click (default true; never for prompts)
 * @property {Element} [container] where to put the dialog (default document.body); use a themed
 *   section to inherit its theme, style and brand
 */

/**
 * @typedef {DialogOptions & {
 *   label?: string, defaultValue?: string, placeholder?: string, type?: string,
 *   inputMode?: string, required?: boolean, autocomplete?: string
 * }} PromptOptions
 */

let uid = 0;

const normalise = (input) => (typeof input === 'string' ? { title: input } : { ...input });

const el = (tag, props = {}, ...children) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  node.append(...children.filter(Boolean));
  return node;
};

/**
 * Build, open and resolve one dialog.
 * @param {DialogOptions} options
 * @param {{ kind: 'alert' | 'confirm' | 'prompt', field?: HTMLInputElement, read: (rv: string) => unknown }} spec
 */
function run(options, { kind, field, read }) {
  const id = `kl-dialog-${++uid}`;
  const title = options.title ? el('h2', { class: 'kl-dialog__title', id: `${id}-title` }, options.title) : null;
  const message = options.message ? el('p', { class: 'kl-dialog__description', id: `${id}-desc` }, options.message) : null;
  const danger = options.tone === 'danger';

  const confirm = el(
    'button',
    { class: 'kl-btn', type: 'submit', value: 'confirm', dataset: danger ? { variant: 'danger' } : {} },
    options.confirmText ?? 'OK',
  );
  // type="button" so Enter (implicit submission) always confirms rather than cancels.
  const cancel =
    kind === 'alert'
      ? null
      : el('button', { class: 'kl-btn', type: 'button', value: 'cancel', dataset: { variant: 'outline', klClose: 'cancel' } }, options.cancelText ?? 'Cancel');

  const form = el(
    'form',
    { method: 'dialog' },
    title || message ? el('div', { class: 'kl-dialog__header' }, title, message) : null,
    field ? el('div', { class: 'kl-dialog__body' }, field.closest('.kl-field') ?? field) : null,
    el('div', { class: 'kl-dialog__footer' }, cancel, confirm),
  );

  const dismissible = kind !== 'prompt' && options.dismissible !== false;
  const node = el(
    'dialog',
    {
      class: 'kl-dialog',
      id,
      role: kind === 'alert' || danger ? 'alertdialog' : null,
      'aria-labelledby': title ? title.id : null,
      'aria-describedby': message ? message.id : null,
      'aria-label': title ? null : options.message ?? kind,
      closedby: dismissible ? 'any' : 'closerequest',
      dataset: { size: 'sm' },
    },
    form,
  );

  const previous = document.activeElement;
  (options.container ?? document.body).append(node);

  return new Promise((resolve) => {
    let downOnBackdrop = false;
    const outside = (e) => {
      if (e.target !== node) return false;
      const r = node.getBoundingClientRect();
      return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
    };
    node.addEventListener('pointerdown', (e) => (downOnBackdrop = outside(e)));
    node.addEventListener('click', (e) => {
      if (e.target === cancel) node.close('cancel');
      else if (dismissible && downOnBackdrop && outside(e)) node.close('dismiss');
      downOnBackdrop = false;
    });
    node.addEventListener(
      'close',
      () => {
        resolve(read(node.returnValue));
        if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
        // Let the exit transition finish, then clean up.
        const duration = parseFloat(getComputedStyle(node).transitionDuration) * 1000 || 0;
        setTimeout(() => node.remove(), duration + 50);
      },
      { once: true },
    );
    node.returnValue = '';
    node.showModal();
    const first = field ?? (danger ? cancel : confirm);
    first.focus();
    if (field?.select && field.value) field.select();
  });
}

export const dialog = {
  /**
   * Show a message with one button.
   * @param {string | DialogOptions} options a title, or options
   * @returns {Promise<void>}
   */
  alert(options) {
    return run(normalise(options), { kind: 'alert', read: () => undefined });
  },

  /**
   * Ask a yes/no question.
   * @param {string | DialogOptions} options a title, or options
   * @returns {Promise<boolean>} true only when confirmed (Cancel, Escape and backdrop give false)
   */
  confirm(options) {
    return run(normalise(options), { kind: 'confirm', read: (rv) => rv === 'confirm' });
  },

  /**
   * Ask for a line of text. Native validation (required, type, pattern) blocks confirming.
   * @param {string | PromptOptions} options a title, or options
   * @returns {Promise<string | null>} the text, or null when cancelled
   */
  prompt(options) {
    const o = /** @type {PromptOptions} */ (normalise(options));
    const id = `kl-prompt-${++uid}`;
    const input = el('input', {
      class: 'kl-input',
      id,
      name: 'value',
      type: o.type ?? 'text',
      value: o.defaultValue ?? '',
      placeholder: o.placeholder,
      inputmode: o.inputMode,
      autocomplete: o.autocomplete ?? 'off',
      required: o.required ?? false,
    });
    el('div', { class: 'kl-field' }, el('label', { class: 'kl-field__label', for: id }, o.label ?? o.title ?? 'Value'), input);
    return run(o, { kind: 'prompt', field: input, read: (rv) => (rv === 'confirm' ? input.value : null) });
  },
};
