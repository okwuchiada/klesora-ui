/**
 * theme: read and switch style, theme and brand, optionally remembered across visits.
 *
 *   import { theme } from 'klesora-ui/services/theme';
 *   theme.set({ theme: 'dark' });                 // remembered in localStorage
 *   theme.set({ style: 'chorus', brand: '#0a7cff' });
 *   theme.set({ brand: null });                   // back to the style's own primary
 *   theme.toggle();                               // light ↔ dark, from what's showing now
 *   const stop = theme.subscribe(({ style, theme, brand, resolved }) => …);
 *
 * To avoid a flash of the wrong theme on reload, run the stored choice before the page paints:
 * put `themeInitScript` in an inline <script> at the top of <head> (see CONVENTIONS.md §7).
 * No side effects on import; the DOM and storage are only touched when a method is called.
 */
export type Style = 'solo' | 'mono' | 'chorus';
export type Theme = 'light' | 'dark' | 'system';
export type ThemeChoice = {
    style?: Style | null;
    theme?: Theme | null;
    brand?: string | null;
};
export type ThemeState = {
    style: Style;
    theme: Theme;
    brand: string | null;
    resolved: 'light' | 'dark';
};
/** Inline this in <head> (before stylesheets paint) to apply the remembered choice without a flash. */
export declare const themeInitScript: string;
export declare const theme: {
    /** The localStorage key used to remember the choice. */
    storageKey: string;
    /**
     * Current style, theme and brand, plus `resolved` (the light/dark actually showing).
     * @param {Element} [target] defaults to <html>
     * @returns {ThemeState}
     */
    get(target?: Element): ThemeState;
    /**
     * Change any of style, theme and brand. null removes that setting (back to the default).
     * @param {ThemeChoice} choice
     * @param {{ persist?: boolean, target?: HTMLElement }} [options] persist defaults to true for <html>;
     *   pass a target to switch one section (never persisted)
     */
    set(choice: ThemeChoice, { persist, target }?: {
        persist?: boolean;
        target?: HTMLElement;
    }): void;
    /** Switch light ↔ dark based on what's showing now. */
    toggle(options: any): void;
    /** Forget the stored choice and return to the defaults. */
    reset(): void;
    /**
     * Call `fn` whenever the choice changes (set, toggle, another tab, or the OS theme while on
     * "system").
     * @param {(state: ThemeState) => void} fn
     * @returns {() => void} unsubscribe
     */
    subscribe(fn: (state: ThemeState) => void): () => void;
};
