/**
 * data-kl-menu: menu behaviour for a class-layer popover panel. Importing registers it.
 *
 *   <button class="kl-btn" popovertarget="m">More</button>
 *   <div class="kl-menu" id="m" popover data-kl-menu="bottom-end">
 *     <button class="kl-menu__item" value="rename">Rename</button>
 *   </div>
 *
 * The value is the preferred placement (default bottom-start). Fires `kl-select` on the panel.
 */
import { registerDirective } from '../core/directives.js';
import { menuController } from '../components/menu/menu.js';

/** @param {HTMLElement} el @param {string} value */
export function mount(el, value) {
  const controller = new AbortController();
  if (!el.hasAttribute('role')) el.setAttribute('role', 'menu');
  menuController(el, { signal: controller.signal, placement: () => value || 'bottom-start' });
  return () => controller.abort();
}

registerDirective('menu', mount);
