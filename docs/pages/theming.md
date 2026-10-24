---
title: Theming
description: Styles, light and dark, brand colour, radius, density and nested scopes, all through tokens.
order: 2
---
# Theming

Everything visual comes from CSS custom properties (tokens). Change a few knobs and every component follows.

## Switches

| Attribute | Values | Default |
| --- | --- | --- |
| `data-kl-style` | `solo`, `mono`, `chorus` | `mono` |
| `data-kl-theme` | `light`, `dark`, `system` | `system` |
| `data-kl-motion` | `reduce`, `full` | follows the OS |
| `data-kl-scope` | (no value) | marks a section for its own knobs |

## Knobs

Knobs are the supported way to customise. Set them on `<html>`, or on any element with a boundary attribute.

| Knob | Effect |
| --- | --- |
| `--kl-brand` | primary colour (and focus ring) |
| `--kl-brand-fg` | text on the primary; picked automatically when unset |
| `--kl-radius-base` | the whole radius scale (use a length, e.g. `0px`) |
| `--kl-density` | control heights and padding (1 = 32/40/48px) |
| `--kl-ring` | focus ring colour |
| `--kl-link` | prose link colour |

<div class="doc-builder" id="theme-builder">
  <div class="doc-builder__controls">
    <label class="kl-field"><span class="kl-field__label">Brand</span><input type="color" id="tb-brand" value="#1361e7" aria-label="Brand colour"></label>
    <label class="kl-field"><span class="kl-field__label">Radius <output id="tb-radius-out">0.5rem</output></span><input type="range" id="tb-radius" min="0" max="1.5" step="0.125" value="0.5" aria-label="Radius"></label>
    <label class="kl-field"><span class="kl-field__label">Density <output id="tb-density-out">1</output></span><input type="range" id="tb-density" min="0.8" max="1.25" step="0.05" value="1" aria-label="Density"></label>
    <p class="doc-builder__contrast" id="tb-contrast" aria-live="polite"></p>
    <pre class="doc-code"><code id="tb-css"></code></pre>
  </div>
  <div class="doc-builder__preview" data-kl-scope id="tb-preview">
    <kl-field><label>Amount</label><kl-amount-input value="45000"></kl-amount-input></kl-field>
    <div class="kl-cluster"><kl-button>Send</kl-button><kl-button variant="outline">Cancel</kl-button><kl-switch checked>Alerts</kl-switch></div>
    <kl-tabs aria-label="Preview tabs"><div class="kl-tabs__list"><button class="kl-tabs__tab">Overview</button><button class="kl-tabs__tab">Activity</button></div><div class="kl-tabs__panel">Panel</div><div class="kl-tabs__panel">Panel</div></kl-tabs>
  </div>
</div>

The text colour on the brand is picked automatically: near-black on light brands, white on dark ones. The readout above shows the resulting contrast. Some bright brand colours (yellow, orange, teal) are too light to work as a fill on a white page; pick a deeper shade or set `--kl-brand-fg` yourself.

## Nested themes and scopes

Semantic tokens re-resolve at every boundary, so a dark panel or a section with its own brand needs no extra CSS.

```html live
<div class="kl-grid" style="--kl-min: 14rem">
  <div data-kl-theme="dark" class="kl-stack" data-gap="3" style="padding: var(--kl-space-5); border-radius: var(--kl-radius-lg)">
    <strong>Always dark</strong>
    <kl-button>Primary</kl-button>
  </div>
  <div data-kl-scope class="kl-stack kl-surface" data-gap="3" style="padding: var(--kl-space-5); --kl-brand: #16a34a; --kl-radius-base: 1rem">
    <strong>Own brand and radius</strong>
    <kl-button>Primary</kl-button>
  </div>
</div>
```

## Semantic tokens

These are what components read. The swatches show their live values in the current style and theme.

<!-- token-table -->

## Rules of thumb

- Override **knobs**, not semantic tokens: knobs survive nested boundaries.
- To restyle one component everywhere, set its component token (e.g. `--kl-btn-radius`) in your CSS.
- Your CSS always wins: the library lives in cascade layers, and unlayered CSS beats every layer.
