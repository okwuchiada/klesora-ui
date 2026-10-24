---
title: Services
description: dialog, toast, theme, secure storage and money: plain JavaScript APIs with no side effects on import.
order: 4
---
# Services

Services are plain ES modules. Nothing touches the page until you call them. Press **Run** to try an example; you can edit it first.

## Dialog {#dialog}

Promise-based `alert`, `confirm` and `prompt`, built on the native `<dialog>`.

```js live
const ok = await dialog.confirm({
  title: 'Send ₦45,000 to Ada Obi?',
  message: 'GTBank · 0123456789',
  confirmText: 'Send',
});
toast(ok ? 'Sent' : 'Cancelled');
```

```js live
const name = await dialog.prompt({ title: 'Rename card', label: 'Card name', defaultValue: 'Travel', required: true });
if (name) toast.success(`Renamed to ${name}`);
```

## Toast {#toast}

```js live
toast.success('Payment sent', { description: '₦45,000.00 to Ada Obi' });
const t = toast('Uploading statement…', { duration: Infinity, dismissible: false });
setTimeout(() => t.update({ message: 'Statement uploaded', tone: 'success', duration: 3000, dismissible: true }), 1500);
```

## Theme {#theme}

```js live
theme.toggle();
toast(`Now ${theme.get().resolved}`);
```

To apply the remembered choice before the page paints, inline `themeInitScript` at the top of `<head>`:

```js
import { themeInitScript } from 'klesora-ui/services/theme';
// <script>{themeInitScript}</script> as the first thing in <head>
```

## Secure storage {#secure-storage}

Encrypted values in IndexedDB (AES-GCM). Read [Security](../security/) first: it protects data at rest, not against code running on your page.

```js live
const store = await secureStorage.open('docs-demo');
await store.set('lastAccount', '0123456789');
toast(`Stored and read back: ${await store.get('lastAccount')}`);
```

## Money {#money}

Exact decimal strings, never floats.

```js live
toast(money.formatMoney('45000.5', { currency: 'NGN' }));
toast(String(money.toMinor('45000.50', 2)) + ' kobo');
```
