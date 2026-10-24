import { test, expect, type Page } from '@playwright/test';

const settle = (page: Page, ms = 80) => page.waitForTimeout(ms);

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/layout.html');
  await page.waitForFunction(() => customElements.get('kl-tabs'));
  await settle(page);
});

test.describe('tabs', () => {
  test('wires roles, ids and panels; only the selected panel shows', async ({ page }) => {
    const r = await page.evaluate(() => {
      const root = document.getElementById('tabs');
      const tabs = [...root.querySelectorAll('.kl-tabs__tab')];
      const panels = [...root.querySelectorAll('.kl-tabs__panel')];
      return {
        list: root.querySelector('.kl-tabs__list').getAttribute('role'),
        listLabel: root.querySelector('.kl-tabs__list').getAttribute('aria-label'),
        selected: tabs.map((t) => t.getAttribute('aria-selected')),
        tabindex: tabs.map((t) => t.tabIndex),
        controls: tabs.every((t, i) => t.getAttribute('aria-controls') === panels[i].id),
        labelled: panels.every((p, i) => p.getAttribute('aria-labelledby') === tabs[i].id),
        hidden: panels.map((p) => p.hidden),
        value: root.value,
      };
    });
    expect(r).toEqual({
      list: 'tablist',
      listLabel: 'Account',
      selected: ['true', 'false', 'false', 'false'],
      tabindex: [0, -1, -1, -1],
      controls: true,
      labelled: true,
      hidden: [false, true, true, true],
      value: 'overview',
    });
    await expect(page.getByRole('tab', { name: 'Activity' })).toHaveCount(1);
    await expect(page.getByRole('tabpanel', { name: 'Overview' })).toBeVisible();
  });

  test('arrow keys select automatically, skipping disabled tabs, and fire kl-change', async ({ page }) => {
    await page.evaluate(() => {
      window.__changes = [];
      document.getElementById('tabs').addEventListener('kl-change', (e) => window.__changes.push(e.detail.value));
    });
    await page.getByRole('tab', { name: 'Overview' }).focus();
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowRight', 'Home', 'End', 'ArrowLeft']) await page.keyboard.press(key);
    const r = await page.evaluate(() => ({ changes: window.__changes, value: document.getElementById('tabs').value, focus: document.activeElement.textContent }));
    expect(r).toEqual({ changes: ['activity', 'settings', 'overview', 'overview', 'settings', 'activity'].filter((v, i, a) => i === 0 || v !== a[i - 1]), value: 'activity', focus: 'Activity' });
  });

  test('setting value selects a tab; clicking works', async ({ page }) => {
    await page.evaluate(async () => {
      const t = document.getElementById('tabs');
      t.value = 'settings';
      await t.updateComplete;
    });
    await expect(page.getByRole('tabpanel', { name: 'Settings' })).toBeVisible();
    await page.getByRole('tab', { name: 'Activity' }).click();
    await expect(page.getByRole('tabpanel', { name: 'Activity' })).toBeVisible();
    await expect(page.locator('#tabs')).toHaveAttribute('value', 'activity');
  });

  test('class-layer tabs: manual activation and vertical arrows', async ({ page }) => {
    await page.getByRole('tab', { name: 'Transfers' }).focus();
    await page.keyboard.press('ArrowDown');
    const moved = await page.evaluate(() => ({ focus: document.activeElement.textContent, selected: document.querySelector('#class-tabs [aria-selected="true"]').textContent }));
    await page.keyboard.press('Enter');
    const chosen = await page.evaluate(() => document.querySelector('#class-tabs [aria-selected="true"]').textContent);
    await expect(page.locator('#class-tabs .kl-tabs__list')).toHaveAttribute('aria-orientation', 'vertical');
    expect([moved, chosen]).toEqual([{ focus: 'Cards', selected: 'Transfers' }, 'Cards']);
  });
});

test.describe('table', () => {
  const column = (page: Page, i: number) => page.evaluate((n) => [...document.querySelectorAll('#tx tbody tr')].map((r) => r.cells[n].textContent.trim()), i);

  test('sort buttons set aria-sort, fire kl-sort and (data-kl-table="dom") re-order rows', async ({ page }) => {
    await page.evaluate(() => {
      window.__sorts = [];
      document.getElementById('tx').addEventListener('kl-sort', (e) => window.__sorts.push(`${e.detail.key}:${e.detail.direction}`));
    });
    await page.getByRole('button', { name: 'Amount' }).click();
    const asc = await column(page, 4);
    await page.getByRole('button', { name: 'Amount' }).click();
    const desc = await column(page, 4);
    await page.getByRole('button', { name: 'Date' }).click();
    const byDate = await column(page, 1);
    const sortAttrs = await page.evaluate(() => [...document.querySelectorAll('#tx thead th')].map((th) => th.getAttribute('aria-sort')));
    expect(asc).toEqual(['-₦45,000.00', '-₦12,500.00', '-₦3,200.00', '₦850,000.00']);
    expect(desc).toEqual(['₦850,000.00', '-₦3,200.00', '-₦12,500.00', '-₦45,000.00']);
    expect(byDate).toEqual(['1 Oct', '12 Oct', '18 Oct', '20 Oct']);
    expect(sortAttrs).toEqual([null, 'ascending', null, null, null]);
    expect(await page.evaluate(() => window.__sorts)).toEqual(['amount:ascending', 'amount:descending', 'date:ascending']);
  });

  test('a cancelled kl-sort changes nothing', async ({ page }) => {
    await page.evaluate(() => document.getElementById('tx').addEventListener('kl-sort', (e) => e.preventDefault()));
    const before = await column(page, 2);
    await page.getByRole('button', { name: 'Description' }).click();
    expect([await column(page, 2), await page.locator('#tx th[aria-sort]').count()]).toEqual([before, 0]);
  });

  test('select-all toggles rows, shows indeterminate and fires kl-change', async ({ page }) => {
    await page.evaluate(() => {
      window.__sel = [];
      document.getElementById('tx').addEventListener('kl-change', (e) => window.__sel.push(e.detail.selected.join(',')));
    });
    await page.getByRole('checkbox', { name: 'Select Salary' }).check();
    const partial = await page.evaluate(() => [document.querySelector('[data-kl-select-all]').indeterminate, document.querySelectorAll('#tx tr[aria-selected="true"]').length]);
    await page.getByRole('checkbox', { name: 'Select all' }).check();
    const all = await page.evaluate(() => document.querySelectorAll('#tx tr[aria-selected="true"]').length);
    await page.getByRole('checkbox', { name: 'Select all' }).uncheck();
    expect({ partial, all, events: await page.evaluate(() => window.__sel) }).toEqual({ partial: [true, 1], all: 4, events: ['t2', 't1,t2,t3,t4', ''] });
  });

  test('cells get data-label; the scroll wrapper is a focusable, labelled region', async ({ page }) => {
    const r = await page.evaluate(() => {
      const wrap = document.querySelector('.kl-table-wrap');
      return { labels: [...document.querySelector('#tx tbody tr').cells].map((c) => c.dataset.label), wrap: [wrap.tabIndex, wrap.getAttribute('role'), wrap.getAttribute('aria-label')] };
    });
    expect(r).toEqual({ labels: [undefined, 'Date', 'Description', 'Status', 'Amount'], wrap: [0, 'region', 'Recent transactions'] });
  });
});

test.describe('sidebar', () => {
  test('collapses to a rail and back, keeping link names for screen readers', async ({ page }) => {
    const toggle = page.getByRole('button', { name: 'Collapse sidebar' });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await toggle.click();
    await settle(page, 400);
    const r = await page.evaluate(() => ({ width: Math.round(document.getElementById('sidebar').getBoundingClientRect().width), collapsed: document.getElementById('sidebar').hasAttribute('data-collapsed') }));
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', { name: 'Transfers' })).toHaveCount(1);
    expect(r).toEqual({ width: 64, collapsed: true });
  });

  test('is a drawer on phones: opens from the navbar, closes on Escape and on a link', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await settle(page, 150);
    const sidebar = page.locator('#sidebar');
    await expect(sidebar).toHaveAttribute('data-drawer', '');
    await expect(sidebar).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await settle(page, 300);
    await expect(sidebar).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'true');
    await page.keyboard.press('Escape');
    await settle(page, 300);
    await expect(sidebar).toBeHidden();
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await settle(page, 300);
    await page.getByRole('link', { name: 'Statements' }).click();
    await settle(page, 300);
    await expect(sidebar).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await settle(page, 150);
    await expect(sidebar).toBeVisible();
    await expect(sidebar).not.toHaveAttribute('popover', /.*/);
  });
});

test.describe('navbar', () => {
  test('collapses links into a menu panel on phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await settle(page, 150);
    const menu = page.locator('#nav-toggle');
    await expect(page.locator('.kl-navbar')).toHaveAttribute('data-compact', '');
    await expect(page.getByRole('link', { name: 'Payments' })).toBeHidden();
    await menu.click();
    await settle(page, 200);
    await expect(page.getByRole('link', { name: 'Payments' })).toBeVisible();
    await expect(menu).toHaveAttribute('aria-expanded', 'true');
    await page.getByRole('link', { name: 'Payments' }).click();
    await settle(page, 200);
    await expect(page.getByRole('link', { name: 'Payments' })).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  });

  test('is an inline link list on desktop', async ({ page }) => {
    await expect(page.locator('.kl-navbar')).not.toHaveAttribute('data-compact', /.*/);
    await expect(page.getByRole('link', { name: 'Payments' })).toBeVisible();
    await expect(page.locator('#nav-toggle')).toBeHidden();
  });
});

test.describe('card', () => {
  test('the whole card follows its link; inner buttons still get their own clicks', async ({ page }) => {
    await page.evaluate(() => {
      window.__clicked = null;
      document.getElementById('card-button').addEventListener('click', () => (window.__clicked = 'button'));
    });
    await page.click('#card-button');
    const button = await page.evaluate(() => [window.__clicked, location.hash]);
    const box = await page.locator('#link-card').boundingBox();
    await page.mouse.click(box.x + 20, box.y + 20); // on the media area, away from the link text
    expect([button, await page.evaluate(() => location.hash)]).toEqual([['button', ''], '#statements']);
  });
});
