/**
 * <kl-switch>: an on/off switch (role="switch"); its content is the label.
 *
 *   <kl-switch name="alerts" checked>Transaction alerts</kl-switch>
 *
 * Use a switch for settings that apply immediately, and a checkbox for choices submitted with a form.
 */
import { ToggleElement } from '../../core/toggle-element.js';
import { define } from '../../core/element.js';

export class KlSwitch extends ToggleElement {
  static role = 'switch';
}

define('kl-switch', KlSwitch);
