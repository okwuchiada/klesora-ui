import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

// site/ is built once by e2e/global-setup.ts.

test('every page loads without console errors and marks itself current', async ({ page }) => {
  const pages = ['', ...JSON.parse(readFileSync('site/search.json', 'utf8')).map((e) => e.url)];
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`${page.url()} ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && errors.push(`${page.url()} ${m.text()}`));
  for (const path of pages) {
    await page.goto(`/site/${path}`);
    await expect(page.locator('h1').first()).toBeVisible();
    if (path) await expect(page.locator(`.kl-sidebar a[aria-current="page"]`)).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});

test('component pages list attributes from the manifest', async ({ page }) => {
  await page.goto('/site/components/amount-input/');
  const rows = page.locator('#attributes-and-properties + .doc-table tbody tr');
  await expect(rows.filter({ hasText: 'allow-negative' })).toHaveCount(1);
  await expect(rows.filter({ hasText: 'minLength' })).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'kl-amount-input', exact: false })).toHaveCount(0);
});

test('editing an example updates the preview; reset restores it; copy grabs the source', async ({ page, context, browserName }) => {
  await page.goto('/site/components/button/');
  const example = page.locator('.doc-example[data-lang="html"]').first();
  const code = example.locator('textarea');
  await code.fill('<kl-button variant="danger">Edited live</kl-button>');
  // The preview re-renders after a short debounce; wait for it to settle on the edit.
  await expect(example.locator('.doc-example__preview kl-button')).toHaveCount(1);
  await expect(example.locator('.doc-example__preview kl-button')).toHaveText('Edited live');
  if (browserName === 'chromium') {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await example.getByRole('button', { name: 'Copy', exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('<kl-button variant="danger">Edited live</kl-button>');
    await expect(example.getByRole('button', { name: 'Copied' })).toBeVisible();
  }
  await example.getByRole('button', { name: 'Reset' }).click();
  await expect(example.locator('.doc-example__preview kl-button').first()).toHaveText('Pay');
});

test('compare renders the example in all three styles', async ({ page }) => {
  await page.goto('/site/components/button/');
  const example = page.locator('.doc-example[data-lang="html"]').first();
  await example.getByRole('button', { name: 'Compare styles' }).click();
  await expect(example.locator('.doc-example__pane')).toHaveCount(3);
  expect(await example.locator('.doc-example__pane').evaluateAll((panes) => panes.map((p) => p.dataset.klStyle))).toEqual(['mono', 'solo', 'chorus']);
  await expect(example.getByRole('button', { name: 'Compare styles' })).toHaveAttribute('aria-pressed', 'true');
});

test('JS examples run against the library', async ({ page }) => {
  await page.goto('/site/guides/services/');
  const money = page.locator('#money ~ .doc-example[data-lang="js"]').first();
  await money.getByRole('button', { name: 'Run' }).click();
  await expect(page.locator('.kl-toast__title').first()).toHaveText('₦45,000.50');
  await money.locator('textarea').fill('throw new Error("nope")');
  await money.getByRole('button', { name: 'Run' }).click();
  await expect(money.locator('.doc-example__status')).toHaveText('Error: nope');
});

test('the style switcher re-skins the site and is remembered across pages', async ({ page }) => {
  await page.goto('/site/');
  await page.locator('#doc-style').selectOption('chorus');
  await page.locator('#doc-theme').selectOption('dark');
  await page.goto('/site/components/tabs/');
  const r = await page.evaluate(() => [document.documentElement.dataset.klStyle, document.documentElement.dataset.klTheme, (document.getElementById('doc-style') as HTMLSelectElement).value]);
  expect(r).toEqual(['chorus', 'dark', 'chorus']);
  await page.evaluate(() => localStorage.clear());
});

test('search finds pages and navigates with the keyboard', async ({ page }) => {
  await page.goto('/site/');
  await page.keyboard.press('/');
  await page.keyboard.type('amount');
  const results = page.locator('#doc-search-results');
  await expect(results.getByRole('link', { name: /Amount input/ })).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/components\/amount-input\/$/);
});

test('the theming builder shows a live contrast readout', async ({ page }) => {
  await page.goto('/site/guides/theming/');
  await page.locator('#tb-brand').fill('#facc15');
  await expect(page.locator('#tb-contrast')).toContainText('Brand fill on page');
  await expect(page.locator('#tb-contrast')).toContainText('below 3:1');
  await expect(page.locator('[data-token-value="--kl-color-primary"]').first()).not.toBeEmpty();
});
