/**
 * Press feedback shared by buttons and the ripple directive. Style-agnostic: it only records
 * where the element was pressed (--kl-press-x/y/size) and restarts `data-pressed`. Styles decide
 * what to draw. Chorus draws a ripple; the others ignore it (--kl-btn-ripple: 0).
 */
/**
 * @param {HTMLElement} el
 * @param {PointerEvent | KeyboardEvent} [event] pointer events ripple from the pointer; keys from the centre
 */
export declare function press(el: HTMLElement, event?: PointerEvent | KeyboardEvent): void;
/** Remove the attribute when the press animation ends, so it can replay. */
export declare function onPressEnd(event: any): void;
