/**
 * toast: short, non-blocking notifications.
 *
 *   import { toast } from 'klesora-ui/services/toast';
 *   toast.success('Payment sent', { description: '₦45,000 to Ada Obi' });
 *   const t = toast('Uploading statement…', { duration: Infinity });
 *   t.update({ message: 'Statement uploaded', tone: 'success', duration: 4000 });
 *   toast.error('Transfer failed', { action: { label: 'Retry', onClick: retry } });
 *
 * - Announced to screen readers: role="status" (polite); errors use role="alert".
 * - Timers pause while the pointer is over the toasts or focus is inside (WCAG 2.2.1), and
 *   when the page is hidden. Default duration 5s (errors 8s); Infinity keeps it until dismissed.
 * - Each style places and draws toasts its own way (tokens); phones always get full-width,
 *   bottom-centre toasts. toast.configure({ position }) overrides the placement.
 * - Rendered in a top-layer popover, so toasts stay above dialogs opened earlier, and are
 *   brought to the front when a new toast arrives.
 * No side effects on import; nothing touches the DOM until a toast is shown.
 */

/**
 * @typedef {'neutral' | 'info' | 'success' | 'warning' | 'danger'} Tone
 * @typedef {object} ToastOptions
 * @property {string} [message] the main line (when updating)
 * @property {string} [description]
 * @property {Tone} [tone]
 * @property {number} [duration] milliseconds; Infinity = until dismissed
 * @property {{ label: string, onClick: (toast: ToastHandle) => void | boolean }} [action]
 *   onClick returning false keeps the toast open
 * @property {boolean} [dismissible] show a close button (default true)
 * @property {string} [id] reuse an id to update an existing toast instead of adding one
 * @property {string} [dismissLabel] accessible name of the close button (default "Dismiss")
 */

/**
 * @typedef {object} ToastHandle
 * @property {string} id
 * @property {(options: ToastOptions) => void} update
 * @property {() => void} dismiss
 */

const config = {
  position: /** @type {null | 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end'} */ (null),
  max: 3,
  container: /** @type {Element | null} */ (null),
  label: 'Notifications',
};

/** @type {Map<string, { node: HTMLElement, options: ToastOptions, remaining: number, timer: number, started: number }>} */
const live = new Map();
let region = null;
let paused = false;
let uid = 0;

function ensureRegion() {
  if (!region) {
    region = document.createElement('section');
    region.className = 'kl-toaster';
    region.setAttribute('popover', 'manual');
    region.setAttribute('aria-label', config.label);
    const pause = (on) => {
      paused = on;
      for (const entry of live.values()) on ? stopTimer(entry) : startTimer(entry);
    };
    region.addEventListener('pointerenter', () => pause(true));
    region.addEventListener('pointerleave', () => !region.contains(document.activeElement) && pause(false));
    region.addEventListener('focusin', () => pause(true));
    region.addEventListener('focusout', (e) => !region.contains(e.relatedTarget) && pause(false));
    document.addEventListener('visibilitychange', () => pause(document.hidden));
  }
  if (config.position) region.dataset.position = config.position;
  else delete region.dataset.position;
  // A modal dialog makes everything outside it inert, even popovers drawn on top of it. Put the
  // toaster inside the topmost modal so its buttons work, and move it back when that closes.
  const modals = [...document.querySelectorAll('dialog')].filter((d) => d.matches(':modal'));
  const modal = modals.at(-1);
  const parent = modal ?? config.container ?? document.body;
  if (region.parentElement !== parent) {
    if (region.matches(':popover-open')) region.hidePopover();
    parent.append(region);
    modal?.addEventListener('close', () => live.size && ensureRegion(), { once: true });
  }
  // Re-show to move above anything opened since (top layer order is "last shown on top").
  if (region.matches(':popover-open')) region.hidePopover();
  region.showPopover();
  return region;
}

function startTimer(entry) {
  if (paused || !Number.isFinite(entry.remaining)) return;
  entry.started = performance.now();
  entry.timer = setTimeout(() => dismiss(entry.node.dataset.id), entry.remaining);
}

function stopTimer(entry) {
  if (!entry.timer) return;
  clearTimeout(entry.timer);
  entry.timer = 0;
  entry.remaining -= performance.now() - entry.started;
}

function render(node, options, handle) {
  const tone = options.tone ?? 'neutral';
  node.dataset.tone = tone;
  node.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
  const parts = [];
  parts.push(Object.assign(document.createElement('span'), { className: 'kl-toast__icon', ariaHidden: 'true' }));
  const text = document.createElement('div');
  text.className = 'kl-toast__text';
  text.append(Object.assign(document.createElement('p'), { className: 'kl-toast__title', textContent: options.message ?? '' }));
  if (options.description) text.append(Object.assign(document.createElement('p'), { className: 'kl-toast__description', textContent: options.description }));
  parts.push(text);
  if (options.action) {
    const action = Object.assign(document.createElement('button'), { type: 'button', className: 'kl-btn kl-toast__action', textContent: options.action.label });
    action.dataset.size = 'sm';
    action.dataset.variant = 'ghost';
    action.addEventListener('click', () => {
      if (options.action.onClick?.(handle) !== false) handle.dismiss();
    });
    parts.push(action);
  }
  if (options.dismissible !== false) {
    const close = Object.assign(document.createElement('button'), { type: 'button', className: 'kl-toast__close' });
    close.setAttribute('aria-label', options.dismissLabel ?? 'Dismiss');
    close.addEventListener('click', () => handle.dismiss());
    parts.push(close);
  }
  node.replaceChildren(...parts);
}

function show(message, options = {}) {
  const opts = { ...options, message: options.message ?? message };
  const id = opts.id ?? `kl-toast-${++uid}`;
  const existing = live.get(id);
  if (existing) {
    update(id, opts);
    return existing.handle;
  }
  const root = ensureRegion();
  const node = document.createElement('div');
  node.className = 'kl-toast';
  node.dataset.id = id;
  const handle = { id, update: (o) => update(id, o), dismiss: () => dismiss(id) };
  // Insert the live region empty and fill it a frame later: screen readers announce changes
  // inside an existing region far more reliably than a region inserted with its content.
  node.setAttribute('role', opts.tone === 'danger' ? 'alert' : 'status');
  requestAnimationFrame(() => live.has(id) && render(node, live.get(id).options, handle));
  const duration = opts.duration ?? (opts.tone === 'danger' ? 8000 : 5000);
  const entry = { node, options: opts, remaining: duration, timer: 0, started: 0, handle };
  live.set(id, entry);
  root.append(node);
  // Over the limit: drop the oldest.
  const ids = [...live.keys()];
  for (const old of ids.slice(0, Math.max(0, ids.length - config.max))) dismiss(old);
  startTimer(entry);
  return handle;
}

function update(id, options) {
  const entry = live.get(id);
  if (!entry) return;
  stopTimer(entry);
  entry.options = { ...entry.options, ...options };
  render(entry.node, entry.options, entry.handle);
  if ('duration' in options) entry.remaining = options.duration;
  startTimer(entry);
}

function dismiss(id) {
  if (id === undefined) {
    for (const key of [...live.keys()]) dismiss(key);
    return;
  }
  const entry = live.get(id);
  if (!entry) return;
  stopTimer(entry);
  live.delete(id);
  const { node } = entry;
  const hadFocus = node.contains(document.activeElement);
  node.dataset.state = 'closing';
  const duration = parseFloat(getComputedStyle(node).transitionDuration) * 1000 || 0;
  setTimeout(() => {
    node.remove();
    if (!live.size && region?.matches(':popover-open')) region.hidePopover();
  }, duration + 20);
  if (hadFocus) region?.querySelector('.kl-toast:not([data-state="closing"]) button')?.focus();
}

/**
 * Show a toast. Also: toast.info / success / warning / error(message, options).
 * @param {string} message
 * @param {ToastOptions} [options]
 * @returns {ToastHandle}
 */
export function toast(message, options) {
  return show(message, options);
}

const tone = (t) => (message, options = {}) => show(message, { ...options, tone: t });
toast.info = tone('info');
toast.success = tone('success');
toast.warning = tone('warning');
toast.error = tone('danger');

/** Dismiss one toast by id, or all of them. */
toast.dismiss = (id) => dismiss(id);

/**
 * Global settings.
 * @param {{ position?: typeof config.position, max?: number, container?: Element | null, label?: string }} options
 */
toast.configure = (options) => {
  Object.assign(config, options);
  if (region) {
    if (options.label) region.setAttribute('aria-label', options.label);
    if (config.position) region.dataset.position = config.position;
    else delete region.dataset.position;
  }
};
