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

/**
 * @typedef {object} PropertyOptions
 * @property {StringConstructor|NumberConstructor|BooleanConstructor|ObjectConstructor|ArrayConstructor} [type]
 *   How the attribute is converted. Defaults to String.
 * @property {string|false} [attribute] Attribute name. Defaults to the kebab-case property name; false for none.
 * @property {boolean} [reflect] Write the property back to its attribute on update.
 * @property {boolean} [data] Mirror the value to `data-<attribute>` so class-layer CSS (`[data-variant]`) applies.
 * @property {unknown | (() => unknown)} [default] Initial value. Use a function for objects and arrays.
 */

const Base = /** @type {typeof HTMLElement} */ (globalThis.HTMLElement ?? class {});

const VALUES = Symbol('values');
const CHANGED = Symbol('changed');
const RESOLVE = Symbol('resolve');
const QUEUED = Symbol('queued');
const REFLECTING = Symbol('reflecting');
const UPDATED = Symbol('updated');
const ABORT = Symbol('abort');
const CLEANUPS = Symbol('cleanups');
const ARIA_OWNED = Symbol('ariaOwned');

/** @type {WeakMap<Function, { props: Map<string, Required<Omit<PropertyOptions, 'default'>> & { default: unknown }>, attrs: Map<string, string> }>} */
const metas = new WeakMap();

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

function fromAttribute(value, type) {
  if (type === Boolean) return value !== null;
  if (value === null) return null;
  if (type === Number) return Number(value);
  if (type === Object || type === Array) {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
  return value;
}

function toAttribute(value, type) {
  if (type === Boolean) return value ? '' : null;
  if (value === null || value === undefined) return null;
  if (type === Object || type === Array) return JSON.stringify(value);
  return String(value);
}

const initial = (opts) =>
  typeof opts.default === 'function' ? opts.default() : opts.default ?? (opts.type === Boolean ? false : null);

/** Collect declared properties along the class chain and install accessors once per class. */
function finalize(cls) {
  let meta = metas.get(cls);
  if (meta) return meta;
  const parent = Object.getPrototypeOf(cls);
  const inherited = parent && parent !== Base && parent.prototype instanceof Base ? finalize(parent) : null;
  meta = { props: new Map(inherited?.props), attrs: new Map(inherited?.attrs) };

  if (Object.hasOwn(cls, 'properties')) {
    for (const [name, options] of Object.entries(cls.properties)) {
      const opts = {
        type: String,
        attribute: kebab(name),
        reflect: false,
        data: false,
        ...options,
      };
      meta.props.set(name, opts);
      if (opts.attribute) meta.attrs.set(opts.attribute, name);
      if (!Object.getOwnPropertyDescriptor(cls.prototype, name)) {
        Object.defineProperty(cls.prototype, name, {
          configurable: true,
          enumerable: true,
          get() {
            return this[VALUES].get(name);
          },
          set(value) {
            const old = this[VALUES].get(name);
            if (Object.is(old, value)) return;
            this[VALUES].set(name, value);
            this.requestUpdate(name, old);
          },
        });
      }
    }
  }
  metas.set(cls, meta);
  return meta;
}

export class UIElement extends Base {
  /** @type {Record<string, PropertyOptions>} */
  static properties = {};

  static get observedAttributes() {
    return [...finalize(this).attrs.keys()];
  }

  constructor() {
    super();
    const { props } = finalize(this.constructor);
    this[VALUES] = new Map([...props].map(([name, opts]) => [name, initial(opts)]));
    this[CHANGED] = new Map();
    this[RESOLVE] = null;
    this[QUEUED] = false;
    this[REFLECTING] = null;
    this[UPDATED] = false;
    this[ABORT] = null;
    this[CLEANUPS] = [];
    /** ElementInternals: default ARIA role/state, and form participation for FormElement. */
    this.internals = this.attachInternals();
    /** Resolves after the pending update has run. */
    this.updateComplete = Promise.resolve(true);
  }

  connectedCallback() {
    // A framework may set properties before the element is defined; re-route them through the accessors.
    for (const name of finalize(this.constructor).props.keys()) {
      if (Object.hasOwn(this, name)) {
        const value = this[name];
        delete this[name];
        this[name] = value;
      }
    }
    this[ABORT] = new AbortController();
    this.connected();
    this.requestUpdate();
  }

  disconnectedCallback() {
    this[ABORT]?.abort();
    this[ABORT] = null;
    for (const fn of this[CLEANUPS].splice(0)) {
      try {
        fn();
      } catch (error) {
        console.error('[klesora-ui] cleanup failed', error);
      }
    }
    this.disconnected();
  }

  attributeChangedCallback(attr, old, value) {
    if (old === value) return;
    const name = finalize(this.constructor).attrs.get(attr);
    if (!name || this[REFLECTING] === name) return;
    const opts = finalize(this.constructor).props.get(name);
    // A removed attribute falls back to the default, not null.
    this[name] = value === null ? initial(opts) : fromAttribute(value, opts.type);
  }

  /**
   * Schedule an update. Called automatically by property setters; call it yourself
   * after changing internal state that `update()` reads.
   * @param {string} [name] property that changed
   * @param {unknown} [old] its previous value
   */
  requestUpdate(name, old) {
    if (name !== undefined && !this[CHANGED].has(name)) this[CHANGED].set(name, old);
    if (!this[RESOLVE]) this.updateComplete = new Promise((resolve) => (this[RESOLVE] = resolve));
    if (this[QUEUED]) return;
    this[QUEUED] = true;
    queueMicrotask(() => this.#performUpdate());
  }

  #performUpdate() {
    this[QUEUED] = false;
    // While disconnected, keep collecting changes (updateComplete stays pending);
    // connectedCallback requests the update again.
    if (!this.isConnected) return;
    const changed = this[CHANGED];
    this[CHANGED] = new Map();
    const first = !this[UPDATED];
    const resolve = this[RESOLVE];
    this[RESOLVE] = null;

    for (const [name, opts] of finalize(this.constructor).props) {
      if (!first && !changed.has(name)) continue;
      const attrValue = toAttribute(this[VALUES].get(name), opts.type);
      if (opts.reflect && opts.attribute) {
        this[REFLECTING] = name;
        this.#write(opts.attribute, attrValue);
        this[REFLECTING] = null;
      }
      if (opts.data && opts.attribute) this.#write(`data-${opts.attribute}`, attrValue);
    }

    try {
      this.update(changed, first);
    } catch (error) {
      console.error(`[klesora-ui] <${this.localName}> update failed`, error);
    }
    this[UPDATED] = true;
    resolve?.(true);
  }

  #write(attr, value) {
    if (value === null) this.removeAttribute(attr);
    else if (this.getAttribute(attr) !== value) this.setAttribute(attr, value);
  }

  /** Hook: the element was inserted. Add listeners with `listen()` here. */
  connected() {}

  /** Hook: the element was removed. Listeners and cleanups are already undone. */
  disconnected() {}

  /**
   * Hook: sync the DOM, ARIA and form state with the properties.
   * @param {Map<string, unknown>} changed property name → previous value
   * @param {boolean} first true on the first update after construction
   */
  // eslint-disable-next-line no-unused-vars
  update(changed, first) {}

  /**
   * Dispatch a library event. Names must start with `kl-`.
   * @param {`kl-${string}`} type
   * @param {unknown} [detail]
   * @param {{ cancelable?: boolean, bubbles?: boolean, composed?: boolean }} [options]
   * @returns {boolean} false if a listener called preventDefault() on a cancelable event
   */
  emit(type, detail, { cancelable = false, bubbles = true, composed = true } = {}) {
    if (!type.startsWith('kl-')) throw new TypeError(`Klesora UI events must be named kl-*, got "${type}"`);
    return this.dispatchEvent(new CustomEvent(type, { detail, cancelable, bubbles, composed }));
  }

  /**
   * addEventListener that is removed automatically on disconnect. Call while connected.
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListenerOrEventListenerObject} handler
   * @param {AddEventListenerOptions} [options]
   */
  listen(target, type, handler, options = {}) {
    if (!this[ABORT]) throw new Error('listen() must be called while the element is connected');
    target.addEventListener(type, handler, { ...options, signal: this[ABORT].signal });
  }

  /**
   * Run `fn` on the next disconnect (observers, timers, directive cleanups…).
   * @template {() => void} T
   * @param {T} fn
   * @returns {T}
   */
  addCleanup(fn) {
    this[CLEANUPS].push(fn);
    return fn;
  }

  /**
   * Set a default role or ARIA state. It goes on ElementInternals (what assistive tech reads) and,
   * unless the author wrote that attribute themselves, also as a plain attribute. Tools that don't
   * read ElementInternals (Playwright getByRole, Testing Library) then see it too.
   * @param {'role' | `aria${string}`} name `role` or an ElementInternals ARIA property, e.g. `ariaChecked`
   * @param {string | null} value null removes it
   */
  setAria(name, value) {
    this.internals[name] = value;
    const attr = name === 'role' ? 'role' : `aria-${name.slice(4).toLowerCase()}`;
    const owned = (this[ARIA_OWNED] ??= new Set());
    if (this.hasAttribute(attr) && !owned.has(attr)) return; // the author's own value wins
    if (value === null || value === undefined) {
      this.removeAttribute(attr);
      owned.delete(attr);
    } else {
      if (this.getAttribute(attr) !== value) this.setAttribute(attr, value);
      owned.add(attr);
    }
  }

  /** AbortSignal for the current connection (for fetch, observers…). Null while disconnected. */
  get signal() {
    return this[ABORT]?.signal ?? null;
  }
}

/**
 * Define a custom element once. Defining the same tag again is a no-op.
 * Safe to call without a DOM.
 * @template {CustomElementConstructor} T
 * @param {string} tag
 * @param {T} cls
 * @returns {CustomElementConstructor}
 */
export function define(tag, cls) {
  const registry = globalThis.customElements;
  if (!registry) return cls;
  const existing = registry.get(tag);
  if (existing) return existing;
  registry.define(tag, cls);
  return cls;
}
