/**
 * Dropdown menu.
 *
 *   <button class="kl-btn" popovertarget="acct-menu">Account</button>
 *   <kl-menu id="acct-menu">
 *     <kl-menu-item value="statement">Download statement</kl-menu-item>
 *     <kl-menu-item value="freeze">Freeze card</kl-menu-item>
 *   </kl-menu>
 *
 * Opening and light dismiss (Escape, outside click) come from the native popover API via
 * `popovertarget`. The menu adds:
 * - positioning next to the button that opened it;
 * - aria-haspopup/expanded/controls on that button;
 * - arrow keys, Home/End and type-to-find (ArrowDown/Up on the button opens it too);
 * - closing on Tab;
 * - focus back to the button on close;
 * - a `kl-select` event (detail: { item, value }, cancelable) when an item is chosen.
 *
 * Items: <kl-menu-item>, or any element with class kl-menu__item or a menuitem role
 * (e.g. <button class="kl-menu__item">). Add data-keep-open to an item to keep the menu open.
 * Class layer: <div class="kl-menu" popover data-kl-menu> gets the same behaviour from the
 * data-kl-menu directive (src/directives/menu.js).
 */
import { UIElement, define } from '../../core/element.js';
import { autoPosition } from '../../core/position.js';
import { typeahead } from '../../core/typeahead.js';

export const ITEM = 'kl-menu-item, .kl-menu__item, [role="menuitem"], [role="menuitemcheckbox"], [role="menuitemradio"]';
let uid = 0;

const isDisabled = (item) => item.matches('[disabled], [aria-disabled="true"]');

/**
 * Attach menu behaviour to a popover panel. Used by <kl-menu> and the data-kl-menu directive.
 * @param {HTMLElement} panel
 * @param {{ signal: AbortSignal, placement?: () => string, onSelect?: (item: Element, value: string | null) => boolean }} options
 *   onSelect returns false when the selection was cancelled.
 */
export function menuController(panel, { signal, placement = () => 'bottom-start', onSelect }) {
  if (!panel.hasAttribute('popover')) panel.setAttribute('popover', 'auto');
  panel.id ||= `kl-menu-${++uid}`;
  const find = typeahead((item) => item.textContent);
  const invokerSelector = () => `[popovertarget="${CSS.escape(panel.id)}"]`;
  const invokers = () => [...document.querySelectorAll(invokerSelector())];
  const items = () => [...panel.querySelectorAll(ITEM)].filter((el) => el.closest('[popover]') === panel);
  const enabled = () => items().filter((el) => !isDisabled(el));
  let anchor = null;
  let stop = null;
  let focusLast = false;

  const prepare = () => {
    for (const invoker of invokers()) {
      invoker.setAttribute('aria-haspopup', 'menu');
      invoker.setAttribute('aria-controls', panel.id);
      if (!invoker.hasAttribute('aria-expanded')) invoker.setAttribute('aria-expanded', 'false');
    }
    for (const item of items()) {
      if (!item.hasAttribute('role') && item.localName !== 'kl-menu-item') item.setAttribute('role', 'menuitem');
      if (!item.hasAttribute('tabindex')) item.tabIndex = -1;
    }
  };
  prepare();

  const focusItem = (index) => {
    const list = enabled();
    if (!list.length) return;
    list[(index + list.length) % list.length].focus();
  };
  const currentIndex = () => enabled().indexOf(document.activeElement);

  // Remember which button opened the menu (Safari doesn't focus buttons on click).
  document.addEventListener(
    'click',
    (e) => {
      const invoker = e.target.closest?.(invokerSelector());
      if (invoker) anchor = invoker;
    },
    { capture: true, signal },
  );
  document.addEventListener(
    'keydown',
    (e) => {
      const invoker = e.target.closest?.(invokerSelector());
      if (!invoker || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
      e.preventDefault();
      anchor = invoker;
      focusLast = e.key === 'ArrowUp';
      if (!panel.matches(':popover-open')) panel.showPopover();
    },
    { capture: true, signal },
  );

  panel.addEventListener(
    'beforetoggle',
    (e) => {
      if (e.newState === 'open') {
        prepare();
        anchor = anchor?.isConnected ? anchor : document.activeElement?.closest(invokerSelector()) ?? invokers()[0] ?? null;
        anchor?.setAttribute('aria-expanded', 'true');
        // Position on the next frame: the popover is shown by then, and it's still before paint.
        requestAnimationFrame(() => {
          if (!panel.matches(':popover-open')) return;
          if (anchor) stop = autoPosition(anchor, panel, { placement: placement() });
          focusItem(focusLast ? -1 : 0);
          focusLast = false;
        });
      } else {
        stop?.();
        stop = null;
        delete panel.dataset.placement;
        anchor?.setAttribute('aria-expanded', 'false');
        if (panel.contains(document.activeElement)) anchor?.focus();
      }
    },
    { signal },
  );

  panel.addEventListener(
    'keydown',
    (e) => {
      const index = currentIndex();
      const list = enabled();
      if (e.key === 'ArrowDown') focusItem(index + 1);
      else if (e.key === 'ArrowUp') focusItem(index < 0 ? -1 : index - 1);
      else if (e.key === 'Home') focusItem(0);
      else if (e.key === 'End') focusItem(-1);
      else if (e.key === 'Tab') return panel.hidePopover();
      else if ((e.key === 'Enter' || e.key === ' ') && list[index] && !list[index].matches('button, a[href]')) {
        list[index].click();
      } else {
        const match = find(e, list, index);
        if (match < 0) return;
        list[match].focus();
      }
      e.preventDefault();
    },
    { signal },
  );

  panel.addEventListener(
    'click',
    (e) => {
      const item = e.target.closest(ITEM);
      if (!item || item.closest('[popover]') !== panel) return;
      if (isDisabled(item)) return e.preventDefault();
      const value = item.value ?? item.getAttribute('value') ?? item.dataset.value ?? null;
      const chosen = onSelect
        ? onSelect(item, value)
        : panel.dispatchEvent(new CustomEvent('kl-select', { detail: { item, value }, bubbles: true, composed: true, cancelable: true }));
      if (chosen && !item.hasAttribute('data-keep-open')) panel.hidePopover();
    },
    { signal },
  );

  // Hovering moves focus, so pointer and keyboard share one highlight.
  panel.addEventListener(
    'pointermove',
    (e) => {
      const item = e.target.closest(ITEM);
      if (item && !isDisabled(item) && document.activeElement !== item) item.focus({ preventScroll: true });
    },
    { signal },
  );

  signal.addEventListener('abort', () => stop?.());
}

export class KlMenu extends UIElement {
  /** @type {import('../../core/element.js').PropertyDeclarations} */
  static properties = {
    placement: { type: String, default: 'bottom-start' },
  };

  connected() {
    this.setAria('role', 'menu');
    menuController(this, {
      signal: this.signal,
      placement: () => this.placement,
      onSelect: (item, value) => this.emit('kl-select', { item, value }, { cancelable: true }),
    });
  }
}

export class KlMenuItem extends UIElement {
  static properties = {
    value: { type: String },
    disabled: { type: Boolean, reflect: true },
  };

  connected() {
    this.setAria('role', 'menuitem');
    if (!this.hasAttribute('tabindex')) this.tabIndex = -1;
  }

  update() {
    this.setAria('ariaDisabled', this.disabled ? 'true' : null);
  }
}

define('kl-menu', KlMenu);
define('kl-menu-item', KlMenuItem);
