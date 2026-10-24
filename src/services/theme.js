/**
 * theme: read and switch style, theme and brand, optionally remembered across visits.
 *
 *   import { theme } from 'klesora-ui/services/theme';
 *   theme.set({ theme: 'dark' });                 // remembered in localStorage
 *   theme.set({ style: 'chorus', brand: '#0a7cff' });
 *   theme.set({ brand: null });                   // back to the style's own primary
 *   theme.toggle();                               // light ↔ dark, from what's showing now
 *   const stop = theme.subscribe(({ style, theme, brand, resolved }) => …);
 *
 * To avoid a flash of the wrong theme on reload, run the stored choice before the page paints:
 * put `themeInitScript` in an inline <script> at the top of <head> (see CONVENTIONS.md §7).
 * No side effects on import; the DOM and storage are only touched when a method is called.
 */

/**
 * @typedef {'solo' | 'mono' | 'chorus'} Style
 * @typedef {'light' | 'dark' | 'system'} Theme
 * @typedef {{ style?: Style | null, theme?: Theme | null, brand?: string | null }} ThemeChoice
 * @typedef {{ style: Style, theme: Theme, brand: string | null, resolved: 'light' | 'dark' }} ThemeState
 */

const STORAGE_KEY = 'kl-theme';

/**
 * Applies a stored choice to <html>. Self-contained (serialised into themeInitScript), so it
 * must not reference anything outside its body.
 * @param {string} key
 */
function applyStored(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || 'null');
    if (!saved) return;
    const root = document.documentElement;
    if (saved.style) root.setAttribute('data-kl-style', saved.style);
    if (saved.theme) root.setAttribute('data-kl-theme', saved.theme);
    if (saved.brand) root.style.setProperty('--kl-brand', saved.brand);
  } catch {
    /* storage blocked or corrupt: keep the page defaults */
  }
}

/** Inline this in <head> (before stylesheets paint) to apply the remembered choice without a flash. */
export const themeInitScript = `(${applyStored.toString()})(${JSON.stringify(STORAGE_KEY)});`;

const listeners = new Set();
let watching = false;

function read(target = document.documentElement) {
  const style = /** @type {Style} */ (target.getAttribute('data-kl-style') || 'mono');
  const mode = /** @type {Theme} */ (target.getAttribute('data-kl-theme') || 'system');
  const brand = target.style.getPropertyValue('--kl-brand').trim() || null;
  const resolved = mode === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : mode;
  return { style, theme: mode, brand, resolved };
}

function notify() {
  const state = read();
  for (const fn of listeners) fn(state);
}

function watch() {
  if (watching) return;
  watching = true;
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => read().theme === 'system' && notify());
  // Another tab changed the stored choice.
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return;
    try {
      apply(JSON.parse(e.newValue || '{}'), document.documentElement);
      notify();
    } catch {
      /* ignore corrupt values */
    }
  });
}

function apply(choice, target) {
  if ('style' in choice) {
    if (choice.style) target.setAttribute('data-kl-style', choice.style);
    else target.removeAttribute('data-kl-style');
  }
  if ('theme' in choice) {
    if (choice.theme) target.setAttribute('data-kl-theme', choice.theme);
    else target.removeAttribute('data-kl-theme');
  }
  if ('brand' in choice) {
    if (choice.brand) target.style.setProperty('--kl-brand', choice.brand);
    else target.style.removeProperty('--kl-brand');
  }
}

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') ?? {};
  } catch {
    return {};
  }
}

function save(choice) {
  try {
    const next = { ...load(), ...choice };
    for (const k of Object.keys(next)) if (next[k] === null || next[k] === undefined) delete next[k];
    if (Object.keys(next).length) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* storage unavailable (private mode, blocked): the choice still applies for this page */
  }
}

export const theme = {
  /** The localStorage key used to remember the choice. */
  storageKey: STORAGE_KEY,

  /**
   * Current style, theme and brand, plus `resolved` (the light/dark actually showing).
   * @param {Element} [target] defaults to <html>
   * @returns {ThemeState}
   */
  get(target) {
    return read(target);
  },

  /**
   * Change any of style, theme and brand. null removes that setting (back to the default).
   * @param {ThemeChoice} choice
   * @param {{ persist?: boolean, target?: HTMLElement }} [options] persist defaults to true for <html>;
   *   pass a target to switch one section (never persisted)
   */
  set(choice, { persist, target = document.documentElement } = {}) {
    apply(choice, target);
    if (persist ?? target === document.documentElement) save(choice);
    watch();
    notify();
  },

  /** Switch light ↔ dark based on what's showing now. */
  toggle(options) {
    theme.set({ theme: read(options?.target).resolved === 'dark' ? 'light' : 'dark' }, options);
  },

  /** Forget the stored choice and return to the defaults. */
  reset() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    theme.set({ style: null, theme: null, brand: null }, { persist: false });
  },

  /**
   * Call `fn` whenever the choice changes (set, toggle, another tab, or the OS theme while on
   * "system").
   * @param {(state: ThemeState) => void} fn
   * @returns {() => void} unsubscribe
   */
  subscribe(fn) {
    listeners.add(fn);
    watch();
    return () => listeners.delete(fn);
  },
};
