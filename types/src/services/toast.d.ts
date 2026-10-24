/**
 * toast: short, non-blocking notifications.
 *
 *   import { toast } from 'klesora-ui/services/toast';
 *   toast.success('Payment sent', { description: '₦45,000 to Ada Obi' });
 *   const t = toast('Uploading statement…', { duration: Infinity });
 *   t.update({ message: 'Statement uploaded', tone: 'success', duration: 4000 });
 *   toast.error('Transfer failed', { action: { label: 'Retry', onClick: retry } });
 *
 * - Announced to screen readers: role="status" (polite); errors use role="alert".
 * - Timers pause while the pointer is over the toasts or focus is inside (WCAG 2.2.1), and
 *   when the page is hidden. Default duration 5s (errors 8s); Infinity keeps it until dismissed.
 * - Each style places and draws toasts its own way (tokens); phones always get full-width,
 *   bottom-centre toasts. toast.configure({ position }) overrides the placement.
 * - Rendered in a top-layer popover, so toasts stay above dialogs opened earlier, and are
 *   brought to the front when a new toast arrives.
 * No side effects on import; nothing touches the DOM until a toast is shown.
 */
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type ToastOptions = {
    /**
     * the main line (when updating)
     */
    message?: string;
    description?: string;
    tone?: Tone;
    /**
     * milliseconds; Infinity = until dismissed
     */
    duration?: number;
    /**
     * onClick returning false keeps the toast open
     */
    action?: {
        label: string;
        onClick: (toast: ToastHandle) => void | boolean;
    };
    /**
     * show a close button (default true)
     */
    dismissible?: boolean;
    /**
     * reuse an id to update an existing toast instead of adding one
     */
    id?: string;
    /**
     * accessible name of the close button (default "Dismiss")
     */
    dismissLabel?: string;
};
export type ToastHandle = {
    id: string;
    update: (options: ToastOptions) => void;
    dismiss: () => void;
};
/**
 * @typedef {'neutral' | 'info' | 'success' | 'warning' | 'danger'} Tone
 * @typedef {object} ToastOptions
 * @property {string} [message] the main line (when updating)
 * @property {string} [description]
 * @property {Tone} [tone]
 * @property {number} [duration] milliseconds; Infinity = until dismissed
 * @property {{ label: string, onClick: (toast: ToastHandle) => void | boolean }} [action]
 *   onClick returning false keeps the toast open
 * @property {boolean} [dismissible] show a close button (default true)
 * @property {string} [id] reuse an id to update an existing toast instead of adding one
 * @property {string} [dismissLabel] accessible name of the close button (default "Dismiss")
 */
/**
 * @typedef {object} ToastHandle
 * @property {string} id
 * @property {(options: ToastOptions) => void} update
 * @property {() => void} dismiss
 */
declare const config: {
    position: null | 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';
    max: number;
    container: Element | null;
    label: string;
};
/**
 * Show a toast. Also: toast.info / success / warning / error(message, options).
 * @param {string} message
 * @param {ToastOptions} [options]
 * @returns {ToastHandle}
 */
export declare function toast(message: string, options?: ToastOptions): ToastHandle;
export declare namespace toast {
    export var info: (message: any, options?: {}) => any;
    export var success: (message: any, options?: {}) => any;
    export var warning: (message: any, options?: {}) => any;
    export var error: (message: any, options?: {}) => any;
    var _a: (id: any) => void;
    export { _a as dismiss };
    export var configure: (options: {
        position?: typeof config.position;
        max?: number;
        container?: Element | null;
        label?: string;
    }) => void;
}
export {};
