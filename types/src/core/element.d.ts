/**
 * UIElement: the base class for every Klesora UI custom element.
 *
 * - Light DOM only. An element never moves or wraps the children a page or framework gave it;
 *   the element itself is the styled control (CSS selects `kl-button` and `.kl-btn` alike).
 * - Declared properties (static `properties`) get accessors, attribute ↔ property conversion,
 *   optional reflection to the attribute and optional mirroring to `data-*` for the class layer.
 * - Changes are batched: any number of sets cause one `update(changed, first)` in a microtask.
 *   `await el.updateComplete` waits for it.
 * - `listen()` and `addCleanup()` are undone automatically on disconnect.
 * - `emit('kl-…')` dispatches bubbling, composed CustomEvents.
 *
 * Importing this module is safe without a DOM (server rendering): nothing touches
 * `document` or `customElements` until an element is defined or created.
 */
export type PropertyOptions = {
    /**
     * How the attribute is converted. Defaults to String.
     */
    type?: StringConstructor | NumberConstructor | BooleanConstructor | ObjectConstructor | ArrayConstructor;
    /**
     * Attribute name. Defaults to the kebab-case property name; false for none.
     */
    attribute?: string | false;
    /**
     * Write the property back to its attribute on update.
     */
    reflect?: boolean;
    /**
     * Mirror the value to `data-<attribute>` so class-layer CSS (`[data-variant]`) applies.
     */
    data?: boolean;
    /**
     * Initial value. Use a function for objects and arrays.
     */
    default?: unknown | (() => unknown);
};
export type PropertyDeclarations = Record<string, PropertyOptions>;
/**
 * @typedef {object} PropertyOptions
 * @property {StringConstructor|NumberConstructor|BooleanConstructor|ObjectConstructor|ArrayConstructor} [type]
 *   How the attribute is converted. Defaults to String.
 * @property {string|false} [attribute] Attribute name. Defaults to the kebab-case property name; false for none.
 * @property {boolean} [reflect] Write the property back to its attribute on update.
 * @property {boolean} [data] Mirror the value to `data-<attribute>` so class-layer CSS (`[data-variant]`) applies.
 * @property {unknown | (() => unknown)} [default] Initial value. Use a function for objects and arrays.
 */
/** @typedef {Record<string, PropertyOptions>} PropertyDeclarations */
declare const Base: typeof HTMLElement;
export declare class UIElement extends Base {
    #private;
    /** ElementInternals: default ARIA role/state, and form participation for FormElement. */
    internals: ElementInternals;
    /** Resolves after the pending update has run. */
    updateComplete: Promise<boolean>;
    /** @type {PropertyDeclarations} */
    static properties: PropertyDeclarations;
    static get observedAttributes(): string[];
    constructor();
    connectedCallback(): void;
    disconnectedCallback(): void;
    attributeChangedCallback(attr: any, old: any, value: any): void;
    /**
     * Schedule an update. Called automatically by property setters; call it yourself
     * after changing internal state that `update()` reads.
     * @param {string} [name] property that changed
     * @param {unknown} [old] its previous value
     */
    requestUpdate(name?: string, old?: unknown): void;
    /** Hook: the element was inserted. Add listeners with `listen()` here. */
    connected(): void;
    /** Hook: the element was removed. Listeners and cleanups are already undone. */
    disconnected(): void;
    /**
     * Hook: sync the DOM, ARIA and form state with the properties.
     * @param {Map<string, unknown>} changed property name → previous value
     * @param {boolean} first true on the first update after construction
     */
    update(changed: Map<string, unknown>, first: boolean): void;
    /**
     * Dispatch a library event. Names must start with `kl-`.
     * @param {`kl-${string}`} type
     * @param {unknown} [detail]
     * @param {{ cancelable?: boolean, bubbles?: boolean, composed?: boolean }} [options]
     * @returns {boolean} false if a listener called preventDefault() on a cancelable event
     */
    emit(type: `kl-${string}`, detail?: unknown, { cancelable, bubbles, composed }?: {
        cancelable?: boolean;
        bubbles?: boolean;
        composed?: boolean;
    }): boolean;
    /**
     * addEventListener that is removed automatically on disconnect. Call while connected.
     * @param {EventTarget} target
     * @param {string} type
     * @param {EventListenerOrEventListenerObject} handler
     * @param {AddEventListenerOptions} [options]
     */
    listen(target: EventTarget, type: string, handler: EventListenerOrEventListenerObject, options?: AddEventListenerOptions): void;
    /**
     * Run `fn` on the next disconnect (observers, timers, directive cleanups…).
     * @template {() => void} T
     * @param {T} fn
     * @returns {T}
     */
    addCleanup<T extends () => void>(fn: T): T;
    /**
     * Set a default role or ARIA state. It goes on ElementInternals (what assistive tech reads) and,
     * unless the author wrote that attribute themselves, also as a plain attribute. Tools that don't
     * read ElementInternals (Playwright getByRole, Testing Library) then see it too.
     * @param {'role' | `aria${string}`} name `role` or an ElementInternals ARIA property, e.g. `ariaChecked`
     * @param {string | null} value null removes it
     */
    setAria(name: 'role' | `aria${string}`, value: string | null): void;
    /** AbortSignal for the current connection (for fetch, observers…). Null while disconnected. */
    get signal(): any;
}
/**
 * Define a custom element once. Defining the same tag again is a no-op.
 * Safe to call without a DOM.
 * @template {CustomElementConstructor} T
 * @param {string} tag
 * @param {T} cls
 * @returns {CustomElementConstructor}
 */
export declare function define<T extends CustomElementConstructor>(tag: string, cls: T): CustomElementConstructor;
export {};
