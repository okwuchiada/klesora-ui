/**
 * Klesora UI: full entry point.
 * Importing this registers every element and directive.
 * For smaller bundles, import individual paths instead (see CONVENTIONS.md §9).
 */
export { UIElement, define } from './core/element.js';
export { FormElement } from './core/form-element.js';
export { registerDirective, observeRoot, scan, directiveNames } from './core/directives.js';

export { KlButton } from './components/button/button.js';
export { KlInput } from './components/input/input.js';
export { KlCheckbox } from './components/checkbox/checkbox.js';
export { KlSwitch } from './components/switch/switch.js';
export { KlField } from './components/field/field.js';
export { KlSelect, KlOption } from './components/select/select.js';
export { KlMenu, KlMenuItem, menuController } from './components/menu/menu.js';
export { position, autoPosition } from './core/position.js';
import './directives/ripple.js';
import './directives/menu.js';
import './directives/tooltip.js';

export const VERSION = '0.0.0';
export const PREFIX = 'kl';
export const STYLES = Object.freeze(['solo', 'mono', 'chorus']);
export const THEMES = Object.freeze(['light', 'dark', 'system']);
