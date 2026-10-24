/**
 * Press feedback shared by buttons and the ripple directive. Style-agnostic: it only records
 * where the element was pressed (--kl-press-x/y/size) and restarts `data-pressed`. Styles decide
 * what to draw. Chorus draws a ripple; the others ignore it (--kl-btn-ripple: 0).
 */

/**
 * @param {HTMLElement} el
 * @param {PointerEvent | KeyboardEvent} [event] pointer events ripple from the pointer; keys from the centre
 */
export function press(el, event) {
  const rect = el.getBoundingClientRect();
  const x = event && 'clientX' in event ? event.clientX - rect.left : rect.width / 2;
  const y = event && 'clientY' in event ? event.clientY - rect.top : rect.height / 2;
  // Large enough to cover the farthest corner from the press point.
  const size = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
  el.style.setProperty('--kl-press-x', `${x}px`);
  el.style.setProperty('--kl-press-y', `${y}px`);
  el.style.setProperty('--kl-press-size', `${size}px`);
  el.removeAttribute('data-pressed');
  void el.offsetWidth; // restart the animation
  el.setAttribute('data-pressed', '');
}

/** Remove the attribute when the press animation ends, so it can replay. */
export function onPressEnd(event) {
  if (event.animationName === 'kl-ripple') event.currentTarget.removeAttribute('data-pressed');
}
