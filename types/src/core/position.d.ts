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
export type Side = 'top' | 'bottom' | 'left' | 'right';
export type Placement = `${Side}` | `${Side}-start` | `${Side}-end`;
/**
 * Position `floating` next to `anchor` once.
 * @param {Element} anchor
 * @param {HTMLElement} floating
 * @param {{ placement?: Placement, offset?: number, padding?: number, flip?: boolean, shift?: boolean }} [options]
 * @returns {{ x: number, y: number, placement: Placement }}
 */
export declare function position(anchor: Element, floating: HTMLElement, { placement, offset, padding, flip, shift }?: {
    placement?: Placement;
    offset?: number;
    padding?: number;
    flip?: boolean;
    shift?: boolean;
}): {
    x: number;
    y: number;
    placement: Placement;
};
/**
 * Keep `floating` positioned while it's open: on scroll (any ancestor), resize, and size changes
 * of either element. Positions immediately, then once per animation frame at most.
 * @param {Element} anchor
 * @param {HTMLElement} floating
 * @param {Parameters<typeof position>[2]} [options]
 * @returns {() => void} stop updating
 */
export declare function autoPosition(anchor: Element, floating: HTMLElement, options?: Parameters<typeof position>[2]): () => void;
