/**
 * data-kl-sidebar: collapse and phone drawer for <nav class="kl-sidebar">. Importing registers it.
 *
 * - .kl-sidebar__collapse buttons toggle the icon-only rail (data-collapsed, aria-expanded), and
 *   fire `kl-toggle` (detail: { collapsed }). Start collapsed by adding data-collapsed yourself.
 * - Below the breakpoint (the attribute value, default 48rem) the sidebar becomes a drawer
 *   (data-drawer + popover="auto"). It slides in and closes on Escape, an outside tap or a link.
 *   Open it with any button whose popovertarget is the sidebar's id (e.g. a .kl-sidebar__open
 *   button in the navbar; it's hidden while the sidebar isn't a drawer).
 */
import { registerDirective } from '../core/directives.js';

let uid = 0;

/** @param {HTMLElement} sidebar @param {string} value */
export function mount(sidebar, value) {
  const controller = new AbortController();
  const { signal } = controller;
  const query = matchMedia(`(max-width: ${value || '48rem'})`);
  sidebar.id ||= `kl-sidebar-${++uid}`;
  const openers = () => [...document.querySelectorAll(`[popovertarget="${CSS.escape(sidebar.id)}"]`)];

  const syncCollapse = () => {
    const collapsed = sidebar.hasAttribute('data-collapsed') && !sidebar.hasAttribute('data-drawer');
    for (const button of sidebar.querySelectorAll('.kl-sidebar__collapse')) {
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-controls', sidebar.id);
    }
  };

  const apply = () => {
    if (query.matches) {
      sidebar.setAttribute('data-drawer', '');
      if (!sidebar.hasAttribute('popover')) sidebar.setAttribute('popover', 'auto');
    } else {
      if (sidebar.matches(':popover-open')) sidebar.hidePopover();
      sidebar.removeAttribute('data-drawer');
      sidebar.removeAttribute('popover');
    }
    for (const opener of openers()) {
      opener.setAttribute('aria-controls', sidebar.id);
      opener.setAttribute('aria-expanded', String(sidebar.matches(':popover-open')));
    }
    syncCollapse();
  };

  query.addEventListener('change', apply, { signal });
  sidebar.addEventListener(
    'toggle',
    (e) => {
      if (e.target !== sidebar) return;
      for (const opener of openers()) opener.setAttribute('aria-expanded', String(e.newState === 'open'));
      if (e.newState === 'open') sidebar.querySelector('[aria-current]:not([aria-current="false"]), a[href], button')?.focus();
    },
    { signal },
  );
  sidebar.addEventListener(
    'click',
    (e) => {
      if (e.target.closest('.kl-sidebar__collapse')) {
        sidebar.toggleAttribute('data-collapsed');
        syncCollapse();
        sidebar.dispatchEvent(
          new CustomEvent('kl-toggle', { detail: { collapsed: sidebar.hasAttribute('data-collapsed') }, bubbles: true, composed: true }),
        );
      } else if (sidebar.matches(':popover-open') && e.target.closest('a[href]')) {
        sidebar.hidePopover();
      }
    },
    { signal },
  );
  apply();
  return () => {
    controller.abort();
    sidebar.removeAttribute('data-drawer');
    sidebar.removeAttribute('popover');
  };
}

registerDirective('sidebar', mount);
