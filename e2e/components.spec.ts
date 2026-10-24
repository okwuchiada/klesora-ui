import { test, expect, type Page } from '@playwright/test';

// Form actions run in a zero-delay timeout after the click dispatch; give them room to settle.
const tick = (page: Page) => page.evaluate(() => new Promise((r) => setTimeout(r, 60)));

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/components.html');
  await page.waitForFunction(() => ['kl-button', 'kl-input', 'kl-checkbox', 'kl-switch', 'kl-field'].every((t) => customElements.get(t)));
  await tick(page);
});

/** Mount a fixture form for one test. */
async function fixture(page: Page, html: string) {
  await page.evaluate((markup) => {
    const host = document.createElement('div');
    host.id = 'fixture';
    host.innerHTML = markup;
    document.body.prepend(host);
    window.__events = [];
    window.__submits = [];
    host.querySelector('form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      window.__submits.push(Object.fromEntries(new FormData(e.target)));
    });
  }, html);
  await tick(page);
}

test.describe('accessibility tree (Chromium)', () => {
  test('roles, names and states come through ElementInternals', async ({ page, browserName }) => {
    test.skip(browserName !== 'chromium', 'uses the Chrome DevTools accessibility tree');
    await fixture(page, `
      <label for="ax-input">Account number</label><kl-input id="ax-input"></kl-input>
      <kl-button>Pay now</kl-button>
      <kl-button disabled>Locked</kl-button>
      <kl-checkbox checked>Save card</kl-checkbox>
      <kl-checkbox indeterminate>Select all</kl-checkbox>
      <kl-switch>Alerts</kl-switch>`);
    const cdp = await page.context().newCDPSession(page);
    const { nodes } = await cdp.send('Accessibility.getFullAXTree');
    const find = (role: string, name: string) => nodes.find((n) => n.role?.value === role && n.name?.value === name);
    const prop = (n, key) => n?.properties?.find((p) => p.name === key)?.value?.value;
    expect(find('textbox', 'Account number')).toBeTruthy();
    expect(find('button', 'Pay now')).toBeTruthy();
    expect(prop(find('button', 'Locked'), 'disabled')).toBe(true);
    expect(prop(find('checkbox', 'Save card'), 'checked')).toBe('true');
    expect(prop(find('checkbox', 'Select all'), 'checked')).toBe('mixed');
    expect(prop(find('switch', 'Alerts'), 'checked')).toBe('false');
  });
});

test.describe('kl-button', () => {
  const form = `<form><kl-input name="q" value="x"></kl-input>
    <kl-button id="submit">Pay</kl-button>
    <kl-button id="plain" type="button">Plain</kl-button>
    <kl-button id="reset" type="reset">Reset</kl-button>
    <kl-button id="off" disabled>Off</kl-button>
    <kl-button id="busy" loading>Busy</kl-button>
    <fieldset id="fs"><kl-button id="inner">Inner</kl-button></fieldset></form>`;

  test('submits its form on click, Enter and Space; type="button" does not', async ({ page }) => {
    await fixture(page, form);
    await page.click('#submit');
    await page.focus('#submit');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Space');
    await page.click('#plain');
    await tick(page);
    expect(await page.evaluate(() => window.__submits)).toEqual([{ q: 'x' }, { q: 'x' }, { q: 'x' }]);
  });

  test('still works when form controls clobber form.requestSubmit / form.reset', async ({ page }) => {
    // The #reset button in the fixture already shadows form.reset; add one for requestSubmit.
    await fixture(page, form.replace('<form>', '<form><input name="requestSubmit" type="hidden" value="1">'));
    await page.click('#submit');
    await tick(page);
    expect(await page.evaluate(() => window.__submits)).toEqual([{ requestSubmit: '1', q: 'x' }]);
  });

  test('preventDefault in a click handler cancels the submit', async ({ page }) => {
    await fixture(page, form);
    await page.evaluate(() => document.querySelector('#submit').addEventListener('click', (e) => e.preventDefault()));
    await page.click('#submit');
    await tick(page);
    expect(await page.evaluate(() => window.__submits.length)).toBe(0);
  });

  test('type="reset" resets the form', async ({ page }) => {
    await fixture(page, form);
    await page.fill('#fixture kl-input input', 'changed');
    await page.click('#reset');
    await tick(page);
    expect(await page.evaluate(() => document.querySelector('#fixture kl-input').value)).toBe('x');
  });

  test('disabled, loading and fieldset-disabled buttons ignore activation', async ({ page }) => {
    await fixture(page, form);
    await page.evaluate(() => {
      document.querySelector('#fs').disabled = true;
      for (const id of ['off', 'busy', 'inner']) document.getElementById(id).addEventListener('click', () => window.__events.push(id));
    });
    await tick(page);
    for (const id of ['#off', '#busy', '#inner']) await page.click(id, { force: true });
    await tick(page);
    const r = await page.evaluate(() => ({
      events: window.__events,
      submits: window.__submits.length,
      tab: ['off', 'inner'].map((id) => document.getElementById(id).tabIndex),
      dataDisabled: document.getElementById('inner').hasAttribute('data-disabled'),
      busy: document.getElementById('busy').internals.ariaBusy,
    }));
    expect(r).toEqual({ events: [], submits: 0, tab: [-1, -1], dataDisabled: true, busy: 'true' });
  });

  test('mirrors variant and size to data-* and keeps its content in place', async ({ page }) => {
    await fixture(page, '<kl-button variant="outline" size="sm"><b id="kid">Go</b></kl-button>');
    const r = await page.evaluate(() => {
      const b = document.querySelector('#fixture kl-button');
      return { v: b.dataset.variant, s: b.dataset.size, parent: document.getElementById('kid').parentElement === b, cls: b.className };
    });
    expect(r).toEqual({ v: 'outline', s: 'sm', parent: true, cls: '' });
  });
});

test.describe('kl-input', () => {
  test('typing updates value, form data and bubbles native input events', async ({ page }) => {
    await fixture(page, '<form><kl-input name="name"></kl-input></form>');
    await page.evaluate(() => document.querySelector('#fixture kl-input').addEventListener('input', (e) => window.__events.push(e.target.value)));
    await page.fill('#fixture kl-input input', 'Ada');
    await tick(page);
    const r = await page.evaluate(() => ({
      value: document.querySelector('#fixture kl-input').value,
      data: Object.fromEntries(new FormData(document.querySelector('#fixture form'))),
      events: window.__events,
    }));
    expect(r).toEqual({ value: 'Ada', data: { name: 'Ada' }, events: ['Ada'] });
  });

  test('copies native validity from the inner input', async ({ page }) => {
    await fixture(page, `<form>
      <kl-input id="email" name="email" type="email" value="nope"></kl-input>
      <kl-input id="req" name="req" required></kl-input>
      <kl-input id="pat" name="pat" pattern="\\d{3}" value="12"></kl-input></form>`);
    const r = await page.evaluate(async () => {
      const [email, req, pat] = ['email', 'req', 'pat'].map((id) => document.getElementById(id));
      const before = [email.validity.typeMismatch, req.validity.valueMissing, pat.validity.patternMismatch, email.validationMessage.length > 0];
      email.value = 'ada@example.com';
      req.value = 'x';
      pat.value = '123';
      await Promise.all([email, req, pat].map((el) => el.updateComplete));
      return { before, after: document.querySelector('#fixture form').checkValidity() };
    });
    expect(r).toEqual({ before: [true, true, true, true], after: true });
  });

  test('the inner input belongs to no form', async ({ page }) => {
    await fixture(page, '<form><kl-input name="a" required></kl-input></form>');
    const r = await page.evaluate(() => {
      const form = document.querySelector('#fixture form');
      return { owner: document.querySelector('#fixture kl-input input').form, elements: [...form.elements].map((e) => e.localName) };
    });
    expect(r).toEqual({ owner: null, elements: ['kl-input'] });
  });

  test('Enter submits the form (implicit submission)', async ({ page }) => {
    await fixture(page, '<form><kl-input name="q" value="naira"></kl-input><kl-button>Go</kl-button></form>');
    await page.focus('#fixture kl-input input');
    await page.keyboard.press('Enter');
    await tick(page);
    expect(await page.evaluate(() => window.__submits)).toEqual([{ q: 'naira' }]);
  });

  test('reset restores the value attribute; fieldset disables the inner input', async ({ page }) => {
    await fixture(page, '<form><fieldset><kl-input name="a" value="start"></kl-input></fieldset></form>');
    await page.fill('#fixture kl-input input', 'edited');
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#fixture kl-input');
      document.querySelector('#fixture form').reset();
      document.querySelector('#fixture fieldset').disabled = true;
      await el.updateComplete;
      return { value: el.value, inner: el.control.value, disabled: el.control.disabled, data: el.hasAttribute('data-disabled') };
    });
    expect(r).toEqual({ value: 'start', inner: 'start', disabled: true, data: true });
  });

  test('slot children stay put; clicking the box focuses the input', async ({ page }) => {
    await fixture(page, '<kl-input><span slot="start" id="pre">₦</span></kl-input>');
    await page.click('#pre');
    const r = await page.evaluate(() => {
      const el = document.querySelector('#fixture kl-input');
      return { parent: document.getElementById('pre').parentElement === el, focused: document.activeElement === el.control, first: el.firstElementChild.id };
    });
    expect(r).toEqual({ parent: true, focused: true, first: 'pre' });
  });

  test('setCustomValidity marks it invalid', async ({ page }) => {
    await fixture(page, '<kl-input></kl-input>');
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#fixture kl-input');
      el.setCustomValidity('Account not found');
      await el.updateComplete;
      return [el.validity.customError, el.validationMessage];
    });
    expect(r).toEqual([true, 'Account not found']);
  });
});

for (const tag of ['kl-checkbox', 'kl-switch']) {
  test.describe(tag, () => {
    test('toggles on click, label-text click and Space, firing input and change', async ({ page }) => {
      await fixture(page, `<form><${tag} name="opt" value="yes">Option <b id="txt">text</b></${tag}></form>`);
      await page.evaluate((t) => {
        const el = document.querySelector(`#fixture ${t}`);
        for (const type of ['input', 'change']) el.addEventListener(type, () => window.__events.push(type));
      }, tag);
      await page.click(`#fixture ${tag}`);
      await page.click('#txt');
      await page.focus(`#fixture ${tag}`);
      await page.keyboard.press('Space');
      await tick(page);
      const r = await page.evaluate((t) => ({
        checked: document.querySelector(`#fixture ${t}`).checked,
        data: Object.fromEntries(new FormData(document.querySelector('#fixture form'))),
        events: window.__events,
      }), tag);
      expect(r).toEqual({ checked: true, data: { opt: 'yes' }, events: ['input', 'change', 'input', 'change', 'input', 'change'] });
    });

    test('required, reset and disabled', async ({ page }) => {
      await fixture(page, `<form><${tag} name="t" required>Agree</${tag}></form>`);
      const r = await page.evaluate(async (t) => {
        const el = document.querySelector(`#fixture ${t}`);
        const form = document.querySelector('#fixture form');
        await el.updateComplete;
        const before = [form.checkValidity(), el.validity.valueMissing, el.validationMessage.length > 0];
        el.click();
        await el.updateComplete;
        const after = form.checkValidity();
        form.reset();
        await el.updateComplete;
        el.disabled = true;
        await el.updateComplete;
        el.click();
        return { before, after, reset: el.checked, disabledClick: el.checked, tab: el.tabIndex };
      }, tag);
      expect(r).toEqual({ before: [false, true, true], after: true, reset: false, disabledClick: false, tab: -1 });
    });
  });
}

test('kl-checkbox indeterminate is mixed until toggled', async ({ page }) => {
  await fixture(page, '<kl-checkbox indeterminate>All</kl-checkbox>');
  const r = await page.evaluate(async () => {
    const el = document.querySelector('#fixture kl-checkbox');
    await el.updateComplete;
    const before = el.internals.ariaChecked;
    el.click();
    await el.updateComplete;
    return { before, after: el.internals.ariaChecked, indeterminate: el.indeterminate };
  });
  expect(r).toEqual({ before: 'mixed', after: 'true', indeterminate: false });
});

test.describe('kl-field', () => {
  const form = `<form novalidate-not>
    <kl-field id="f1"><label>Account number</label><kl-input name="acct" required pattern="\\d{10}"></kl-input><p slot="hint">10 digits</p></kl-field>
    <kl-field id="f2"><label>Bank</label><select class="kl-select" name="bank" required><option value="">Choose</option><option>GTBank</option></select></kl-field>
    <kl-field id="f3"><kl-checkbox name="ok" required>Confirm</kl-checkbox></kl-field>
    <kl-button>Send</kl-button></form>`;

  test('wires ids, for and aria-describedby without moving anything', async ({ page }) => {
    await fixture(page, form);
    const r = await page.evaluate(() => {
      const f = document.getElementById('f1');
      const label = f.querySelector('label');
      const input = f.querySelector('kl-input');
      const hint = f.querySelector('[slot=hint]');
      return {
        for: label.htmlFor === input.id,
        describedBy: input.getAttribute('aria-describedby') === hint.id,
        innerDescribedBy: input.control.getAttribute('aria-describedby') === hint.id,
        labelledBy: input.control.getAttribute('aria-labelledby') === label.id,
        order: [...f.children].map((c) => c.dataset.klPart),
        errorHidden: f.querySelector('[data-kl-part=error]').hidden,
      };
    });
    expect(r).toEqual({ for: true, describedBy: true, innerDescribedBy: true, labelledBy: true, order: ['label', 'control', 'hint', 'error'], errorHidden: true });
  });

  test('shows the error after the user leaves the field, hides it once valid', async ({ page }) => {
    await fixture(page, form);
    await page.fill('#f1 kl-input input', '123');
    const typing = await page.evaluate(() => document.querySelector('#f1 [data-kl-part=error]').hidden);
    await page.keyboard.press('Tab');
    await tick(page);
    const shown = await page.evaluate(() => {
      const f = document.getElementById('f1');
      const err = f.querySelector('[data-kl-part=error]');
      const input = f.querySelector('kl-input');
      return {
        hidden: err.hidden,
        text: err.textContent.length > 0,
        invalid: input.control.getAttribute('aria-invalid'),
        describedBy: input.getAttribute('aria-describedby').includes(err.id),
        dataInvalid: f.hasAttribute('data-invalid'),
      };
    });
    await page.fill('#f1 kl-input input', '0123456789');
    await tick(page);
    const fixed = await page.evaluate(() => document.querySelector('#f1 [data-kl-part=error]').hidden);
    expect(typing).toBe(true);
    expect(shown).toEqual({ hidden: false, text: true, invalid: 'true', describedBy: true, dataInvalid: true });
    expect(fixed).toBe(true);
  });

  test('a submit attempt shows every error and focuses the first invalid control', async ({ page }) => {
    await fixture(page, form);
    await page.click('#fixture kl-button');
    await page.waitForTimeout(100);
    const r = await page.evaluate(() => ({
      shown: ['f1', 'f2', 'f3'].map((id) => !document.querySelector(`#${id} [data-kl-part=error]`).hidden),
      focused: document.activeElement === document.querySelector('#f1 kl-input').control,
      submits: window.__submits.length,
    }));
    expect(r).toEqual({ shown: [true, true, true], focused: true, submits: 0 });
  });

  test('error="…" shows immediately and blocks the form until cleared', async ({ page }) => {
    await fixture(page, '<form><kl-field id="f"><label>Promo</label><kl-input name="p" value="SAVE"></kl-input></kl-field></form>');
    const r = await page.evaluate(async () => {
      const f = document.getElementById('f');
      const form = document.querySelector('#fixture form');
      f.setAttribute('error', 'Code expired');
      await f.updateComplete;
      await f.control.updateComplete;
      await new Promise((r) => setTimeout(r));
      const err = f.querySelector('[data-kl-part=error]');
      const on = { text: err.textContent, hidden: err.hidden, valid: form.checkValidity() };
      f.removeAttribute('error');
      await f.updateComplete;
      await f.control.updateComplete;
      await new Promise((r) => setTimeout(r));
      return { on, offHidden: err.hidden, offValid: form.checkValidity() };
    });
    expect(r).toEqual({ on: { text: 'Code expired', hidden: false, valid: false }, offHidden: true, offValid: true });
  });

  test('form reset clears shown errors', async ({ page }) => {
    await fixture(page, form);
    await page.click('#fixture kl-button');
    await page.waitForTimeout(50);
    await page.evaluate(() => document.querySelector('#fixture form').reset());
    await page.waitForTimeout(50);
    expect(await page.evaluate(() => document.querySelector('#f1 [data-kl-part=error]').hidden)).toBe(true);
  });

  test('tracks data-filled and data-required', async ({ page }) => {
    await fixture(page, form);
    await page.fill('#f1 kl-input input', '1');
    await tick(page);
    const r = await page.evaluate(() => ({
      filled: document.getElementById('f1').hasAttribute('data-filled'),
      required: document.getElementById('f1').hasAttribute('data-required'),
      choiceFilled: document.getElementById('f3').hasAttribute('data-filled'),
    }));
    expect(r).toEqual({ filled: true, required: true, choiceFilled: false });
  });
});

test.describe('ripple', () => {
  test('pressing records the point and sets data-pressed; the directive cleans up', async ({ page }) => {
    await fixture(page, '<button class="kl-btn" data-kl-ripple id="r">Pay</button>');
    await page.click('#r', { position: { x: 10, y: 10 } });
    const r = await page.evaluate(async () => {
      const el = document.getElementById('r');
      const x = el.style.getPropertyValue('--kl-press-x');
      el.removeAttribute('data-kl-ripple');
      await new Promise((r) => setTimeout(r));
      el.style.removeProperty('--kl-press-x');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
      return { x: parseFloat(x), after: el.style.getPropertyValue('--kl-press-x') };
    });
    expect(Math.abs(r.x - 10)).toBeLessThanOrEqual(1.5); // the border shifts the box by 1px
    expect(r.after).toBe('');
  });
});
