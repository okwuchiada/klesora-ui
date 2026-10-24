import { test, expect, type Page } from '@playwright/test';

const settle = (page: Page, ms = 100) => page.waitForTimeout(ms);

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/services.html');
  await page.waitForFunction(() => customElements.get('kl-button'));
  await page.evaluate(() => import('/src/index.js').then((m) => (window.kl = m)));
});

test.describe('dialog service', () => {
  test('confirm resolves true on confirm, false on cancel, Escape and backdrop', async ({ page }) => {
    const run = async (how: string) => {
      await page.evaluate(() => {
      window.__r = window.kl.dialog.confirm({ title: 'Send ₦45,000?', message: 'To Ada Obi', confirmText: 'Send' });
    });
      await settle(page);
      if (how === 'confirm') await page.getByRole('button', { name: 'Send', exact: true }).click();
      if (how === 'cancel') await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click();
      if (how === 'escape') await page.keyboard.press('Escape');
      if (how === 'backdrop') await page.mouse.click(5, 5);
      return page.evaluate(() => window.__r);
    };
    expect([await run('confirm'), await run('cancel'), await run('escape'), await run('backdrop')]).toEqual([true, false, false, false]);
  });

  test('is a labelled modal; focus goes in and comes back; it is removed after closing', async ({ page }) => {
    await page.focus('#confirm');
    await page.evaluate(() => {
      window.__r = window.kl.dialog.confirm({ title: 'Freeze card?', message: 'You can unfreeze it any time.' });
    });
    await settle(page);
    const open = await page.evaluate(() => {
      const d = document.querySelector('dialog[open]');
      return {
        modal: d.matches(':modal'),
        title: document.getElementById(d.getAttribute('aria-labelledby')).textContent,
        desc: document.getElementById(d.getAttribute('aria-describedby')).textContent,
        focus: document.activeElement.textContent,
        scrollLocked: getComputedStyle(document.documentElement).overflow,
      };
    });
    await page.keyboard.press('Enter'); // focused confirm button
    await settle(page, 400);
    const after = await page.evaluate(async () => ({ result: await window.__r, focus: document.activeElement.id, dialogs: document.querySelectorAll('dialog.kl-dialog:not(#transfer-dialog)').length }));
    expect(open).toEqual({ modal: true, title: 'Freeze card?', desc: 'You can unfreeze it any time.', focus: 'OK', scrollLocked: 'hidden' });
    expect(after).toEqual({ result: true, focus: 'confirm', dialogs: 0 });
  });

  test('danger confirms are alertdialogs that focus Cancel first', async ({ page }) => {
    await page.evaluate(() => {
      window.kl.dialog.confirm({ title: 'Delete?', tone: 'danger', confirmText: 'Delete' });
    });
    await settle(page);
    const r = await page.evaluate(() => ({ role: document.querySelector('dialog[open]').getAttribute('role'), focus: document.activeElement.textContent, variant: document.querySelector('dialog[open] [value=confirm]').dataset.variant }));
    expect(r).toEqual({ role: 'alertdialog', focus: 'Cancel', variant: 'danger' });
  });

  test('prompt returns the text on Enter, null on cancel, and enforces required', async ({ page }) => {
    await page.evaluate(() => {
      window.__r = window.kl.dialog.prompt({ title: 'Rename card', label: 'Card name', defaultValue: 'Travel', required: true });
    });
    await settle(page);
    const labelled = await page.getByRole('textbox', { name: 'Card name' }).count();
    await page.keyboard.press('Backspace'); // text is selected: clears it
    await page.keyboard.press('Enter'); // blocked by required
    await settle(page);
    const stillOpen = await page.evaluate(() => Boolean(document.querySelector('dialog[open]')));
    await page.keyboard.type('Groceries');
    await page.keyboard.press('Enter');
    const value = await page.evaluate(() => window.__r);
    await page.evaluate(() => {
      window.__r = window.kl.dialog.prompt('Nickname');
    });
    await settle(page);
    await page.locator('dialog[open]').getByRole('button', { name: 'Cancel' }).click();
    expect({ labelled, stillOpen, value, cancelled: await page.evaluate(() => window.__r) }).toEqual({ labelled: 1, stillOpen: true, value: 'Groceries', cancelled: null });
  });

  test('alert resolves when acknowledged', async ({ page }) => {
    await page.evaluate(() => {
      window.__r = window.kl.dialog.alert('Statement ready').then(() => 'done');
    });
    await settle(page);
    await page.getByRole('button', { name: 'OK' }).click();
    expect(await page.evaluate(() => window.__r)).toBe('done');
  });
});

test.describe('dialog markup + directives', () => {
  test('data-kl-dialog-open opens it; data-kl-close and the backdrop close it with a value', async ({ page }) => {
    const results = [];
    for (const how of ['cancel', 'close', 'backdrop', 'send']) {
      await page.click('#open-markup');
      await settle(page);
      if (how === 'send') {
        await page.fill('#transfer-dialog kl-input input', '5000');
        await page.getByRole('button', { name: 'Send', exact: true }).click();
      } else if (how === 'backdrop') await page.mouse.click(5, 5);
      else await page.click(`#transfer-dialog [data-kl-close="${how}"]`);
      await settle(page);
      results.push(await page.evaluate(() => [document.getElementById('transfer-dialog').open, document.getElementById('transfer-dialog').returnValue]));
    }
    expect(results).toEqual([[false, 'cancel'], [false, 'close'], [false, 'dismiss'], [false, 'send']]);
    await expect(page.locator('#open-markup')).toHaveAttribute('aria-haspopup', 'dialog');
  });
});

test.describe('toast service', () => {
  const toasts = (page: Page) =>
    page.evaluate(() => [...document.querySelectorAll('.kl-toast:not([data-state=closing])')].map((t) => ({ title: t.querySelector('.kl-toast__title')?.textContent, role: t.getAttribute('role'), tone: t.dataset.tone })));

  test('renders tone, role and description in a labelled top-layer region', async ({ page }) => {
    await page.evaluate(() => {
      window.kl.toast.success('Payment sent', { description: '₦45,000 to Ada Obi' });
      window.kl.toast.error('Transfer failed');
    });
    await settle(page);
    const region = await page.evaluate(() => {
      const r = document.querySelector('.kl-toaster');
      return { label: r.getAttribute('aria-label'), open: r.matches(':popover-open'), desc: r.querySelector('.kl-toast__description').textContent };
    });
    expect(region).toEqual({ label: 'Notifications', open: true, desc: '₦45,000 to Ada Obi' });
    expect(await toasts(page)).toEqual([
      { title: 'Payment sent', role: 'status', tone: 'success' },
      { title: 'Transfer failed', role: 'alert', tone: 'danger' },
    ]);
  });

  test('auto-dismisses, pausing while hovered', async ({ page }) => {
    await page.evaluate(() => window.kl.toast('Short', { duration: 400 }));
    await settle(page, 150);
    await page.hover('.kl-toast');
    await settle(page, 600);
    const whileHovered = (await toasts(page)).length;
    await page.mouse.move(5, 5);
    await settle(page, 700);
    expect([whileHovered, (await toasts(page)).length]).toEqual([1, 0]);
  });

  test('actions, dismiss buttons, update and dismiss-all', async ({ page }) => {
    await page.evaluate(() => {
      window.__retried = 0;
      window.kl.toast.error('Failed', { duration: Infinity, action: { label: 'Retry', onClick: () => window.__retried++ } });
      window.__t = window.kl.toast('Uploading…', { duration: Infinity });
      window.kl.toast('Copied', { duration: Infinity });
    });
    await settle(page);
    await page.getByRole('button', { name: 'Retry' }).click();
    await settle(page, 400);
    const afterAction = await toasts(page);
    await page.evaluate(() => window.__t.update({ message: 'Uploaded', tone: 'success' }));
    await settle(page);
    const afterUpdate = await toasts(page);
    await page.getByRole('button', { name: 'Dismiss', exact: true }).first().click();
    await settle(page, 400);
    const afterDismiss = (await toasts(page)).length;
    await page.evaluate(() => window.kl.toast.dismiss());
    await settle(page, 400);
    expect({
      retried: await page.evaluate(() => window.__retried),
      afterAction: afterAction.map((t) => t.title),
      afterUpdate: afterUpdate.map((t) => `${t.title}:${t.tone}`),
      afterDismiss,
      region: await page.evaluate(() => document.querySelector('.kl-toaster').matches(':popover-open')),
    }).toEqual({ retried: 1, afterAction: ['Uploading…', 'Copied'], afterUpdate: ['Uploaded:success', 'Copied:neutral'], afterDismiss: 1, region: false });
  });

  test('keeps at most three, dropping the oldest; an id updates in place', async ({ page }) => {
    await page.evaluate(() => {
      for (const n of [1, 2, 3, 4]) window.kl.toast(`Toast ${n}`, { duration: Infinity });
      window.kl.toast('Toast 4 again', { id: 'kl-toast-4', duration: Infinity });
    });
    await settle(page, 400);
    expect((await toasts(page)).map((t) => t.title)).toEqual(['Toast 2', 'Toast 3', 'Toast 4 again']);
  });

  test('stays above a dialog opened earlier', async ({ page }) => {
    await page.evaluate(() => {
      window.kl.dialog.alert('Open first');
    });
    await settle(page);
    await page.evaluate(() => window.kl.toast('On top', { duration: Infinity }));
    await settle(page, 300);
    const topmost = await page.evaluate(() => {
      const r = document.querySelector('.kl-toast').getBoundingClientRect();
      return document.elementFromPoint(r.left + 10, r.top + r.height / 2)?.closest('.kl-toast') !== null;
    });
    // …and its buttons work while the modal is open (not inert).
    await page.getByRole('button', { name: 'Dismiss', exact: true }).click();
    await settle(page, 400);
    expect([topmost, await page.locator('.kl-toast').count()]).toEqual([true, 0]);
    // Closing the dialog moves the toaster back out.
    await page.evaluate(() => window.kl.toast('After', { duration: Infinity }));
    await page.keyboard.press('Escape');
    await settle(page, 300);
    expect(await page.evaluate(() => document.querySelector('.kl-toaster').parentElement.localName)).toBe('body');
  });
});

test.describe('theme service', () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => localStorage.clear());
  });

  test('set applies attributes and brand, persists, and notifies subscribers', async ({ page }) => {
    const r = await page.evaluate(() => {
      const seen = [];
      const stop = window.kl.theme.subscribe((s) => seen.push(`${s.style}/${s.theme}/${s.resolved}`));
      window.kl.theme.set({ style: 'chorus', theme: 'dark', brand: '#16a34a' });
      stop();
      window.kl.theme.set({ theme: 'light' });
      const html = document.documentElement;
      return {
        attrs: [html.dataset.klStyle, html.dataset.klTheme, html.style.getPropertyValue('--kl-brand')],
        stored: JSON.parse(localStorage.getItem('kl-theme')),
        seen,
        state: window.kl.theme.get(),
      };
    });
    expect(r).toEqual({
      attrs: ['chorus', 'light', '#16a34a'],
      stored: { style: 'chorus', theme: 'light', brand: '#16a34a' },
      seen: ['chorus/dark/dark'],
      state: { style: 'chorus', theme: 'light', brand: '#16a34a', resolved: 'light' },
    });
  });

  test('the head snippet applies the stored choice before first paint', async ({ page }) => {
    await page.evaluate(() => window.kl.theme.set({ style: 'solo', theme: 'dark' }));
    await page.reload();
    expect(await page.evaluate(() => window.__early)).toEqual({ theme: 'dark', style: 'solo' });
  });

  test('null clears a setting; reset forgets everything; persist:false and section targets are not stored', async ({ page }) => {
    const r = await page.evaluate(() => {
      const t = window.kl.theme;
      t.set({ style: 'solo', brand: '#ff0000' });
      t.set({ brand: null });
      const afterNull = JSON.parse(localStorage.getItem('kl-theme'));
      t.set({ theme: 'dark' }, { persist: false });
      const section = document.createElement('section');
      document.body.append(section);
      t.set({ theme: 'light' }, { target: section });
      const stored = JSON.parse(localStorage.getItem('kl-theme'));
      t.reset();
      return { afterNull, stored, sectionTheme: section.dataset.klTheme, afterReset: [localStorage.getItem('kl-theme'), document.documentElement.dataset.klStyle ?? null] };
    });
    expect(r).toEqual({ afterNull: { style: 'solo' }, stored: { style: 'solo' }, sectionTheme: 'light', afterReset: [null, null] });
  });

  test('toggle flips from what is showing; system changes notify while on "system"', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    const first = await page.evaluate(() => {
      window.__seen = [];
      window.kl.theme.subscribe((s) => window.__seen.push(s.resolved));
      window.kl.theme.toggle();
      const t = window.kl.theme.get().theme;
      window.kl.theme.set({ theme: null });
      return t;
    });
    await page.emulateMedia({ colorScheme: 'dark' });
    await settle(page);
    expect([first, await page.evaluate(() => window.__seen)]).toEqual(['dark', ['dark', 'light', 'dark']]);
  });

  test('the exported snippet matches the one inlined in the test page', async ({ page }) => {
    const r = await page.evaluate(async () => {
      const inline = document.querySelector('head script').textContent.trim();
      return inline === window.kl.themeInitScript;
    });
    expect(r).toBe(true);
  });
});
