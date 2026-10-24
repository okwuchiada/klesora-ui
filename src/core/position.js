/**
 * Anchor positioning for popovers (menus, select lists, tooltips). Zero dependencies.
 *
 * The floating element is placed with `position: fixed` next to its anchor. It flips to the
 * opposite side when the preferred side doesn't fit and shifts along the edge to stay on screen.
 * It also exposes the space left as --kl-available-height / --kl-available-width (for max sizes),
 * the anchor width as --kl-anchor-width, and the final side as data-placement.
 *
 * Popovers render in the top layer, so stacking and overflow: hidden ancestors never clip them.
 * CSS anchor positioning can replace this once every baseline browser supports it.
 */

/** @typedef {'top' | 'bottom' | 'left' | 'right'} Side */
/** @typedef {`${Side}` | `${Side}-start` | `${Side}-end`} Placement */

const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

/**
 * Position `floating` next to `anchor` once.
 * @param {Element} anchor
 * @param {HTMLElement} floating
 * @param {{ placement?: Placement, offset?: number, padding?: number, flip?: boolean, shift?: boolean }} [options]
 * @returns {{ x: number, y: number, placement: Placement }}
 */
export function position(anchor, floating, { placement = 'bottom-start', offset = 4, padding = 8, flip = true, shift = true } = {}) {
  const a = anchor.getBoundingClientRect();
  const vw = document.documentElement.clientWidth;
  const vh = document.documentElement.clientHeight;
  const rtl = getComputedStyle(anchor).direction === 'rtl';

  floating.style.position = 'fixed';
  floating.style.inset = 'auto';
  floating.style.margin = '0';
  floating.style.setProperty('--kl-anchor-width', `${a.width}px`);
  // Layout size, not getBoundingClientRect(): entry animations scale the panel, and the
  // transformed size would place it too close (or overlapping) once the animation ends.
  const f = { width: floating.offsetWidth, height: floating.offsetHeight };

  let [side, align = 'center'] = /** @type {[Side, string?]} */ (placement.split('-'));
  // Logical alignment: "start" means the reading-direction start.
  if (rtl && (side === 'top' || side === 'bottom') && align !== 'center') align = align === 'start' ? 'end' : 'start';

  const space = {
    top: a.top - offset - padding,
    bottom: vh - a.bottom - offset - padding,
    left: a.left - offset - padding,
    right: vw - a.right - offset - padding,
  };
  const need = side === 'top' || side === 'bottom' ? f.height : f.width;
  if (flip && space[side] < need && space[OPPOSITE[side]] > space[side]) side = OPPOSITE[side];

  let x;
  let y;
  if (side === 'top' || side === 'bottom') {
    y = side === 'bottom' ? a.bottom + offset : a.top - offset - f.height;
    x = align === 'start' ? a.left : align === 'end' ? a.right - f.width : a.left + (a.width - f.width) / 2;
    if (shift) x = Math.min(Math.max(x, padding), Math.max(padding, vw - padding - f.width));
  } else {
    x = side === 'right' ? a.right + offset : a.left - offset - f.width;
    y = align === 'start' ? a.top : align === 'end' ? a.bottom - f.height : a.top + (a.height - f.height) / 2;
    if (shift) y = Math.min(Math.max(y, padding), Math.max(padding, vh - padding - f.height));
  }

  floating.style.left = `${Math.round(x)}px`;
  floating.style.top = `${Math.round(y)}px`;
  floating.style.setProperty('--kl-available-height', `${Math.max(0, side === 'top' || side === 'bottom' ? space[side] : vh - 2 * padding)}px`);
  floating.style.setProperty('--kl-available-width', `${Math.max(0, side === 'left' || side === 'right' ? space[side] : vw - 2 * padding)}px`);
  const final = /** @type {Placement} */ (align === 'center' ? side : `${side}-${align}`);
  floating.dataset.placement = final;
  return { x, y, placement: final };
}

/**
 * Keep `floating` positioned while it's open: on scroll (any ancestor), resize, and size changes
 * of either element. Positions immediately, then once per animation frame at most.
 * @param {Element} anchor
 * @param {HTMLElement} floating
 * @param {Parameters<typeof position>[2]} [options]
 * @returns {() => void} stop updating
 */
export function autoPosition(anchor, floating, options) {
  let frame = 0;
  const update = () => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (anchor.isConnected && floating.isConnected) position(anchor, floating, options);
    });
  };
  position(anchor, floating, options);
  const controller = new AbortController();
  window.addEventListener('scroll', update, { capture: true, passive: true, signal: controller.signal });
  window.addEventListener('resize', update, { passive: true, signal: controller.signal });
  const observer = new ResizeObserver(update);
  observer.observe(anchor);
  observer.observe(floating);
  return () => {
    controller.abort();
    observer.disconnect();
    cancelAnimationFrame(frame);
  };
}
