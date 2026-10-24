/**
 * Directive registry: behaviours attached through `data-kl-<name>` attributes.
 *
 *   registerDirective('tooltip', (el, value) => { …; return () => { …cleanup } });
 *   <button data-kl-tooltip="Copy account number">
 *
 * One MutationObserver watches the document (and any shadow roots passed to observeRoot),
 * so directives also mount on content a framework renders later. A directive mounts when its
 * attribute appears, remounts when the value changes (cleanup, then mount), and is cleaned
 * up when the attribute or the element goes away. Moving an element within the same task
 * does not remount it. The observer starts with the first registered directive.
 */

/** @typedef {(el: Element, value: string) => void | (() => void)} DirectiveMount */

/** @type {Map<string, { attr: string, mount: DirectiveMount }>} */
const registry = new Map();
/** @type {WeakMap<Element, Map<string, { value: string, cleanup: (() => void) | null }>>} */
const mounted = new WeakMap();
/** @type {Set<Document | ShadowRoot>} */
const roots = new Set();
/** @type {MutationObserver | null} */
let observer = null;

const attrFor = (name) => `data-kl-${name}`;
const selector = () => [...registry.values()].map((d) => `[${d.attr}]`).join(',');

function mount(el, name, value) {
  const { mount: fn } = registry.get(name);
  let entries = mounted.get(el);
  if (!entries) mounted.set(el, (entries = new Map()));
  try {
    const cleanup = fn(el, value);
    entries.set(name, { value, cleanup: typeof cleanup === 'function' ? cleanup : null });
  } catch (error) {
    console.error(`[klesora-ui] directive "${name}" failed to mount`, el, error);
  }
}

function unmount(el, name) {
  const entries = mounted.get(el);
  const entry = entries?.get(name);
  if (!entry) return;
  entries.delete(name);
  try {
    entry.cleanup?.();
  } catch (error) {
    console.error(`[klesora-ui] directive "${name}" cleanup failed`, el, error);
  }
}

/** Bring one element's directive in line with its attribute and connection. */
function sync(el, name) {
  const attr = attrFor(name);
  const present = el.isConnected && el.hasAttribute(attr);
  const value = el.getAttribute(attr);
  const entry = mounted.get(el)?.get(name);
  if (!present) {
    if (entry) unmount(el, name);
  } else if (!entry) {
    mount(el, name, value);
  } else if (entry.value !== value) {
    unmount(el, name);
    mount(el, name, value);
  }
}

function elementsIn(node) {
  const sel = selector();
  if (!sel || ![1, 9, 11].includes(node.nodeType)) return []; // element, document, fragment
  const found = [...node.querySelectorAll(sel)];
  if (node.nodeType === 1 && node.matches(sel)) found.unshift(node);
  return found;
}

function syncTree(node, names = [...registry.keys()]) {
  for (const el of elementsIn(node)) for (const name of names) sync(el, name);
}

function teardownTree(node) {
  for (const el of elementsIn(node)) {
    if (el.isConnected) continue; // moved, not removed
    for (const name of [...(mounted.get(el)?.keys() ?? [])]) unmount(el, name);
  }
}

function onMutations(records) {
  for (const record of records) {
    if (record.type === 'attributes') {
      const name = record.attributeName.slice('data-kl-'.length);
      if (registry.has(name)) sync(/** @type {Element} */ (record.target), name);
    } else {
      record.removedNodes.forEach(teardownTree);
      record.addedNodes.forEach((node) => node.isConnected && syncTree(node));
    }
  }
}

function watch(root) {
  observer ??= new MutationObserver(onMutations);
  // Observing the same root again replaces its options, which updates the attribute filter.
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: [...registry.values()].map((d) => d.attr),
  });
}

/**
 * Register a directive. Registering the same name twice is a no-op.
 * Safe to call without a DOM; nothing is observed until a document exists.
 * @param {string} name kebab-case; the attribute is `data-kl-<name>`
 * @param {DirectiveMount | { mount: DirectiveMount }} directive
 */
export function registerDirective(name, directive) {
  if (registry.has(name)) return;
  const fn = typeof directive === 'function' ? directive : directive.mount;
  registry.set(name, { attr: attrFor(name), mount: fn });
  if (!globalThis.document) return;
  roots.add(document);
  for (const root of roots) {
    watch(root);
    syncTree(root, [name]);
  }
}

/**
 * Also watch a shadow root (the document is watched automatically).
 * @param {ShadowRoot} root
 * @returns {() => void} stop watching it and clean up its directives
 */
export function observeRoot(root) {
  roots.add(root);
  if (registry.size) {
    watch(root);
    syncTree(root);
  }
  return () => {
    roots.delete(root);
    // MutationObserver can't unobserve one target: re-observe the rest.
    observer?.disconnect();
    for (const r of roots) watch(r);
    for (const el of elementsIn(root)) for (const name of [...(mounted.get(el)?.keys() ?? [])]) unmount(el, name);
  };
}

/**
 * Sync directives under `root` now, without waiting for the observer (for tests, or after
 * moving content between roots).
 * @param {ParentNode} [root]
 */
export function scan(root = globalThis.document) {
  if (root) syncTree(root);
}

/** Names of registered directives. */
export function directiveNames() {
  return [...registry.keys()];
}
