/**
 * <kl-select>: a custom select (WAI-ARIA select-only combobox).
 *
 *   <kl-select name="bank" placeholder="Choose a bank" required>
 *     <kl-option value="gtb">GTBank</kl-option>
 *     <kl-option value="zenith" disabled>Zenith Bank</kl-option>
 *   </kl-select>
 *
 * The element is the combobox. Your <kl-option>s stay where you put them (hidden). The element
 * draws its own listbox in a popover it owns, re-rendered when the options change, so frameworks
 * keep full control of their nodes. Focus stays on the element; aria-activedescendant follows
 * the highlighted option.
 *
 * Keys: Enter/Space/ArrowDown/ArrowUp open. While open: arrows, Home/End, PageUp/PageDown,
 * type-to-find, Enter/Space choose, Escape/Tab close. While closed, typing picks a match
 * directly (like a native select). Fires native-style `input` and `change` on user choice.
 *
 * Use <select class="kl-select"> instead when you want the OS picker (e.g. long lists on phones).
 */
import { FormElement } from '../../core/form-element.js';
import { UIElement, define } from '../../core/element.js';
import { autoPosition } from '../../core/position.js';
import { typeahead } from '../../core/typeahead.js';

let uid = 0;
const ensureId = (el) => (el.id ||= `kl-label-${++uid}`);
let requiredMessage = '';
function valueMissingMessage() {
  if (!requiredMessage) {
    const probe = document.createElement('select');
    probe.required = true;
    probe.append(new Option('', ''));
    requiredMessage = probe.validationMessage || 'Select an item in the list.';
  }
  return requiredMessage;
}

export class KlOption extends UIElement {
  /** @type {import('../../core/element.js').PropertyDeclarations} */
  static properties = {
    value: { type: String },
    disabled: { type: Boolean, reflect: true },
    selected: { type: Boolean, reflect: true },
  };

  /** Text shown in the closed select. */
  get label() {
    return this.getAttribute('label') ?? this.textContent.trim();
  }

  /** The submitted value: `value`, or the label when no value is set. */
  get optionValue() {
    return this.value ?? this.label;
  }

  update() {
    // Tell the owning select to re-render its list.
    this.closest('kl-select')?.requestUpdate('options');
  }
}

export class KlSelect extends FormElement {
  static properties = {
    value: { type: String, default: '' },
    placeholder: { type: String },
    placement: { type: String, default: 'bottom-start' },
    size: { type: String, data: true, default: 'md' },
  };

  #display = document.createElement('span');
  #listbox = document.createElement('div');
  #active = -1;
  #stop = null;
  #defaultValue = null;
  #customError = '';
  #openAtPointerDown = false;
  #pressed = false;
  #find = typeahead((o) => o.label);

  constructor() {
    super();
    this.#display.dataset.klPart = 'value';
    this.#listbox.dataset.klPart = 'listbox';
    this.#listbox.id = `kl-listbox-${++uid}`;
    this.#listbox.setAttribute('role', 'listbox');
    this.#listbox.setAttribute('popover', 'auto');
    this.#listbox.tabIndex = -1;
  }

  /** The <kl-option> children, in order. */
  get options() {
    return [...this.querySelectorAll('kl-option')];
  }

  get selectedOption() {
    return this.options.find((o) => o.optionValue === this.value) ?? null;
  }

  get open() {
    return this.#listbox.matches(':popover-open');
  }

  connected() {
    if (this.#display.parentNode !== this) this.prepend(this.#display);
    if (this.#listbox.parentNode !== this) this.append(this.#listbox);
    this.setAria('role', 'combobox');
    this.setAria('ariaHasPopup', 'listbox');
    this.setAria('ariaExpanded', 'false');
    this.setAttribute('aria-controls', this.#listbox.id);

    if (this.#defaultValue === null) {
      const initial = this.options.find((o) => o.hasAttribute('selected'));
      this.#defaultValue = this.getAttribute('value') ?? initial?.optionValue ?? '';
      if (!this.hasAttribute('value') && initial) this.value = initial.optionValue;
    }

    // Light dismiss closes the list on an outside pointer-up, and the host counts as outside;
    // remember the state at pointer-down so that click doesn't reopen it.
    this.listen(this, 'pointerdown', () => {
      this.#openAtPointerDown = this.open;
      this.#pressed = true;
    }, { capture: true });
    this.listen(this, 'click', (e) => this.#onClick(e));
    this.listen(this, 'keydown', (e) => this.#onKeyDown(e));
    this.listen(this.#listbox, 'pointermove', (e) => {
      const index = this.#rendered().indexOf(e.target.closest('[role="option"]'));
      if (index >= 0 && index !== this.#active) this.#setActive(index, false);
    });
    this.listen(this.#listbox, 'beforetoggle', (e) => this.#onToggle(e));
    this.listen(this, 'focusin', () => this.#linkLabels());
    // Options rendered later by a framework, or text edits inside them.
    const observer = new MutationObserver((records) => {
      if (records.some((r) => !this.#listbox.contains(r.target) && r.target !== this.#display && r.target !== this.#listbox)) {
        this.requestUpdate('options');
      }
    });
    observer.observe(this, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['value', 'disabled', 'label'] });
    this.addCleanup(() => observer.disconnect());
    this.addCleanup(() => this.#stop?.());
  }

  update(changed, first) {
    super.update(changed, first);
    this.tabIndex = this.isDisabled ? -1 : 0;
    this.#render();
    const selected = this.selectedOption;
    this.#display.textContent = selected?.label ?? this.placeholder ?? '';
    this.#display.toggleAttribute('data-placeholder', !selected);
    this.toggleAttribute('data-filled', Boolean(selected));
    this.#linkLabels();

    this.setFormValue(selected ? this.value : null);
    if (this.#customError) this.setValidity({ customError: true }, this.#customError);
    else if (this.required && !selected) this.setValidity({ valueMissing: true }, valueMissingMessage());
    else this.setValidity();
  }

  #labelledByOwned = false;

  /** Name the combobox from its <label for>, for tools that only do that for native controls. */
  #linkLabels() {
    if (this.hasAttribute('aria-label') || (this.hasAttribute('aria-labelledby') && !this.#labelledByOwned)) return;
    const ids = [...(this.labels ?? [])].map(ensureId).join(' ');
    if (ids) {
      this.setAttribute('aria-labelledby', ids);
      this.#labelledByOwned = true;
    }
  }

  #rendered() {
    return [...this.#listbox.children];
  }

  #render() {
    const options = this.options;
    const nodes = options.map((option, index) => {
      const node = document.createElement('div');
      node.id = `${this.#listbox.id}-${index}`;
      node.setAttribute('role', 'option');
      node.dataset.klPart = 'option';
      const selected = option.optionValue === this.value;
      node.setAttribute('aria-selected', String(selected));
      if (option.disabled) node.setAttribute('aria-disabled', 'true');
      if (index === this.#active) node.dataset.active = '';
      node.append(...[...option.childNodes].map((n) => n.cloneNode(true)));
      return node;
    });
    this.#listbox.replaceChildren(...nodes);
    for (const option of options) option.selected = option.optionValue === this.value;
    if (this.#active >= 0 && this.open) this.setAttribute('aria-activedescendant', `${this.#listbox.id}-${this.#active}`);
  }

  #setActive(index, scroll = true) {
    const nodes = this.#rendered();
    this.#active = index;
    nodes.forEach((n, i) => n.toggleAttribute('data-active', i === index));
    const node = nodes[index];
    if (node) {
      this.setAttribute('aria-activedescendant', node.id);
      if (scroll) node.scrollIntoView({ block: 'nearest' });
    } else this.removeAttribute('aria-activedescendant');
  }

  /** Enabled option nearest to `index` (searching forward first), or the current one. */
  #nearest(index) {
    const options = this.options;
    const i = Math.min(Math.max(index, 0), options.length - 1);
    if (options[i] && !options[i].disabled) return i;
    const forward = this.#step(i, 1);
    return forward !== i ? forward : this.#step(i, -1);
  }

  /** Next enabled option index from `from`, stepping by `step` (no wrap, like native). */
  #step(from, step) {
    const options = this.options;
    for (let i = from + step; i >= 0 && i < options.length; i += step) if (!options[i].disabled) return i;
    return from;
  }

  #choose(index) {
    const option = this.options[index];
    if (!option || option.disabled) return;
    const changed = option.optionValue !== this.value;
    this.value = option.optionValue;
    if (changed) {
      this.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      this.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  show() {
    if (!this.isDisabled && !this.open) this.#listbox.showPopover();
  }

  hide() {
    if (this.open) this.#listbox.hidePopover();
  }

  #onToggle(e) {
    if (e.newState === 'open') {
      this.setAria('ariaExpanded', 'true');
      const selected = this.options.indexOf(this.selectedOption);
      this.#setActive(selected >= 0 ? selected : this.#step(-1, 1), false);
      requestAnimationFrame(() => {
        if (!this.open) return;
        this.#stop = autoPosition(this, this.#listbox, { placement: this.placement });
        this.#rendered()[this.#active]?.scrollIntoView({ block: 'nearest' });
      });
    } else {
      this.setAria('ariaExpanded', 'false');
      this.removeAttribute('aria-activedescendant');
      this.#stop?.();
      this.#stop = null;
      delete this.#listbox.dataset.placement;
    }
  }

  #onClick(e) {
    if (this.isDisabled) return;
    const node = e.target.closest('[role="option"]');
    if (node && this.#listbox.contains(node)) {
      const index = this.#rendered().indexOf(node);
      if (this.options[index]?.disabled) return;
      this.#choose(index);
      this.hide();
      this.focus();
      return;
    }
    if (this.#listbox.contains(e.target)) return;
    const pointer = this.#pressed;
    this.#pressed = false;
    // Clicks that didn't start with a press on the select (from a <label>, or script) only
    // focus it, like a native select. Keyboard opening is handled in keydown.
    if (!pointer) return this.focus();
    this.#openAtPointerDown ? this.hide() : this.show();
  }

  #onKeyDown(e) {
    if (this.isDisabled || e.target !== this) return;
    const options = this.options;
    const last = options.length - 1;
    if (!this.open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault();
        this.show();
        return;
      }
      const match = this.#find(e, options, options.indexOf(this.selectedOption));
      if (match >= 0 && !options[match].disabled) this.#choose(match);
      return;
    }
    let next = null;
    if (e.key === 'ArrowDown') next = this.#step(this.#active, 1);
    else if (e.key === 'ArrowUp') next = this.#step(this.#active, -1);
    else if (e.key === 'Home') next = this.#step(-1, 1);
    else if (e.key === 'End') next = this.#step(last + 1, -1);
    else if (e.key === 'PageDown') next = this.#nearest(this.#active + 10);
    else if (e.key === 'PageUp') next = this.#nearest(this.#active - 10);
    else if (e.key === 'Enter' || (e.key === ' ' && !this.#typing)) {
      this.#choose(this.#active);
      this.hide();
    } else if (e.key === 'Tab') {
      this.hide();
      return;
    } else {
      const match = this.#find(e, options, this.#active);
      if (match < 0) return;
      next = match;
      this.#typingUntil = Date.now() + 500;
    }
    if (next !== null) this.#setActive(next);
    e.preventDefault();
  }

  #typingUntil = 0;
  get #typing() {
    return Date.now() < this.#typingUntil;
  }

  setCustomValidity(message) {
    this.#customError = message ?? '';
    this.requestUpdate();
  }

  formResetCallback() {
    this.value = this.#defaultValue ?? '';
  }

  formStateRestoreCallback(state) {
    this.value = typeof state === 'string' ? state : '';
  }
}

define('kl-option', KlOption);
define('kl-select', KlSelect);
