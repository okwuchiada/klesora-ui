export declare const FORWARDED_ARIA: string[];
export declare const VALIDITY_FLAGS: string[];
/** Prepare an inner input: owned by no form, marked as the control part. */
export declare function createInnerInput(): HTMLInputElement;
/** Copy the host's ARIA attributes to the inner input and name it from the host's labels. */
export declare function syncInnerAria(host: any, input: any): void;
/**
 * Wire an inner input to its host while connected (call from `connected()`).
 * @param {import('./form-element.js').FormElement} host
 * @param {HTMLInputElement} input
 */
export declare function connectInnerInput(host: import('./form-element.js').FormElement, input: HTMLInputElement): void;
/** Copy the inner input's validity (plus an optional custom error) onto the host. */
export declare function copyValidity(host: any, input: any, customError?: string): void;
