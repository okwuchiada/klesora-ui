/**
 * <kl-checkbox>: the element is the checkbox; its content is the label.
 *
 *   <kl-checkbox name="save" checked>Save beneficiary</kl-checkbox>
 *   <kl-checkbox indeterminate>Select all</kl-checkbox>
 *
 * `indeterminate` shows a dash (aria-checked="mixed") and clears on the next user toggle.
 */
import { ToggleElement } from '../../core/toggle-element.js';
import { define } from '../../core/element.js';

export class KlCheckbox extends ToggleElement {
  static role = 'checkbox';

  /** @type {import('../../core/element.js').PropertyDeclarations} */
  static properties = {
    indeterminate: { type: Boolean, reflect: true },
  };

  ariaCheckedState() {
    return this.indeterminate ? 'mixed' : super.ariaCheckedState();
  }

  toggle() {
    this.indeterminate = false;
    super.toggle();
  }
}

define('kl-checkbox', KlCheckbox);
