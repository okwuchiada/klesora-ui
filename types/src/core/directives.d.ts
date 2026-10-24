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
export type DirectiveMount = (el: Element, value: string) => void | (() => void);
/**
 * Register a directive. Registering the same name twice is a no-op.
 * Safe to call without a DOM; nothing is observed until a document exists.
 * @param {string} name kebab-case; the attribute is `data-kl-<name>`
 * @param {DirectiveMount | { mount: DirectiveMount }} directive
 */
export declare function registerDirective(name: string, directive: DirectiveMount | {
    mount: DirectiveMount;
}): void;
/**
 * Also watch a shadow root (the document is watched automatically).
 * @param {ShadowRoot} root
 * @returns {() => void} stop watching it and clean up its directives
 */
export declare function observeRoot(root: ShadowRoot): () => void;
/**
 * Sync directives under `root` now, without waiting for the observer (for tests, or after
 * moving content between roots).
 * @param {ParentNode} [root]
 */
export declare function scan(root?: ParentNode): void;
/** Names of registered directives. */
export declare function directiveNames(): string[];
