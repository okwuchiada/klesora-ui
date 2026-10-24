import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/core.html');
  await page.waitForFunction(() => customElements.get('kl-test-field') && window.__directive);
});

test.describe('UIElement', () => {
  test('converts attributes to typed properties', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#props');
      el.setAttribute('open', '');
      el.setAttribute('max-length', '12');
      el.setAttribute('items', '[1,2]');
      return { label: el.label, count: el.count, open: el.open, maxLength: el.maxLength, items: el.items };
    });
    expect(r).toEqual({ label: 'Hello', count: 2, open: true, maxLength: 12, items: [1, 2] });
  });

  test('reflects properties and mirrors data-* after one batched update', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#props');
      await el.updateComplete;
      const before = el.updates.length;
      el.label = 'Bye';
      el.count = 5;
      el.open = true;
      el.variant = 'outline';
      const sync = el.getAttribute('label'); // not reflected yet: updates are batched
      await el.updateComplete;
      return {
        sync,
        updates: el.updates.length - before,
        changed: el.updates.at(-1).changed.sort(),
        attrs: ['label', 'count', 'open', 'data-variant', 'size', 'data-size', 'variant'].map((a) => el.getAttribute(a)),
      };
    });
    expect(r.sync).toBe('Hello');
    expect(r.updates).toBe(1);
    expect(r.changed).toEqual(['count', 'label', 'open', 'variant']);
    // variant is data-only (no attribute); size reflects its default and mirrors it
    expect(r.attrs).toEqual(['Bye', '5', '', 'outline', 'md', 'md', null]);
  });

  test('a removed attribute falls back to the default; false removes boolean attributes', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#props');
      el.setAttribute('size', 'lg');
      await el.updateComplete;
      const lg = el.getAttribute('data-size');
      el.removeAttribute('size');
      el.open = true;
      await el.updateComplete;
      el.open = false;
      await el.updateComplete;
      return { lg, size: el.size, dataSize: el.getAttribute('data-size'), open: el.hasAttribute('open') };
    });
    expect(r).toEqual({ lg: 'lg', size: 'md', dataSize: 'md', open: false });
  });

  test('first update reports first=true; author children are never moved', async ({ page }) => {
    const r = await page.evaluate(() => {
      const el = document.querySelector('#props');
      return { first: el.updates[0].first, childParent: document.querySelector('#child').parentElement.id, role: el.internals.role };
    });
    expect(r).toEqual({ first: true, childParent: 'props', role: 'status' });
  });

  test('keeps properties set before the element is defined', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { UIElement, define } = await import('/src/index.js');
      const el = document.createElement('kl-test-late');
      el.label = 'early';
      document.body.append(el);
      class Late extends UIElement {
        static properties = { label: { type: String, reflect: true } };
      }
      define('kl-test-late', Late);
      await el.updateComplete;
      return { label: el.label, attr: el.getAttribute('label') };
    });
    expect(r).toEqual({ label: 'early', attr: 'early' });
  });

  test('defining a tag twice is a no-op', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { UIElement, define } = await import('/src/index.js');
      const first = customElements.get('kl-test-props');
      const returned = define('kl-test-props', class extends UIElement {});
      return returned === first && customElements.get('kl-test-props') === first;
    });
    expect(r).toBe(true);
  });

  test('changes made while disconnected apply on the next connect', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.createElement('kl-test-props');
      el.label = 'offline';
      el.count = 9;
      let settled = false;
      el.updateComplete.then(() => (settled = true));
      await new Promise((r) => setTimeout(r));
      const beforeConnect = { settled, attr: el.getAttribute('label') };
      document.body.append(el);
      await el.updateComplete;
      const out = { beforeConnect, attr: el.getAttribute('label'), count: el.getAttribute('count'), updates: el.updates.length };
      el.remove();
      return out;
    });
    expect(r).toEqual({ beforeConnect: { settled: false, attr: null }, attr: 'offline', count: '9', updates: 1 });
  });

  test('emit() dispatches bubbling, composed kl-* events and reports preventDefault', async ({ page }) => {
    const r = await page.evaluate(() => {
      const el = document.querySelector('#props');
      const seen = [];
      document.addEventListener('kl-change', (e) => seen.push([e.detail, e.bubbles, e.composed]), { once: true });
      el.emit('kl-change', { value: 1 });
      el.addEventListener('kl-close', (e) => e.preventDefault(), { once: true });
      const allowed = el.emit('kl-close', null, { cancelable: true });
      let error = null;
      try {
        el.emit('change');
      } catch (e) {
        error = e.name;
      }
      return { seen, allowed, error };
    });
    expect(r).toEqual({ seen: [[{ value: 1 }, true, true]], allowed: false, error: 'TypeError' });
  });

  test('listeners and cleanups are undone on disconnect and redone on reconnect', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#props');
      const ping = () => window.dispatchEvent(new Event('test-ping'));
      ping();
      const parent = el.parentElement;
      el.remove();
      ping();
      const whileDetached = { pings: el.pings, cleanups: el.cleanups, signal: el.signal };
      parent.append(el);
      ping();
      return { whileDetached, pings: el.pings, connects: el.connects };
    });
    expect(r).toEqual({ whileDetached: { pings: 1, cleanups: 1, signal: null }, pings: 2, connects: 2 });
  });
});

test.describe('FormElement', () => {
  test('submits its value with the form', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const field = document.querySelector('#field');
      await field.updateComplete;
      const before = Object.fromEntries(new FormData(document.querySelector('#form')));
      field.value = 'Ada Obi';
      await field.updateComplete;
      return { before, after: Object.fromEntries(new FormData(document.querySelector('#form'))) };
    });
    expect(r.before).toEqual({ account: 'Ada' });
    expect(r.after).toEqual({ account: 'Ada Obi' });
  });

  test('validates, and blocks submission while invalid', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const form = document.querySelector('#form');
      const req = document.querySelector('#required-field');
      await req.updateComplete;
      const invalid = { valid: form.checkValidity(), missing: req.validity.valueMissing, msg: req.validationMessage };
      req.value = 'Rent';
      await req.updateComplete;
      return { invalid, valid: form.checkValidity(), ariaRequired: req.internals.ariaRequired };
    });
    expect(r).toEqual({ invalid: { valid: false, missing: true, msg: 'Enter a value' }, valid: true, ariaRequired: 'true' });
  });

  test('form reset restores the initial value', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const field = document.querySelector('#field');
      field.value = 'changed';
      document.querySelector('#form').reset();
      await field.updateComplete;
      return { value: field.value, data: new FormData(document.querySelector('#form')).get('account') };
    });
    expect(r).toEqual({ value: 'Ada', data: 'Ada' });
  });

  test('a disabled fieldset disables the control and drops it from the form data', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const req = document.querySelector('#required-field');
      req.value = 'x';
      document.querySelector('#fieldset').disabled = true;
      await req.updateComplete;
      const out = {
        isDisabled: req.isDisabled,
        disabledProp: req.disabled,
        aria: req.internals.ariaDisabled,
        inData: new FormData(document.querySelector('#form')).has('memo'),
        willValidate: req.willValidate,
      };
      document.querySelector('#fieldset').disabled = false;
      await req.updateComplete;
      return { ...out, after: req.isDisabled };
    });
    expect(r).toEqual({ isDisabled: true, disabledProp: false, aria: 'true', inData: false, willValidate: false, after: false });
  });

  test('labels and form are exposed', async ({ page }) => {
    const r = await page.evaluate(() => {
      const field = document.querySelector('#field');
      return { form: field.form?.id, labels: [...field.labels].map((l) => l.id) };
    });
    expect(r).toEqual({ form: 'form', labels: ['field-label'] });
  });
});

test.describe('Directives', () => {
  const tick = () => new Promise((r) => setTimeout(r));

  test('mounts on existing and later-added elements, including nested ones', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const host = document.querySelector('#directive-host');
      const wrapper = document.createElement('div');
      wrapper.innerHTML = '<p><span id="nested" data-kl-test-mark="nested"></span></p>';
      host.append(wrapper);
      await new Promise((r) => setTimeout(r));
      return {
        existing: document.querySelector('#marked').dataset.mounted,
        nested: document.querySelector('#nested').dataset.mounted,
        mounts: window.__directive.mounts,
      };
    });
    expect(r).toEqual({ existing: 'first', nested: 'nested', mounts: 2 });
  });

  test('remounts on value change and cleans up on attribute removal', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#marked');
      window.__directive.log.length = 0;
      el.setAttribute('data-kl-test-mark', 'second');
      await new Promise((r) => setTimeout(r));
      el.removeAttribute('data-kl-test-mark');
      await new Promise((r) => setTimeout(r));
      return { log: window.__directive.log, mounted: el.hasAttribute('data-mounted') };
    });
    expect(r).toEqual({ log: ['cleanup:first', 'mount:second', 'cleanup:second'], mounted: false });
  });

  test('cleans up when the element is removed, but not when it is moved', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#marked');
      window.__directive.log.length = 0;
      document.querySelector('main').append(el); // move within the same task
      await new Promise((r) => setTimeout(r));
      const afterMove = [...window.__directive.log];
      el.remove();
      await new Promise((r) => setTimeout(r));
      return { afterMove, afterRemove: window.__directive.log };
    });
    expect(r).toEqual({ afterMove: [], afterRemove: ['cleanup:first'] });
  });

  test('a throwing directive is isolated', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const r = await page.evaluate(async () => {
      const { registerDirective } = await import('/src/index.js');
      registerDirective('test-broken', () => {
        throw new Error('boom');
      });
      const a = document.createElement('i');
      a.setAttribute('data-kl-test-broken', '');
      a.setAttribute('data-kl-test-mark', 'ok');
      document.body.append(a);
      await new Promise((r) => setTimeout(r));
      return a.dataset.mounted;
    });
    expect(r).toBe('ok');
    expect(errors.some((e) => e.includes('test-broken'))).toBe(true);
  });

  test('works inside shadow roots passed to observeRoot', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const { observeRoot } = await import('/src/index.js');
      const host = document.createElement('div');
      document.body.append(host);
      const root = host.attachShadow({ mode: 'open' });
      root.innerHTML = '<b data-kl-test-mark="shadow"></b>';
      const stop = observeRoot(root);
      const mounted = root.querySelector('b').dataset.mounted;
      const late = document.createElement('u');
      late.setAttribute('data-kl-test-mark', 'late');
      root.append(late);
      await new Promise((r) => setTimeout(r));
      const lateMounted = late.dataset.mounted;
      stop();
      return { mounted, lateMounted, afterStop: root.querySelector('b').hasAttribute('data-mounted') };
    });
    expect(r).toEqual({ mounted: 'shadow', lateMounted: 'late', afterStop: false });
  });
});

test('core modules import without a DOM (server rendering)', async () => {
  const mod = await import('../src/index.js');
  expect(typeof mod.UIElement).toBe('function');
  expect(mod.define('kl-x', class {})).toBeTruthy();
  expect(() => mod.registerDirective('ssr-noop', () => {})).not.toThrow();
});
