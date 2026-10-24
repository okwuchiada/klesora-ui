/**
 * data-kl-ripple: press feedback on any element (class-layer buttons, cards, list rows).
 * Importing this module registers the directive.
 *
 *   <button class="kl-btn" data-kl-ripple>Pay</button>
 *
 * Only styles that draw a ripple show one (Chorus). <kl-button> has it built in.
 * The element needs `position: relative` and `overflow: hidden` (.kl-btn already has both);
 * add class `kl-ripple` to other elements for the ripple layer.
 */
import { registerDirective } from '../core/directives.js';
import { press, onPressEnd } from '../core/press.js';

/** @param {HTMLElement} el */
export function mount(el) {
  const controller = new AbortController();
  const { signal } = controller;
  el.addEventListener('pointerdown', (e) => e.button === 0 && press(el, e), { signal });
  el.addEventListener('keydown', (e) => !e.repeat && (e.key === 'Enter' || e.key === ' ') && press(el, e), { signal });
  el.addEventListener('animationend', onPressEnd, { signal });
  return () => {
    controller.abort();
    el.removeAttribute('data-pressed');
  };
}

registerDirective('ripple', mount);
