import { test, expect, type Page } from '@playwright/test';

const settle = (page: Page, ms = 60) => page.waitForTimeout(ms);

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/fintech.html');
  await page.waitForFunction(() => ['kl-amount-input', 'kl-otp-input', 'kl-transaction-list', 'kl-stepper'].every((t) => customElements.get(t)));
  await settle(page);
});

/** Fresh fixture element prepended to <body>. */
async function mount(page: Page, html: string) {
  await page.evaluate((markup) => {
    document.getElementById('fx')?.remove();
    const host = document.createElement('form');
    host.id = 'fx';
    host.innerHTML = markup;
    document.body.prepend(host);
  }, html);
  await settle(page);
}

const amount = (page: Page, sel = '#fx kl-amount-input') =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    return { text: el.control.value, value: el.value, caret: el.control.selectionStart };
  }, sel);

test.describe('kl-amount-input', () => {
  test('groups thousands live and keeps the caret in place', async ({ page }) => {
    await mount(page, '<kl-amount-input name="a" currency="NGN" locale="en-NG"></kl-amount-input>');
    await page.click('#fx kl-amount-input input');
    await page.keyboard.type('1234567');
    const typed = await amount(page);
    // Insert a digit in the middle: caret after "1,2" → type 9
    await page.evaluate(() => document.querySelector('#fx kl-amount-input').control.setSelectionRange(3, 3));
    await page.keyboard.type('9');
    const middle = await amount(page);
    expect(typed).toEqual({ text: '1,234,567', value: '1234567', caret: 9 });
    expect(middle).toEqual({ text: '12,934,567', value: '12934567', caret: 4 });
  });

  test('limits decimals to the currency, pads on blur, and submits the canonical value', async ({ page }) => {
    await mount(page, '<kl-amount-input name="a" locale="en-NG"></kl-amount-input><kl-amount-input name="y" currency="JPY" locale="ja-JP"></kl-amount-input>');
    await page.click('#fx kl-amount-input[name=a] input');
    await page.keyboard.type('45000.567');
    const during = await amount(page, '#fx kl-amount-input[name=a]');
    await page.click('#fx kl-amount-input[name=y] input');
    await page.keyboard.type('1500.5');
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const [a, y] = document.querySelectorAll('#fx kl-amount-input');
      return { a: [a.control.value, a.value, a.minorUnits], y: [y.control.value, y.value, y.minorUnits], data: Object.fromEntries(new FormData(document.getElementById('fx'))) };
    });
    expect(during).toMatchObject({ text: '45,000.56', value: '45000.56' });
    expect(r).toEqual({ a: ['45,000.56', '45000.56', 4500056], y: ['15,005', '15005', 15005], data: { a: '45000.56', y: '15005' } });
  });

  test('pasting a formatted amount keeps only the number', async ({ page }) => {
    await mount(page, '<kl-amount-input name="a" locale="en-NG"></kl-amount-input>');
    await page.click('#fx kl-amount-input input');
    await page.evaluate(() => {
      const input = document.querySelector('#fx kl-amount-input').control;
      input.value = '₦45,000.00';
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
    });
    expect(await amount(page)).toMatchObject({ text: '45,000.00', value: '45000.00' });
  });

  test('Backspace after a separator deletes the digit before it', async ({ page }) => {
    await mount(page, '<kl-amount-input locale="en-NG" value="1234567"></kl-amount-input>');
    await page.click('#fx kl-amount-input input');
    await page.evaluate(() => {
      const el = document.querySelector('#fx kl-amount-input');
      el.control.value = '1,234,567';
      el.control.setSelectionRange(2, 2); // just after the first comma
    });
    await page.keyboard.press('Backspace');
    expect(await amount(page)).toMatchObject({ text: '234,567', value: '234567' });
  });

  test('uses the locale: de-DE comma decimals and the symbol after the number', async ({ page }) => {
    await mount(page, '<kl-amount-input currency="EUR" locale="de-DE"></kl-amount-input>');
    await page.click('#fx kl-amount-input input');
    await page.keyboard.type('1234,5');
    await page.keyboard.press('Tab');
    const r = await page.evaluate(() => {
      const el = document.querySelector('#fx kl-amount-input');
      const symbol = el.querySelector('[data-kl-part=currency]');
      return { text: el.control.value, value: el.value, symbol: symbol.textContent, slot: symbol.slot, description: el.control.getAttribute('aria-description') };
    });
    expect(r).toEqual({ text: '1.234,50', value: '1234.50', symbol: '€', slot: 'end', description: 'Euro' });
  });

  test('min, max and required validate with formatted messages', async ({ page }) => {
    await mount(page, '<kl-amount-input locale="en-NG" min="100" max="5000000" required></kl-amount-input>');
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#fx kl-amount-input');
      const out = [];
      for (const v of ['', '99.99', '5000000.01', '100']) {
        el.value = v;
        await el.updateComplete;
        out.push([el.validity.valid, el.validationMessage]);
      }
      return out;
    });
    expect(r).toEqual([
      [false, 'Enter an amount.'],
      [false, 'Enter at least ₦100.00.'],
      [false, 'Enter no more than ₦5,000,000.00.'],
      [true, ''],
    ]);
  });

  test('exact beyond Number.MAX_SAFE_INTEGER; minorUnits setter; negatives only when allowed', async ({ page }) => {
    await mount(page, '<kl-amount-input id="big" locale="en-NG"></kl-amount-input><kl-amount-input id="neg" allow-negative locale="en-NG"></kl-amount-input><kl-amount-input id="pos" locale="en-NG"></kl-amount-input>');
    await page.click('#big input');
    await page.keyboard.type('90071992547409.93');
    await page.click('#neg input');
    await page.keyboard.type('-250');
    await page.click('#pos input');
    await page.keyboard.type('-250');
    const r = await page.evaluate(async () => {
      const big = document.getElementById('big');
      const set = document.createElement('kl-amount-input');
      document.getElementById('fx').append(set);
      set.minorUnits = 4500050;
      await set.updateComplete;
      return {
        big: [big.value, typeof big.minorUnits, String(big.minorUnits)],
        neg: document.getElementById('neg').value,
        pos: document.getElementById('pos').value,
        set: [set.value, set.control.value],
      };
    });
    // #neg lost focus (padded on blur); #pos still has it.
    expect(r).toEqual({ big: ['90071992547409.93', 'bigint', '9007199254740993'], neg: '-250.00', pos: '250', set: ['45000.50', '45,000.50'] });
  });

  test('form reset restores the initial value', async ({ page }) => {
    await mount(page, '<kl-amount-input name="a" locale="en-NG" value="500"></kl-amount-input>');
    await page.click('#fx kl-amount-input input');
    await page.keyboard.type('9');
    await page.evaluate(() => document.getElementById('fx').reset());
    await settle(page);
    expect(await amount(page)).toMatchObject({ text: '500.00', value: '500' });
  });
});

test.describe('kl-otp-input', () => {
  test('one real input: digits only, kl-complete once, form value, autofill hint', async ({ page }) => {
    await mount(page, '<kl-otp-input name="code" length="6"></kl-otp-input>');
    await page.evaluate(() => {
      window.__done = [];
      document.querySelector('#fx kl-otp-input').addEventListener('kl-complete', (e) => window.__done.push(e.detail.value));
    });
    await page.click('#fx kl-otp-input');
    await page.keyboard.type('12a3-45678');
    const r = await page.evaluate(() => {
      const el = document.querySelector('#fx kl-otp-input');
      return {
        value: el.value,
        slots: [...el.querySelectorAll('.kl-otp__slot')].map((s) => s.textContent).join(''),
        done: window.__done,
        data: new FormData(document.getElementById('fx')).get('code'),
        inputs: el.querySelectorAll('input').length,
        autocomplete: el.control.getAttribute('autocomplete'),
        inputmode: el.control.inputMode,
      };
    });
    expect(r).toEqual({ value: '123456', slots: '123456', done: ['123456'], data: '123456', inputs: 1, autocomplete: 'one-time-code', inputmode: 'numeric' });
  });

  test('paste fills every box; partial codes are tooShort; required when empty', async ({ page }) => {
    await mount(page, '<kl-otp-input length="4" required></kl-otp-input>');
    const r = await page.evaluate(async () => {
      const el = document.querySelector('#fx kl-otp-input');
      await el.updateComplete;
      const empty = [el.validity.valueMissing, el.validationMessage];
      el.control.value = '98';
      el.control.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await el.updateComplete;
      const partial = [el.validity.tooShort, el.validationMessage];
      el.control.value = ' 9 8 7 6 5 ';
      el.control.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }));
      await el.updateComplete;
      return { empty, partial, pasted: el.value, valid: el.validity.valid };
    });
    expect(r).toEqual({ empty: [true, 'Enter the 4-digit code.'], partial: [true, 'Enter all 4 digits.'], pasted: '9876', valid: true });
  });

  test('mask shows dots and uses a password field', async ({ page }) => {
    await mount(page, '<kl-otp-input length="4" mask></kl-otp-input>');
    await page.click('#fx kl-otp-input');
    await page.keyboard.type('2580');
    const r = await page.evaluate(() => {
      const el = document.querySelector('#fx kl-otp-input');
      return { type: el.control.type, slots: [...el.querySelectorAll('.kl-otp__slot')].map((s) => s.textContent).join(''), value: el.value };
    });
    expect(r).toEqual({ type: 'password', slots: '••••', value: '2580' });
  });

  test('alphanumeric keeps letters; clear() empties and refocuses', async ({ page }) => {
    await mount(page, '<kl-otp-input length="5" type="alphanumeric"></kl-otp-input>');
    await page.click('#fx kl-otp-input');
    await page.keyboard.type('ab-1C2');
    const typed = await page.evaluate(() => document.querySelector('#fx kl-otp-input').value);
    await page.evaluate(() => document.querySelector('#fx kl-otp-input').clear());
    await settle(page);
    const r = await page.evaluate(() => ({ value: document.querySelector('#fx kl-otp-input').value, focused: document.activeElement === document.querySelector('#fx kl-otp-input').control }));
    expect([typed, r]).toEqual(['ab1C2', { value: '', focused: true }]);
  });
});

test.describe('kl-transaction-list', () => {
  test('groups by day, newest first, with credit/debit cues and written statuses', async ({ page }) => {
    const r = await page.evaluate(() => {
      const list = document.getElementById('txns');
      return {
        groups: [...list.querySelectorAll('.kl-txn-list__date')].map((h) => h.textContent).slice(0, 2),
        titles: [...list.querySelectorAll('.kl-txn__title')].map((t) => t.textContent).slice(0, 4),
        salary: list.querySelector('[data-id=t2] .kl-txn__amount').textContent,
        ada: list.querySelector('[data-id=t1] .kl-txn__amount').textContent,
        statuses: [...list.querySelectorAll('.kl-txn__status')].map((s) => s.textContent),
        directions: [...list.querySelectorAll('.kl-txn')].map((t) => t.dataset.direction).slice(0, 2),
      };
    });
    expect(r).toEqual({
      groups: ['Today', 'Yesterday'],
      titles: ['Ada Obi', 'Salary — Paystack Ltd', 'Ikeja Electric', 'Bolt'],
      salary: 'Received +₦850,000.00₦850,000.00',
      ada: 'Sent −₦45,000.00₦45,000.00',
      statuses: ['Pending', 'Failed'],
      directions: ['debit', 'credit'],
    });
  });

  test('renders data as text only and refuses unsafe links', async ({ page }) => {
    await mount(page, '<kl-transaction-list></kl-transaction-list>');
    const r = await page.evaluate(async () => {
      const list = document.querySelector('#fx kl-transaction-list');
      list.items = [
        { id: 'x', title: '<img src=x onerror="window.__xss=1">', amount: '-1', href: 'javascript:window.__xss=2' },
        { id: 'y', title: 'Safe', amount: '1', href: '/statements' },
      ];
      await list.updateComplete;
      return {
        imgs: list.querySelectorAll('img').length,
        title: list.querySelector('[data-id=x] .kl-txn__title').textContent,
        badLink: list.querySelector('[data-id=x] a'),
        goodLink: list.querySelector('[data-id=y] a').getAttribute('href').endsWith('/statements'),
        xss: window.__xss ?? null,
      };
    });
    expect(r).toEqual({ imgs: 0, title: '<img src=x onerror="window.__xss=1">', badLink: null, goodLink: true, xss: null });
  });

  test('selectable rows are buttons that fire kl-select; empty state and labels', async ({ page }) => {
    await page.getByRole('button', { name: /Ikeja Electric/ }).click();
    const selected = await page.locator('#output').textContent();
    await mount(page, '<kl-transaction-list></kl-transaction-list>');
    const empty = await page.evaluate(async () => {
      const list = document.querySelector('#fx kl-transaction-list');
      list.labels = { empty: 'Nothing here' };
      await list.updateComplete;
      return list.textContent;
    });
    expect([selected, empty]).toEqual(['Selected: Ikeja Electric', 'Nothing here']);
  });
});

test.describe('kl-stepper', () => {
  test('sets states, aria-current and list roles from value', async ({ page }) => {
    const states = () =>
      page.evaluate(() => [...document.querySelectorAll('#stepper .kl-stepper__step')].map((s) => [s.dataset.state, s.getAttribute('aria-current'), s.getAttribute('aria-description')]));
    const before = await states();
    await page.getByRole('button', { name: 'Next step (top stepper)' }).click();
    await settle(page);
    expect(before).toEqual([
      ['complete', null, 'Completed'],
      ['current', 'step', null],
      ['upcoming', null, null],
      ['upcoming', null, null],
    ]);
    expect(await states()).toEqual([
      ['complete', null, 'Completed'],
      ['complete', null, 'Completed'],
      ['current', 'step', null],
      ['upcoming', null, null],
    ]);
    await expect(page.getByRole('list', { name: 'Transfer progress' }).getByRole('listitem')).toHaveCount(4);
  });
});
