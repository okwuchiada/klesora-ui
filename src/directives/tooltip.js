/**
 * data-kl-tooltip: a short text hint. Importing registers it.
 *
 *   <kl-button icon aria-label="Copy" data-kl-tooltip="Copy account number">…</kl-button>
 *   <span data-kl-tooltip="Settles in 1 business day" data-kl-tooltip-placement="right">ⓘ</span>
 *
 * - Shows on hover (after a short delay; instantly if another tooltip was just open) and on
 *   keyboard focus. Hides on leave, blur and Escape.
 * - The tooltip can be hovered without closing (WCAG 1.4.13). Not shown for touch: put essential
 *   information in the page.
 * - The text is also set as the element's aria-description (unless it has its own description),
 *   so screen readers announce it on focus without the visual tooltip.
 * - Placement: data-kl-tooltip-placement (default "top"); it flips and shifts at screen edges.
 *
 * One shared popover element renders every tooltip, in the top layer.
 */
import { registerDirective } from '../core/directives.js';
import { autoPosition } from '../core/position.js';

const SHOW_DELAY = 400;
const HIDE_DELAY = 100;
const WARM_FOR = 400;

let tip = null;
let owner = null;
let stop = null;
let showTimer = 0;
let hideTimer = 0;
let lastHidden = -Infinity; // not 0: performance.now() is small just after load

function element() {
  if (!tip) {
    tip = document.createElement('div');
    tip.className = 'kl-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('popover', 'manual');
    tip.id = 'kl-tooltip';
    tip.addEventListener('pointerenter', () => clearTimeout(hideTimer));
    tip.addEventListener('pointerleave', () => scheduleHide());
  }
  if (!tip.isConnected) document.body.append(tip);
  return tip;
}

function show(el) {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  const text = el.getAttribute('data-kl-tooltip');
  if (!text) return;
  const node = element();
  if (owner !== el) {
    stop?.();
    owner = el;
    node.textContent = text;
    // Inherit the anchor's theme and style tokens: put the tooltip next to it in the tree if needed.
    const scope = el.closest('[data-kl-theme], [data-kl-style], [data-kl-scope]');
    if (scope && node.parentElement !== scope) scope.append(node);
    else if (!scope && node.parentElement !== document.body) document.body.append(node);
  }
  if (!node.matches(':popover-open')) node.showPopover();
  stop?.();
  stop = autoPosition(el, node, { placement: el.getAttribute('data-kl-tooltip-placement') || 'top', offset: 6 });
}

function hide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  if (tip?.matches(':popover-open')) {
    tip.hidePopover();
    lastHidden = performance.now();
  }
  stop?.();
  stop = null;
  owner = null;
}

function scheduleShow(el) {
  clearTimeout(hideTimer);
  if (owner === el && tip?.matches(':popover-open')) return;
  const warm = performance.now() - lastHidden < WARM_FOR || tip?.matches(':popover-open');
  clearTimeout(showTimer);
  showTimer = setTimeout(() => show(el), warm ? 0 : SHOW_DELAY);
}

function scheduleHide() {
  clearTimeout(showTimer);
  clearTimeout(hideTimer);
  hideTimer = setTimeout(hide, HIDE_DELAY);
}

/** @param {HTMLElement} el @param {string} value */
export function mount(el, value) {
  const controller = new AbortController();
  const { signal } = controller;
  const describe = !el.hasAttribute('aria-describedby') && !el.hasAttribute('aria-description');
  if (describe) el.setAttribute('aria-description', value);

  el.addEventListener('pointerenter', (e) => e.pointerType !== 'touch' && scheduleShow(el), { signal });
  el.addEventListener('pointerleave', () => owner === el || showTimer ? scheduleHide() : null, { signal });
  el.addEventListener('focusin', () => el.matches(':focus-visible, :has(:focus-visible)') && show(el), { signal });
  el.addEventListener('focusout', () => owner === el && hide(), { signal });
  el.addEventListener('pointerdown', () => owner === el && hide(), { signal });
  document.addEventListener('keydown', (e) => e.key === 'Escape' && owner === el && hide(), { signal });

  return () => {
    controller.abort();
    if (describe) el.removeAttribute('aria-description');
    if (owner === el) hide();
  };
}

registerDirective('tooltip', mount);
