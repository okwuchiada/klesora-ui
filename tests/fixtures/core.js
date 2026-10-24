// Test-only elements and directive that exercise the core. Not part of the library.
import { UIElement, FormElement, define, registerDirective } from '../../src/index.js';

export class TestProps extends UIElement {
  static properties = {
    label: { type: String, reflect: true },
    count: { type: Number, reflect: true, default: 0 },
    open: { type: Boolean, reflect: true },
    variant: { type: String, data: true, default: 'solid' },
    size: { type: String, reflect: true, data: true, default: 'md' },
    items: { type: Array, default: () => [] },
    maxLength: { type: Number },
  };

  constructor() {
    super();
    this.updates = [];
    this.pings = 0;
    this.cleanups = 0;
    this.connects = 0;
  }

  connected() {
    this.connects++;
    this.listen(window, 'test-ping', () => this.pings++);
    this.addCleanup(() => this.cleanups++);
  }

  update(changed, first) {
    this.updates.push({ changed: [...changed.keys()], first });
    this.internals.role = 'status';
  }
}

export class TestField extends FormElement {
  static properties = {
    value: { type: String, default: '' },
  };

  update(changed, first) {
    super.update(changed, first);
    this.setFormValue(this.value || null);
    if (this.required && !this.value) this.setValidity({ valueMissing: true }, 'Enter a value');
    else this.setValidity();
  }

  formResetCallback() {
    this.value = this.getAttribute('value') ?? '';
  }

  formStateRestoreCallback(state) {
    this.value = state ?? '';
  }
}

define('kl-test-props', TestProps);
define('kl-test-field', TestField);

window.__directive = { mounts: 0, cleanups: 0, log: [] };
registerDirective('test-mark', (el, value) => {
  window.__directive.mounts++;
  window.__directive.log.push(`mount:${value}`);
  el.setAttribute('data-mounted', value);
  return () => {
    window.__directive.cleanups++;
    window.__directive.log.push(`cleanup:${value}`);
    el.removeAttribute('data-mounted');
  };
});
