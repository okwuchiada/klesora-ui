/**
 * data-kl-navbar: phone mode for <header class="kl-navbar">. Importing registers it.
 *
 * Below the breakpoint (the attribute value, default 48rem) the navbar gets data-compact.
 * Its .kl-navbar__nav becomes a popover panel under the bar, opened by .kl-navbar__toggle.
 *   - It closes on Escape, an outside tap or choosing a link.
 *   - Above the breakpoint the links are an ordinary inline list again.
 * The toggle should be a native <button> (popovertarget is wired for you) or <kl-button>.
 */
import { registerDirective } from '../core/directives.js';

let uid = 0;

/** @param {HTMLElement} navbar @param {string} value */
export function mount(navbar, value) {
  const controller = new AbortController();
  const { signal } = controller;
  const query = matchMedia(`(max-width: ${value || '48rem'})`);
  const nav = () => navbar.querySelector('.kl-navbar__nav');
  // The links toggle: a .kl-navbar__toggle that isn't already opening something else
  // (the same look is used for a sidebar drawer opener).
  const toggle = () =>
    [...navbar.querySelectorAll('.kl-navbar__toggle')].find((b) => !b.hasAttribute('popovertarget') || b.getAttribute('popovertarget') === nav()?.id) ?? null;

  const apply = () => {
    const panel = nav();
    const button = toggle();
    if (!panel) return;
    panel.id ||= `kl-navbar-nav-${++uid}`;
    if (query.matches) {
      navbar.setAttribute('data-compact', '');
      if (!panel.hasAttribute('popover')) panel.setAttribute('popover', 'auto');
      if (button) {
        button.setAttribute('popovertarget', panel.id);
        button.setAttribute('aria-expanded', String(panel.matches(':popover-open')));
        button.setAttribute('aria-controls', panel.id);
        if (!button.hasAttribute('aria-label') && !button.textContent.trim()) button.setAttribute('aria-label', 'Menu');
      }
    } else {
      if (panel.matches(':popover-open')) panel.hidePopover();
      navbar.removeAttribute('data-compact');
      panel.removeAttribute('popover');
      button?.removeAttribute('aria-expanded');
    }
  };

  query.addEventListener('change', apply, { signal });
  navbar.addEventListener(
    'toggle',
    (e) => {
      if (e.target === nav()) toggle()?.setAttribute('aria-expanded', String(e.newState === 'open'));
    },
    { signal, capture: true },
  );
  navbar.addEventListener(
    'click',
    (e) => {
      const panel = nav();
      if (panel?.matches(':popover-open') && e.target.closest('a[href]') && panel.contains(e.target)) panel.hidePopover();
    },
    { signal },
  );
  apply();
  return () => {
    controller.abort();
    navbar.removeAttribute('data-compact');
    nav()?.removeAttribute('popover');
  };
}

registerDirective('navbar', mount);
