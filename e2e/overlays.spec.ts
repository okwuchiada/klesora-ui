import { test, expect, type Page } from '@playwright/test';

const settle = (page: Page, ms = 80) => page.waitForTimeout(ms);
const isOpen = (page: Page, id: string) => page.evaluate((i) => document.getElementById(i).matches(':popover-open'), id);
const active = (page: Page) => page.evaluate(() => document.activeElement?.textContent?.trim());

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/overlays.html');
  await page.waitForFunction(() => ['kl-menu', 'kl-select', 'kl-option', 'kl-button'].every((t) => customElements.get(t)));
  await settle(page);
});

test.describe('role fallback attributes', () => {
  test('getByRole finds our elements (attributes mirror ElementInternals)', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Account', exact: true })).toHaveCount(1);
    // 'Bank' also labels the three side-by-side demos further down.
    await expect(page.getByRole('combobox', { name: 'Bank', exact: true })).toHaveCount(4);
    await expect(page.locator('#bank')).toHaveAttribute('role', 'combobox');
    await expect(page.locator('#bank')).toHaveAttribute('aria-expanded', 'false');
  });

  test("the author's own role attribute wins", async ({ page }) => {
    const role = await page.evaluate(async () => {
      const b = document.createElement('kl-button');
      b.setAttribute('role', 'tab');
      document.body.append(b);
      await b.updateComplete;
      return [b.getAttribute('role'), b.internals.role];
    });
    expect(role).toEqual(['tab', 'button']);
  });
});

test.describe('kl-menu', () => {
  test('opens from its button, positions below it and focuses the first item', async ({ page }) => {
    await page.getByRole('button', { name: 'Account', exact: true }).click();
    await settle(page);
    const r = await page.evaluate(() => {
      const m = document.getElementById('account-menu');
      const b = document.getElementById('account-btn');
      return {
        open: m.matches(':popover-open'),
        placement: m.dataset.placement,
        below: Math.round(m.getBoundingClientRect().top - b.getBoundingClientRect().bottom),
        expanded: b.getAttribute('aria-expanded'),
        haspopup: b.getAttribute('aria-haspopup'),
        controls: b.getAttribute('aria-controls'),
      };
    });
    expect(r).toEqual({ open: true, placement: 'bottom-start', below: 4, expanded: 'true', haspopup: 'menu', controls: 'account-menu' });
    expect(await active(page)).toBe('Download statement');
    await expect(page.getByRole('menuitem')).not.toHaveCount(0);
  });

  test('arrow keys, Home/End and type-to-find move focus, skipping disabled items', async ({ page }) => {
    await page.click('#account-btn');
    await settle(page);
    const seen = [];
    for (const key of ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'Home', 'End', 'ArrowDown']) {
      await page.keyboard.press(key);
      seen.push(await active(page));
    }
    await page.keyboard.press('t');
    seen.push(await active(page));
    expect(seen).toEqual(['Account details', 'Transfer limits', 'Freeze card', 'Download statement', 'Download statement', 'Freeze card', 'Download statement', 'Transfer limits']);
  });

  test('choosing an item fires kl-select, closes and returns focus', async ({ page }) => {
    await page.evaluate(() => document.addEventListener('kl-select', (e) => (window.__chose = e.detail.value)));
    await page.click('#account-btn');
    await settle(page);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle(page);
    expect(await page.evaluate(() => window.__chose)).toBe('details');
    expect(await isOpen(page, 'account-menu')).toBe(false);
    expect(await page.evaluate(() => document.activeElement.id)).toBe('account-btn');
    await expect(page.locator('#account-btn')).toHaveAttribute('aria-expanded', 'false');
  });

  test('a cancelled kl-select keeps the menu open; disabled items do nothing', async ({ page }) => {
    await page.evaluate(() => document.getElementById('account-menu').addEventListener('kl-select', (e) => e.preventDefault()));
    await page.click('#account-btn');
    await settle(page);
    await page.getByRole('menuitem', { name: 'Transfer limits' }).click();
    await page.getByRole('menuitem', { name: 'Close account' }).click({ force: true });
    expect(await isOpen(page, 'account-menu')).toBe(true);
  });

  test('Escape, Tab, outside clicks and the button itself close it', async ({ page }) => {
    for (const close of ['Escape', 'Tab', 'outside', 'button']) {
      await page.click('#account-btn');
      await settle(page);
      expect(await isOpen(page, 'account-menu'), `open before ${close}`).toBe(true);
      if (close === 'outside') await page.mouse.click(900, 700);
      else if (close === 'button') await page.click('#account-btn');
      else await page.keyboard.press(close);
      await settle(page);
      expect(await isOpen(page, 'account-menu'), `closed by ${close}`).toBe(false);
    }
  });

  test('ArrowDown / ArrowUp on the button open it at the first / last item', async ({ page }) => {
    await page.focus('#account-btn');
    await page.keyboard.press('ArrowDown');
    await settle(page);
    const first = await active(page);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ArrowUp');
    await settle(page);
    expect([first, await active(page)]).toEqual(['Download statement', 'Freeze card']);
  });

  test('flips above its button when there is no room below', async ({ page }) => {
    await page.evaluate(() => {
      const b = document.getElementById('bottom-btn');
      window.scrollTo(0, b.getBoundingClientRect().bottom + window.scrollY - window.innerHeight + 10);
    });
    await page.click('#bottom-btn');
    await settle(page);
    const r = await page.evaluate(() => {
      const m = document.getElementById('bottom-menu');
      return { placement: m.dataset.placement, above: m.getBoundingClientRect().bottom <= document.getElementById('bottom-btn').getBoundingClientRect().top };
    });
    expect(r).toEqual({ placement: 'top-start', above: true });
  });

  test('follows its button when a container scrolls', async ({ page }) => {
    await page.locator('[popovertarget="scroll-menu"]').scrollIntoViewIfNeeded();
    await page.click('[popovertarget="scroll-menu"]');
    await settle(page);
    const delta = await page.evaluate(async () => {
      const m = document.getElementById('scroll-menu');
      const box = m.closest('[style*="overflow"]') ?? document.querySelector('[popovertarget="scroll-menu"]').closest('div[style]').parentElement;
      const before = m.getBoundingClientRect().top;
      document.querySelector('[popovertarget="scroll-menu"]').closest('div[style*="overflow: auto"]').scrollTop += 40;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      return Math.round(before - m.getBoundingClientRect().top);
    });
    expect(delta).toBe(40);
  });

  test('class-layer panel with data-kl-menu behaves the same', async ({ page }) => {
    await page.evaluate(() => document.addEventListener('kl-select', (e) => (window.__chose = e.detail.value)));
    await page.click('[popovertarget="class-menu"]');
    await settle(page);
    const roles = await page.evaluate(() => [document.getElementById('class-menu').getAttribute('role'), ...[...document.querySelectorAll('#class-menu .kl-menu__item')].map((i) => i.getAttribute('role'))]);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await settle(page);
    expect(roles).toEqual(['menu', 'menuitem', 'menuitem', 'menuitem']);
    expect(await page.evaluate(() => window.__chose)).toBe('share');
    expect(await isOpen(page, 'class-menu')).toBe(false);
  });
});

test.describe('kl-select', () => {
  const value = (page: Page, id: string) => page.evaluate((i) => document.getElementById(i).value, id);

  test('click to open, click an option to choose; fires input and change once', async ({ page }) => {
    await page.evaluate(() => {
      window.__ev = [];
      for (const t of ['input', 'change']) document.getElementById('bank').addEventListener(t, () => window.__ev.push(t));
    });
    await page.locator('#bank').click();
    await settle(page);
    await expect(page.getByRole('listbox')).toBeVisible();
    await page.getByRole('option', { name: 'Kuda' }).click();
    await settle(page);
    expect(await value(page, 'bank')).toBe('kuda');
    expect(await page.evaluate(() => [window.__ev, document.getElementById('bank').open, document.activeElement.id])).toEqual([['input', 'change'], false, 'bank']);
    await expect(page.locator('#bank [data-kl-part=value]')).toHaveText('Kuda');
  });

  test('keyboard: open, move (skipping disabled), choose; Escape keeps the value', async ({ page }) => {
    await page.focus('#bank');
    await page.keyboard.press('Enter');
    await settle(page);
    await page.keyboard.press('End');
    await page.keyboard.press('ArrowUp'); // UBA is disabled: lands on OPay
    const activeId = await page.evaluate(() => document.getElementById('bank').getAttribute('aria-activedescendant'));
    await page.keyboard.press('Enter');
    await settle(page);
    expect(await value(page, 'bank')).toBe('opay');
    expect(activeId).toMatch(/-4$/);
    await page.keyboard.press('ArrowDown');
    await settle(page);
    await page.keyboard.press('Home');
    await page.keyboard.press('Escape');
    await settle(page);
    expect(await value(page, 'bank')).toBe('opay');
  });

  test('typing while closed picks a match without opening', async ({ page }) => {
    await page.focus('#bank');
    await page.keyboard.type('z');
    expect([await value(page, 'bank'), await page.evaluate(() => document.getElementById('bank').open)]).toEqual(['zenith', false]);
  });

  test('submits with the form, validates required, and resets to the initial option', async ({ page }) => {
    await page.evaluate(() => {
      window.__data = null;
      document.getElementById('select-form').addEventListener('submit', (e) => (window.__data = Object.fromEntries(new FormData(e.target))));
    });
    await page.getByRole('button', { name: 'Submit' }).click();
    await settle(page, 120);
    const blocked = await page.evaluate(() => ({
      data: window.__data,
      error: !document.querySelector('#bank').closest('kl-field').querySelector('[data-kl-part=error]').hidden,
      focused: document.activeElement.id,
    }));
    expect(blocked).toEqual({ data: null, error: true, focused: 'bank' });

    await page.keyboard.press('Enter');
    await settle(page);
    await page.keyboard.press('Enter');
    await page.click('#currency');
    await settle(page);
    await page.getByRole('option', { name: /Pound/ }).click();
    await page.getByRole('button', { name: 'Submit' }).click();
    await settle(page, 120);
    expect(await page.evaluate(() => window.__data)).toMatchObject({ bank: 'access', currency: 'GBP' });

    await page.getByRole('button', { name: 'Reset' }).click();
    await settle(page, 120);
    expect([await value(page, 'bank'), await value(page, 'currency')]).toEqual(['', 'NGN']);
  });

  test('renders options added later and keeps your <kl-option>s in place', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const day = document.getElementById('day');
      const options = day.querySelectorAll('kl-option').length;
      const o = document.createElement('kl-option');
      o.value = '32';
      o.textContent = 'Day 32';
      day.append(o);
      await new Promise((r) => setTimeout(r, 30));
      return { options, rendered: day.querySelectorAll('[role=option]').length, authorsStay: o.parentElement === day };
    });
    expect(r).toEqual({ options: 31, rendered: 32, authorsStay: true });
  });

  test('clicking its label focuses without opening', async ({ page }) => {
    await page.getByText('Currency', { exact: true }).click();
    await settle(page);
    expect(await page.evaluate(() => [document.activeElement.id, document.getElementById('currency').open])).toEqual(['currency', false]);
  });
});

test.describe('kl-button popovertarget', () => {
  test('toggles its popover like a native button', async ({ page }) => {
    await page.click('[popovertarget="dark-menu"]');
    await settle(page);
    const opened = await isOpen(page, 'dark-menu');
    await page.click('[popovertarget="dark-menu"]');
    await settle(page);
    expect([opened, await isOpen(page, 'dark-menu')]).toEqual([true, false]);
  });
});

test.describe('data-kl-tooltip', () => {
  const tip = (page: Page) =>
    page.evaluate(() => {
      const t = document.querySelector('.kl-tooltip');
      return t ? { open: t.matches(':popover-open'), text: t.textContent } : { open: false, text: '' };
    });
  const copy = '[data-kl-tooltip="Copy account number"]';

  test('hover shows after a delay and hides on leave', async ({ page }) => {
    await page.hover(copy);
    await settle(page, 100);
    const early = (await tip(page)).open;
    await settle(page, 450);
    const shown = await tip(page);
    await page.mouse.move(2, 400); // empty page margin, away from other tooltips
    await settle(page, 250);
    const after = await tip(page);
    expect({ early, shown, after: after.open }).toEqual({ early: false, shown: { open: true, text: 'Copy account number' }, after: false });
  });

  test('keyboard focus shows it immediately; Escape hides it', async ({ page }) => {
    await page.focus('#account-btn');
    await page.keyboard.press('Tab'); // the class-layer menu button
    await page.locator(copy).focus();
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Tab');
    await settle(page);
    const shown = await tip(page);
    await page.keyboard.press('Escape');
    await settle(page);
    expect([shown.open, (await tip(page)).open]).toEqual([true, false]);
  });

  test('is announced via aria-description and can be hovered itself', async ({ page }) => {
    await expect(page.locator(copy)).toHaveAttribute('aria-description', 'Copy account number');
    await page.hover(copy);
    await settle(page, 550);
    const box = await page.locator('.kl-tooltip').boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 4 });
    await settle(page, 250);
    expect((await tip(page)).open).toBe(true);
  });

  test("inherits the anchor's theme", async ({ page }) => {
    await page.hover('[data-kl-tooltip="Tooltip follows the panel\'s theme"]');
    await settle(page, 550);
    expect(await page.evaluate(() => document.querySelector('.kl-tooltip').closest('[data-kl-theme]')?.dataset.klTheme)).toBe('dark');
  });
});
