---
title: Directives
description: Behaviours you add to any element with a data-kl-* attribute.
order: 5
---
# Directives

A directive is an attribute that adds behaviour to any element, including markup your framework renders later. One observer watches the page, so you never call setup code.

| Attribute | Adds |
| --- | --- |
| `data-kl-tooltip="text"` | a hover and focus hint ([details](../../components/tooltip/)) |
| `data-kl-ripple` | press feedback (drawn in Chorus) |
| `data-kl-menu` | menu behaviour for a `.kl-menu` popover |
| `data-kl-tabs` | tabs behaviour for `.kl-tabs` markup |
| `data-kl-table` | sort state, select-all and phone labels for `.kl-table` |
| `data-kl-navbar` | the phone menu for `.kl-navbar` |
| `data-kl-sidebar` | the collapsible rail and phone drawer for `.kl-sidebar` |
| `data-kl-dialog`, `data-kl-dialog-open="id"` | close buttons, backdrop dismiss, and openers for `<dialog class="kl-dialog">` |

```html live
<div class="kl-cluster">
  <button class="kl-btn" data-variant="outline" data-kl-tooltip="Copy account number">Copy</button>
  <button class="kl-btn" data-kl-ripple>Press me (ripple in Chorus)</button>
</div>
```

## Your own

```js
import { registerDirective } from 'klesora-ui/core/directives';

registerDirective('autoselect', (el) => {
  const select = () => el.select();
  el.addEventListener('focus', select);
  return () => el.removeEventListener('focus', select); // cleanup
});
// <input data-kl-autoselect>
```
