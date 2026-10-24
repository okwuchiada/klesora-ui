---
title: Styles
description: Solo, Mono and Chorus side by side, and what each changes.
order: 3
---
# Styles

Three looks share one set of components. Each style is a token file, plus a little structural CSS where tokens can't express the difference. Switching never touches your markup.

| Style | Inspired by | Character |
| --- | --- | --- |
| **Mono** (default) | shadcn/ui | minimal and neutral; bordered surfaces; quick motion |
| **Solo** | Apple | one blue accent; pill buttons; borderless surfaces; soft depth; calm motion |
| **Chorus** | Material | violet; tonal surfaces; filled fields with floating labels; ripple; emphasized motion |

## Side by side

The same markup in each style. Nested styles also work: each panel sets `data-kl-style`.

```html live compare
<div class="kl-stack" data-gap="4">
  <kl-field><label>Email</label><kl-input type="email" value="ada@example.com"></kl-input></kl-field>
  <kl-field><label>Bank</label><kl-select placeholder="Choose"><kl-option>GTBank</kl-option><kl-option>Kuda</kl-option></kl-select></kl-field>
  <div class="kl-cluster"><kl-checkbox checked>Remember</kl-checkbox><kl-switch checked>Alerts</kl-switch></div>
  <div class="kl-cluster"><kl-button>Continue</kl-button><kl-button variant="outline">Back</kl-button></div>
</div>
```

## What a style can change

- **Colour:** primary, surfaces, borders (Chorus tints surfaces from the primary).
- **Shape:** the radius scale, and per-component radius (pill buttons in Solo and Chorus).
- **Size:** density (Solo's 44px touch targets).
- **Depth:** the shadow scale.
- **Motion:** which duration step and easing each kind of movement uses. Reduced motion always wins.
- **Structure,** only where tokens can't express it: Chorus floating labels.

Every style passes the same contrast checks (WCAG 4.5:1 for text, 7:1 for body text, 3:1 for controls) in light and dark, and they run in CI.
