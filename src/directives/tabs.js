/**
 * data-kl-tabs: tabs behaviour for class-layer markup. Importing registers it.
 *
 *   <div class="kl-tabs" data-kl-tabs aria-label="Account">
 *     <div class="kl-tabs__list"><button class="kl-tabs__tab">Overview</button>…</div>
 *     <section class="kl-tabs__panel">…</section>…
 *   </div>
 *
 * The value may be "manual" (activate on Enter/Space/click instead of on focus).
 * data-orientation="vertical" on the container switches the arrow keys. Fires `kl-change`.
 */
import { registerDirective } from '../core/directives.js';
import { tabsController } from '../components/tabs/tabs.js';

/** @param {HTMLElement} el @param {string} value */
export function mount(el, value) {
  const controller = new AbortController();
  tabsController(el, {
    signal: controller.signal,
    activation: () => (value === 'manual' ? 'manual' : 'auto'),
    orientation: () => (el.dataset.orientation === 'vertical' ? 'vertical' : 'horizontal'),
    onChange: (detail) => el.dispatchEvent(new CustomEvent('kl-change', { detail, bubbles: true, composed: true })),
  });
  return () => controller.abort();
}

registerDirective('tabs', mount);
