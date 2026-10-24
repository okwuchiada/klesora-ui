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
import { UIElement } from '../../core/element.js';
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
export declare function tabsController(root: HTMLElement, { signal, activation, orientation, initial, onChange }: {
    signal: AbortSignal;
    activation?: () => 'auto' | 'manual';
    orientation?: () => 'horizontal' | 'vertical';
    initial?: () => string | null;
    onChange?: (detail: {
        value: string;
        tab: Element;
        panel: Element | null;
    }) => void;
}): {
    select: (value: string) => void;
    value: () => string | null;
    refresh: () => void;
};
export declare class KlTabs extends UIElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    connected(): void;
    update(changed: any): void;
}
