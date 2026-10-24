/**
 * Tabs (WAI-ARIA tabs pattern).
 *
 *   <kl-tabs value="activity" aria-label="Account">
 *     <div class="kl-tabs__list">
 *       <button class="kl-tabs__tab" value="overview">Overview</button>
 *       <button class="kl-tabs__tab" value="activity">Activity</button>
 *     </div>
 *     <section class="kl-tabs__panel" data-value="overview">…</section>
 *     <section class="kl-tabs__panel" data-value="activity">…</section>
 *   </kl-tabs>
 *
 * Tabs and panels pair by value (`value` / `data-value`), or by order. Your elements stay where
 * they are; the tabs set roles, ids, aria-selected/controls/labelledby, roving tabindex and
 * `hidden` on inactive panels.
 * Keys: arrows (Left/Right, or Up/Down when data-orientation="vertical"; RTL-aware), Home/End.
 * activation="auto" (default) selects on focus; "manual" waits for Enter/Space/click.
 * Fires `kl-change` (detail: { value, tab, panel }) after the selection changes.
 * Class layer: <div class="kl-tabs" data-kl-tabs> does the same via the directive.
 */
import { UIElement, define } from '../../core/element.js';

let uid = 0;
const TAB = '.kl-tabs__tab, [role="tab"]';
const PANEL = '.kl-tabs__panel, [role="tabpanel"]';
const disabled = (tab) => tab.matches(':disabled, [aria-disabled="true"]');

/**
 * Attach tabs behaviour to a container. Used by <kl-tabs> and the data-kl-tabs directive.
 * @param {HTMLElement} root
 * @param {{
 *   signal: AbortSignal,
 *   activation?: () => 'auto' | 'manual',
 *   orientation?: () => 'horizontal' | 'vertical',
 *   initial?: () => string | null,
 *   onChange?: (detail: { value: string, tab: Element, panel: Element | null }) => void,
 * }} options
 * @returns {{ select: (value: string) => void, value: () => string | null, refresh: () => void }}
 */
export function tabsController(root, { signal, activation = () => 'auto', orientation = () => 'horizontal', initial = () => null, onChange }) {
  // Only this container's tabs, not those of tabs nested inside a panel.
  const own = (el) => el.closest(':is(kl-tabs, .kl-tabs, [data-kl-tabs])') === root;
  const list = () => [...root.querySelectorAll('.kl-tabs__list, [role="tablist"]')].find(own) ?? null;
  const tabs = () => [...root.querySelectorAll(TAB)].filter(own);
  const panels = () => [...root.querySelectorAll(PANEL)].filter(own);
  const valueOf = (tab, i) => tab.getAttribute('value') ?? tab.dataset.value ?? String(i);
  const panelFor = (tab, i) => {
    const value = valueOf(tab, i);
    const all = panels();
    return all.find((p) => p.dataset.value === value) ?? (all.every((p) => !p.dataset.value) ? all[i] : null) ?? null;
  };
  let current = null;

  const sync = (focus = false) => {
    const listEl = list();
    if (listEl) {
      listEl.setAttribute('role', 'tablist');
      if (orientation() === 'vertical') listEl.setAttribute('aria-orientation', 'vertical');
      else listEl.removeAttribute('aria-orientation');
      if (!listEl.hasAttribute('aria-label') && !listEl.hasAttribute('aria-labelledby') && root.getAttribute('aria-label')) {
        listEl.setAttribute('aria-label', root.getAttribute('aria-label'));
      }
    }
    const all = tabs();
    if (current === null || !all.some((t, i) => valueOf(t, i) === current)) {
      const preset = initial() ?? all.find((t) => t.getAttribute('aria-selected') === 'true')?.getAttribute('value');
      const first = all.find((t, i) => valueOf(t, i) === preset && !disabled(t)) ?? all.find((t) => !disabled(t));
      current = first ? valueOf(first, all.indexOf(first)) : null;
    }
    all.forEach((tab, i) => {
      const panel = panelFor(tab, i);
      const selected = valueOf(tab, i) === current;
      tab.id ||= `kl-tab-${++uid}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (tab.localName === 'button' && !tab.hasAttribute('type')) tab.type = 'button';
      if (panel) {
        panel.id ||= `kl-tabpanel-${++uid}`;
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', tab.id);
        if (!panel.hasAttribute('tabindex')) panel.tabIndex = 0;
        panel.hidden = !selected;
        tab.setAttribute('aria-controls', panel.id);
      }
      if (selected && focus) tab.focus();
    });
  };

  const select = (value, { focus = false, user = false } = {}) => {
    const all = tabs();
    const index = all.findIndex((t, i) => valueOf(t, i) === value);
    if (index < 0 || disabled(all[index])) return;
    const changed = value !== current;
    current = value;
    sync(focus);
    if (changed && user) onChange?.({ value, tab: all[index], panel: panelFor(all[index], index) });
  };

  root.addEventListener(
    'click',
    (e) => {
      const tab = e.target.closest(TAB);
      if (!tab || !own(tab)) return;
      const all = tabs();
      select(valueOf(tab, all.indexOf(tab)), { user: true });
    },
    { signal },
  );

  root.addEventListener(
    'keydown',
    (e) => {
      const tab = e.target.closest(TAB);
      if (!tab || !own(tab)) return;
      const all = tabs().filter((t) => !disabled(t));
      const index = all.indexOf(tab);
      const vertical = orientation() === 'vertical';
      const rtl = getComputedStyle(root).direction === 'rtl';
      const next = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
      const prev = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
      let target = null;
      if (e.key === next) target = all[(index + 1) % all.length];
      else if (e.key === prev) target = all[(index - 1 + all.length) % all.length];
      else if (e.key === 'Home') target = all[0];
      else if (e.key === 'End') target = all.at(-1);
      else if ((e.key === 'Enter' || e.key === ' ') && tab.localName !== 'button') {
        e.preventDefault();
        tab.click();
        return;
      }
      if (!target) return;
      e.preventDefault();
      const everyTab = tabs();
      if (activation() === 'auto') select(valueOf(target, everyTab.indexOf(target)), { focus: true, user: true });
      else target.focus();
    },
    { signal },
  );

  // Tabs or panels rendered later by a framework.
  const observer = new MutationObserver(() => sync());
  observer.observe(root, { childList: true, subtree: true });
  signal.addEventListener('abort', () => observer.disconnect());
  sync();

  return { select: (value) => select(value), value: () => current, refresh: () => sync() };
}

export class KlTabs extends UIElement {
  /** @type {import('../../core/element.js').PropertyDeclarations} */
  static properties = {
    value: { type: String, reflect: true },
    activation: { type: String, default: 'auto' },
    orientation: { type: String, data: true, default: 'horizontal' },
    variant: { type: String, data: true },
  };

  #controller = null;

  connected() {
    this.#controller = tabsController(this, {
      signal: this.signal,
      activation: () => this.activation,
      orientation: () => this.orientation,
      initial: () => this.value,
      onChange: (detail) => {
        this.value = detail.value;
        this.emit('kl-change', detail);
      },
    });
    if (this.value === null) this.value = this.#controller.value();
  }

  update(changed) {
    if (changed.has('value') && this.value !== null && this.#controller?.value() !== this.value) this.#controller?.select(this.value);
    if (changed.has('orientation')) this.#controller?.refresh();
  }
}

define('kl-tabs', KlTabs);
