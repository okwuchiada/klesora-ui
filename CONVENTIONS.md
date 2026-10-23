# Klesora UI conventions

These rules keep the library consistent as it grows. Anything that touches a public name below (a class, attribute, event, token or export path) is part of the public API; renaming one is a breaking change.

## 1. Names and prefix

Everything public uses the `kl` prefix.

| Thing | Pattern | Example |
| --- | --- | --- |
| npm package | `klesora-ui` | `npm i klesora-ui` |
| CSS class | `.kl-<block>`, `.kl-<block>__<part>` | `.kl-btn`, `.kl-field__label` |
| Custom element | `<kl-<name>>` | `<kl-button>`, `<kl-otp-input>` |
| CSS custom property | `--kl-<group>-<name>` | `--kl-color-primary`, `--kl-radius-md` |
| Data attribute (state, variants, directives) | `data-kl-*` on the root, `data-*` inside components | `data-kl-style`, `data-variant` |
| Custom event | `kl-<verb>` | `kl-change`, `kl-open`, `kl-close` |
| JS export | camelCase | `toast`, `theme`, `secureStorage` |

File and folder names are kebab-case.

## 2. Styles, themes and knobs

Three independent switches, set on `<html>` or on any container:

```html
<html data-kl-style="solo" data-kl-theme="dark" style="--kl-brand: #0a7cff">
```

| Attribute | Values | Default |
| --- | --- | --- |
| `data-kl-style` | `solo` (Apple-inspired: simple, clean, high end), `mono` (shadcn-inspired: minimal, neutral), `chorus` (Material-inspired: layered, bold, tactile) | `mono` |
| `data-kl-theme` | `light`, `dark`, `system` | `system` (no attribute behaves the same) |
| `data-kl-motion` | `reduce`, `full` | follows the OS `prefers-reduced-motion` |
| `data-kl-scope` | (no value) | marks a boundary for local knobs |

A style is made of a token file (`src/tokens/<style>.css`) plus a small structural override file (`src/styles/<style>.css`). Components never check which style is active in JS; they only read tokens.

### Knobs

Knobs are the supported way for a project to customise the library. The library never declares them, so they inherit freely; semantic tokens read them with a fallback.

| Knob | Effect | Default |
| --- | --- | --- |
| `--kl-brand` | replaces the primary colour (and the focus ring, unless `--kl-ring` is set) | style's own primary |
| `--kl-brand-fg` | text on primary | picked automatically: near-black or white, by OKLCH lightness (threshold 0.58) |
| `--kl-radius-base` | the whole radius scale derives from it. Use a length (`0px`, not `0`). | `0.5rem` |
| `--kl-density` | scales control heights (32/40/48px at 1) and control padding | `1` |
| `--kl-ring` | focus ring colour | brand, else `--kl-neutral-8` |

### Scope boundaries

Semantic tokens are declared on every boundary with zero specificity:

```css
:where(:root, [data-kl-theme], [data-kl-style], [data-kl-scope], [data-kl-motion]) { --kl-color-primary: …; }
```

A custom property that uses `var()` is resolved where it is declared, then inherited as a fixed value. Re-declaring the semantic tokens at each boundary makes them re-resolve against the local ramps and knobs. That is what makes nested themes and per-section brands work:

```html
<section data-kl-theme="dark">…always dark…</section>
<section data-kl-scope style="--kl-brand: #16a34a; --kl-radius-base: 1rem">…</section>
```

Setting a knob on a plain element with no boundary attribute has no effect on its semantic tokens. Add `data-kl-scope`. A nested theme does not paint itself: give the container `background: var(--kl-color-bg)` (or a surface token) and `color: var(--kl-color-fg)`.

Overriding a semantic token directly (`:root { --kl-color-primary: … }`) works, but nested boundaries reset it. Prefer knobs.

### Scheme ramps

Light and dark live only in the scheme ramps in `src/tokens/base.css`. Style packs map semantic tokens onto ramp steps, so they never need their own dark-mode copies.

- Light: `:root, [data-kl-theme="light"], [data-kl-theme="system"]`
- Dark: `[data-kl-theme="dark"]`
- System dark: an identical copy of the dark block inside `@media (prefers-color-scheme: dark)` on `:root:not([data-kl-theme="light"]), [data-kl-theme="system"]`. `npm run check:tokens` fails if the two copies drift.

Each block sets `color-scheme` and the following.

**Neutral ramp** `--kl-neutral-1..12`, page-most to text-most:

| Step | Use | Step | Use |
| --- | --- | --- | --- |
| 1 | page background | 7 | border |
| 2 | subtle background | 8 | strong border (≥3:1 on page) |
| 3 | element background | 9 | solid |
| 4 | hover | 10 | solid hover |
| 5 | pressed / selected | 11 | muted text (≥4.5:1) |
| 6 | subtle border | 12 | text |

Plus `--kl-neutral-surface` (cards) and `--kl-neutral-raised` (popovers, menus).

**Hue roles** for `blue`, `green`, `amber`, `red`: `--kl-<hue>-subtle`, `-border`, `-solid`, `-on` (text on solid), `-text` (hue-coloured text on page or subtle).

**Also:** `--kl-overlay`, `--kl-shadow-color`, `--kl-shadow-alpha`. Overlay and shadow alpha are stronger in dark mode.

## 3. Tokens

Three tiers. Each tier may only reference the tier below it.

1. **Primitive** (`src/tokens/primitives.css`): raw values on `:root`.
2. **Scheme ramps and semantic** (`src/tokens/base.css`): meaning.
3. **Component**: per-component knobs, e.g. `--kl-btn-height`, `--kl-btn-radius`, `--kl-input-bg`.

Component CSS reads only semantic or component tokens, never primitives, ramps or hard-coded values (except `0`, `1px` hairlines and `100%`). This is what lets a style or brand colour change everything at once. Hover and active states come from `color-mix(in oklab, … , var(--kl-color-bg))`, so they work for any brand colour.

### Primitives

| Group | Tokens |
| --- | --- |
| Colour | `--kl-{gray,blue,green,amber,red}-{50,100,200,…,900,950}` in OKLCH, generated by `npm run gen:palette`, all inside sRGB (hex in a comment). `--kl-white`, `--kl-black`. |
| Fonts | `--kl-font-sans` (system-ui stack), `--kl-font-mono` (ui-monospace stack) |
| Type size | `--kl-text-xs` 0.75 · `sm` 0.875 · `md` 1 · `lg` 1.125 · `xl` 1.25 · `2xl` 1.5 · `3xl` 1.875 · `4xl` 2.25 (rem) |
| Weight | `--kl-weight-regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 |
| Leading | `--kl-leading-none` 1 · `tight` 1.25 · `snug` 1.375 · `normal` 1.5 · `relaxed` 1.625 |
| Tracking | `--kl-tracking-tighter` −0.04em · `tight` −0.02em · `normal` 0 · `wide` 0.02em · `wider` 0.05em |
| Spacing | `--kl-space-0` … `--kl-space-12`, `16`, `20`, `24`; 4px base (`--kl-space-n` = n × 0.25rem) |
| Duration | `--kl-duration-instant` 50ms · `fast` 120ms · `base` 200ms · `slow` 320ms |
| Easing | `--kl-ease-linear` · `standard` · `out` · `in` · `spring` |
| Z-index | `--kl-z-dropdown` 1000 · `sticky` 1100 · `overlay` 1200 · `modal` 1300 · `toast` 1400 · `tooltip` 1500 |

Reduced motion sets every duration to `1ms` (not `0`, so `transitionend` still fires). It follows the OS unless `data-kl-motion` says otherwise. Components must use the duration tokens for anything that moves.

### Semantic tokens (Mono defaults)

| Group | Tokens |
| --- | --- |
| Surfaces | `--kl-color-bg`, `surface`, `surface-raised`, `muted`, `muted-hover`, `selected`, `overlay` |
| Text | `--kl-color-fg`, `fg-muted`, `fg-subtle` (decorative only, not for text) |
| Borders | `--kl-color-border`, `border-strong`, `input` (control boundary, ≥3:1) |
| Primary | `--kl-color-primary`, `primary-fg`, `primary-hover`, `primary-active`, `primary-subtle` |
| Secondary | `--kl-color-secondary`, `secondary-hover`, `secondary-fg` |
| Status | `--kl-color-{info,success,warning,danger}`, each with `-fg`, `-text`, `-subtle`, `-border`; plus `--kl-color-danger-hover` |
| Focus | `--kl-color-ring`, `--kl-ring-width`, `--kl-ring-offset` |
| Fonts | `--kl-font-body`, `heading`, `code`, `numeric` (use with `font-variant-numeric: tabular-nums`) |
| Radius | `--kl-radius-none`, `xs` (¼ base), `sm` (½), `md` (base), `lg` (1½), `xl` (2×), `full` |
| Density | `--kl-control-height-{sm,md,lg}`, `--kl-control-padding-{sm,md,lg}` |
| Elevation | `--kl-shadow-0` … `--kl-shadow-5` |
| Misc | `--kl-transition-colors`, `--kl-disabled-opacity`, `--kl-border-width` |

### Contrast rules

`npm run check:tokens` resolves every `var()` chain, including the automatic brand text colour, and checks WCAG contrast in light and dark:

- Body text (`fg` on bg/surfaces): ≥7:1.
- Other text pairs (muted text, text on fills, status text): ≥4.5:1.
- Control boundaries, fills, strong borders and the focus ring: ≥3:1.

When you add a colour pair, add it to the checker. Brand colours are project input, so they are reported but never fail the check.

## 4. CSS architecture

All library CSS lives in cascade layers, declared once in `src/klesora-ui.css`:

```css
@layer kl.reset, kl.tokens, kl.base, kl.components, kl.styles, kl.utilities;
```

- `kl.styles` comes after `kl.components`, so a style's structural overrides win over the default component CSS.
- Any un-layered CSS in a consuming project beats every library layer, so projects can override without `!important` or specificity tricks.
- Selectors stay low-specificity: one class, plus `:where()` for anything extra.

**Variants and state use attributes, not modifier classes:**

```html
<button class="kl-btn" data-variant="outline" data-size="sm">Save</button>
```

- Variants: `data-variant`, `data-size`, `data-tone`.
- State: prefer real ARIA or native state (`aria-expanded`, `aria-invalid`, `aria-selected`, `:disabled`, `[open]`). Use `data-state` only when nothing native exists.

This maps one-to-one onto component attributes: `<kl-button variant="outline" size="sm">` sets the same `data-*` on its inner `.kl-btn`.

## 5. Web Components

- Render in **light DOM** using the class layer, so styles and themes apply with no extra work. No Shadow DOM unless a component has a specific reason, documented in its meta file.
- Attributes are kebab-case and properties are camelCase (`max-length` ↔ `maxLength`). Boolean attributes follow HTML rules: present means true.
- Public attributes reflect to properties and back.
- Form controls are form-associated (`static formAssociated = true` + `ElementInternals`), so they work in native forms and framework form libraries.
- Native events (`input`, `change`, `click`) keep firing as usual. Library events are `CustomEvent`s named `kl-*` with `bubbles: true, composed: true`, and data in `detail`.
- Every element cleans up its listeners and observers in `disconnectedCallback`.
- Defining an element twice is a no-op (guarded `customElements.define`).

## 6. Directives

Directives are behaviours attached to any element through a `data-kl-*` attribute:

```html
<button data-kl-tooltip="Copy account number">Copy</button>
<button class="kl-btn" data-kl-ripple>Pay</button>
```

A single registry watches the DOM (MutationObserver), so directives also work on content that a framework renders later. Each directive exports `mount(el, value)` and returns a cleanup function.

## 7. Services

Services are plain ES modules with named exports and no side effects on import:

```js
import { toast } from 'klesora-ui/services/toast';
import { theme } from 'klesora-ui/services/theme';

theme.setStyle('chorus');
toast.success('Payment sent');
```

Async APIs return Promises. Services never touch the DOM until first used.

## 8. Component folder layout

```
src/components/button/
├─ button.css         class layer (.kl-btn)
├─ button.js          <kl-button> element
└─ button.meta.json   docs: attributes, events, slots, tokens, examples
```

The docs site is generated from the `*.meta.json` files.

## 9. Package exports

Source files ship as native ES modules and plain CSS, so no build step is needed to use the library. A `dist/` bundle (minified, single file) is added later for CDN use.

| Import | Gives you |
| --- | --- |
| `klesora-ui` | everything: registers all elements and directives |
| `klesora-ui/css` | all CSS (tokens for all three styles + components) |
| `klesora-ui/components/button` | just `<kl-button>` |
| `klesora-ui/components/button.css` | just the button CSS |
| `klesora-ui/services/toast` | just the toast service |
| `klesora-ui/directives/tooltip` | just the tooltip directive |

## 10. Browser support

Chrome / Edge 119+, Firefox 128+, Safari 17+. This baseline gives cascade layers, `color-mix()`, relative colour syntax (used for the automatic `--kl-brand-fg`), custom elements, form-associated elements and `<dialog>` with no polyfills.

## 11. Versioning

Semantic versioning. A **major** release is needed for renaming or removing any public class, element, attribute, event, token or export path, or changing a default. New tokens, components or options are **minor**. Visual fixes are **patch**. Every release gets a CHANGELOG entry.
