/**
 * dialog: alert, confirm and prompt as Promises, built on native <dialog class="kl-dialog">.
 *
 *   import { dialog } from 'klesora-ui/services/dialog';
 *   if (await dialog.confirm({ title: 'Send ₦45,000 to Ada Obi?', confirmText: 'Send' })) …
 *   const name = await dialog.prompt({ title: 'Rename card', label: 'Card name', defaultValue: 'Travel' });
 *
 * Built from class-layer markup only (no custom elements needed). Focus goes to the safest
 * control (Cancel for tone: 'danger', the field for prompts, otherwise the main button) and
 * returns to where it was when the dialog closes. Escape cancels. The dialog is removed after
 * it closes. Strings default to English; pass your own text for other languages.
 * No side effects on import; nothing touches the DOM until a method is called.
 */
export type DialogOptions = {
    title?: string;
    /**
     * supporting text under the title
     */
    message?: string;
    confirmText?: string;
    cancelText?: string;
    /**
     * danger: red confirm button, Cancel focused first
     */
    tone?: 'default' | 'danger';
    /**
     * close on backdrop click (default true; never for prompts)
     */
    dismissible?: boolean;
    /**
     * where to put the dialog (default document.body); use a themed
     * section to inherit its theme, style and brand
     */
    container?: Element;
};
export type PromptOptions = DialogOptions & {
    label?: string;
    defaultValue?: string;
    placeholder?: string;
    type?: string;
    inputMode?: string;
    required?: boolean;
    autocomplete?: string;
};
export declare const dialog: {
    /**
     * Show a message with one button.
     * @param {string | DialogOptions} options a title, or options
     * @returns {Promise<void>}
     */
    alert(options: string | DialogOptions): Promise<void>;
    /**
     * Ask a yes/no question.
     * @param {string | DialogOptions} options a title, or options
     * @returns {Promise<boolean>} true only when confirmed (Cancel, Escape and backdrop give false)
     */
    confirm(options: string | DialogOptions): Promise<boolean>;
    /**
     * Ask for a line of text. Native validation (required, type, pattern) blocks confirming.
     * @param {string | PromptOptions} options a title, or options
     * @returns {Promise<string | null>} the text, or null when cancelled
     */
    prompt(options: string | PromptOptions): Promise<string | null>;
};
