/**
 * Dialog helpers for <dialog class="kl-dialog">. Importing registers both directives.
 *
 *   <kl-button data-kl-dialog-open="transfer">Transfer</kl-button>
 *   <dialog class="kl-dialog" id="transfer" data-kl-dialog aria-labelledby="t-title">
 *     <h2 class="kl-dialog__title" id="t-title">Transfer</h2>
 *     <button class="kl-btn" data-kl-close="cancel">Cancel</button>
 *   </dialog>
 *
 * data-kl-dialog (on the dialog):
 *   - [data-kl-close="value"] buttons inside close it with that returnValue;
 *   - a backdrop click closes it when the dialog has closedby="any" (native in newer browsers,
 *     handled here for the rest). The cancel value is "dismiss".
 * data-kl-dialog-open="id" (on any button) opens that dialog with showModal().
 */
import { registerDirective } from '../core/directives.js';

/** @param {HTMLDialogElement} dialog */
export function mount(dialog) {
  const controller = new AbortController();
  const { signal } = controller;
  let downOnBackdrop = false;
  const onBackdrop = (e) => {
    if (e.target !== dialog) return false;
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  // Press and release both on the backdrop: dragging out of a text field shouldn't close it.
  // Newer browsers close closedby="any" dialogs natively (before our click handler runs), so set
  // the return value at press time; a press inside clears it again.
  dialog.addEventListener(
    'pointerdown',
    (e) => {
      downOnBackdrop = onBackdrop(e);
      const dismissible = dialog.getAttribute('closedby') === 'any';
      if (downOnBackdrop && dismissible) dialog.returnValue = 'dismiss';
      else if (dialog.returnValue === 'dismiss') dialog.returnValue = '';
    },
    { signal },
  );
  dialog.addEventListener(
    'click',
    (e) => {
      const close = e.target.closest('[data-kl-close]');
      if (close && dialog.contains(close)) return dialog.close(close.getAttribute('data-kl-close') || '');
      if (downOnBackdrop && onBackdrop(e) && dialog.getAttribute('closedby') === 'any') dialog.close('dismiss');
      downOnBackdrop = false;
    },
    { signal },
  );
  return () => controller.abort();
}

/** @param {HTMLElement} el @param {string} id */
export function mountOpener(el, id) {
  const controller = new AbortController();
  el.setAttribute('aria-haspopup', 'dialog');
  el.addEventListener(
    'click',
    () => {
      const dialog = document.getElementById(id);
      if (dialog instanceof HTMLDialogElement && !dialog.open) {
        dialog.returnValue = '';
        dialog.showModal();
      }
    },
    { signal: controller.signal },
  );
  return () => controller.abort();
}

registerDirective('dialog', mount);
registerDirective('dialog-open', mountOpener);
