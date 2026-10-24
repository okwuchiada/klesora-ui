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

| Style | Primary (no brand set) | Radius base | Density | Character |
| --- | --- | --- | --- | --- |
| Mono | neutral-9 (near-black / near-white) | 0.5rem | 1 | bordered surfaces, quick standard motion |
| Solo | blue (`--kl-blue-solid`) | 0.75rem | 1.1 | borderless surfaces, very soft wide shadows, calm smooth motion |
| Chorus | violet (`--kl-violet-solid`) | 0.75rem | 1 | surfaces tinted from the primary, Material elevation, state-layer hover/press, emphasized motion |

### Writing a style pack

Mono is the semantic defaults in `base.css`, so `mono.css` remaps nothing. Every other pack is one rule:

```css
[data-kl-style="solo"],
:where([data-kl-style="solo"])
  :where([data-kl-theme], [data-kl-scope], [data-kl-motion]):not(
    :where([data-kl-style="solo"] [data-kl-style]:not([data-kl-style="solo"])) *
  ) {
  --kl-style-primary: var(--kl-blue-solid);
  …
}
```

- The own rule has specificity 0,1,0. The descendant rule re-applies the style on nested boundaries with zero specificity; it still beats `base.css`, which comes first in `kl.tokens`.
- The `:not()` skips boundaries inside a different style nested within this one, so the nearest style wins. Keep it attached to the compound selector with no space before `:not(`.
- A pack may set only semantic tokens, component tokens and the `--kl-style-*` defaults. Never knobs, primitives, ramps or durations. `check:tokens` enforces this and the selector shape.
- Style defaults (`--kl-style-primary`, `--kl-style-ring`, `--kl-style-link`, `--kl-style-radius`, `--kl-style-density`) are what the knobs fall back to. Projects use the knobs, not these.
- Prefer component tokens to structural CSS. When a style needs CSS that tokens can't express (Chorus floating labels), put it in `src/styles/<style>.css` with the same guard: `:where([data-kl-style="x"]) .target:not(:where([data-kl-style="x"] [data-kl-style]:not([data-kl-style="x"])) *)`.
- Limitation: with three or more levels of alternating styles (Solo › Chorus › Solo › theme boundary), repeat `data-kl-style` on the inner boundary.

### Knobs

Knobs are the supported way for a project to customise the library. The library never declares them, so they inherit freely; semantic tokens read them with a fallback.

| Knob | Effect | Default |
| --- | --- | --- |
| `--kl-brand` | replaces the primary colour (and the focus ring, unless `--kl-ring` is set) | style's own primary |
| `--kl-brand-fg` | text on primary | picked automatically: near-black or white, by OKLCH lightness (threshold 0.58) |
| `--kl-radius-base` | the whole radius scale derives from it. Use a length (`0px`, not `0`). | `0.5rem` |
| `--kl-density` | scales control heights (32/40/48px at 1) and control padding | `1` |
| `--kl-ring` | focus ring colour | brand, else the style's ring |
| `--kl-link` | prose link colour | the style's link colour (not the brand, so it always meets 4.5:1) |

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

**Hue roles** for `blue`, `green`, `amber`, `red`, `violet`: `--kl-<hue>-subtle`, `-border`, `-solid`, `-on` (text on solid), `-text` (hue-coloured text on page or subtle). Violet follows Material: a deep solid with white text in light mode, a pale solid with dark text in dark mode.

**Also:** `--kl-overlay`, `--kl-shadow-color`, `--kl-shadow-alpha`. Overlay and shadow alpha are stronger in dark mode.

## 3. Tokens

Three tiers. Each tier may only reference the tier below it.

1. **Primitive** (`src/tokens/primitives.css`): raw values on `:root`.
2. **Scheme ramps and semantic** (`src/tokens/base.css`): meaning.
3. **Component** (`src/tokens/components.css`): per-component knobs, e.g. `--kl-btn-radius`, `--kl-input-bg`, `--kl-switch-width`. They're declared on the same scope boundaries as the semantic tokens, with Mono defaults, and style packs remap them. That makes a style's component look follow the nearest style on nested panels too. Set one in project CSS to restyle that component everywhere.

Component CSS reads only semantic or component tokens, never primitives, ramps or hard-coded values (except `0`, `1px` hairlines and `100%`). This is what lets a style or brand colour change everything at once. Hover and active states come from `color-mix(in oklab, … , var(--kl-color-bg))`, so they work for any brand colour.

### Primitives

| Group | Tokens |
| --- | --- |
| Colour | `--kl-{gray,blue,green,amber,violet,red}-{50,100,200,…,900,950}` in OKLCH, generated by `npm run gen:palette`, all inside sRGB (hex in a comment). `--kl-white`, `--kl-black`. |
| Fonts | `--kl-font-sans` (system-ui stack), `--kl-font-mono` (ui-monospace stack) |
| Type size | `--kl-text-xs` 0.75 · `sm` 0.875 · `md` 1 · `lg` 1.125 · `xl` 1.25 · `2xl` 1.5 · `3xl` 1.875 · `4xl` 2.25 (rem) |
| Weight | `--kl-weight-regular` 400 · `medium` 500 · `semibold` 600 · `bold` 700 |
| Leading | `--kl-leading-none` 1 · `tight` 1.25 · `snug` 1.375 · `normal` 1.5 · `relaxed` 1.625 |
| Tracking | `--kl-tracking-tighter` −0.04em · `tight` −0.02em · `normal` 0 · `wide` 0.02em · `wider` 0.05em |
| Spacing | `--kl-space-0` … `--kl-space-12`, `16`, `20`, `24`; 4px base (`--kl-space-n` = n × 0.25rem) |
| Duration | `--kl-duration-instant` 50ms · `fast` 120ms · `base` 200ms · `slow` 320ms |
| Easing | `--kl-ease-linear` · `standard` · `out` · `in` · `spring` · `smooth` · `decelerate` · `accelerate` |
| Container | `--kl-container-sm` 40rem · `md` 48rem · `lg` 64rem · `xl` 80rem |
| Z-index | `--kl-z-dropdown` 1000 · `sticky` 1100 · `overlay` 1200 · `modal` 1300 · `toast` 1400 · `tooltip` 1500 |

Reduced motion sets every duration to `1ms` (not `0`, so `transitionend` still fires). It follows the OS unless `data-kl-motion` says otherwise. Components animate with the semantic `--kl-motion-*` tokens, which pick a duration step per style, so reduced motion still applies.

### Semantic tokens (Mono defaults)

| Group | Tokens |
| --- | --- |
| Surfaces | `--kl-color-bg`, `surface`, `surface-raised`, `muted`, `muted-hover`, `selected`, `overlay` |
| Text | `--kl-color-fg`, `fg-muted`, `fg-subtle` (decorative only, not for text) |
| Borders | `--kl-color-border`, `surface-border` (edge of cards and panels; transparent in Solo and Chorus), `border-strong`, `input` (control boundary, ≥3:1) |
| Primary | `--kl-color-primary`, `primary-fg`, `primary-hover`, `primary-active`, `primary-subtle` |
| Secondary | `--kl-color-secondary`, `secondary-hover`, `secondary-fg` |
| Status | `--kl-color-{info,success,warning,danger}`, each with `-fg`, `-text`, `-subtle`, `-border`; plus `--kl-color-danger-hover` |
| Links | `--kl-color-link` |
| Focus | `--kl-color-ring`, `--kl-ring-width`, `--kl-ring-offset` |
| Fonts | `--kl-font-body`, `heading`, `code`, `numeric` (use with `font-variant-numeric: tabular-nums`); `--kl-heading-weight`, `--kl-heading-tracking` |
| Radius | `--kl-radius-none`, `xs` (¼ base), `sm` (½), `md` (base), `lg` (1½), `xl` (2×), `full` |
| Density | `--kl-control-height-{sm,md,lg}`, `--kl-control-padding-{sm,md,lg}` |
| Elevation | `--kl-shadow-0` … `--kl-shadow-5` |
| Motion | `--kl-motion-short` (hover, press, colour), `--kl-motion-long` (enter, exit, expand), `--kl-motion-ease`, `--kl-motion-ease-enter`, `--kl-motion-ease-exit` |
| Misc | `--kl-transition-colors`, `--kl-disabled-opacity`, `--kl-border-width` |

### Contrast rules

`npm run check:tokens` resolves every `var()` chain, including the automatic brand text colour, and checks WCAG contrast for every style in light and dark:

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

### Reset, base and utilities (`src/css/`)

- **Reset** (`kl.reset`): gentle, modern-normalize level. It covers box-sizing, the body margin, media max-width, form controls inheriting type, and the `[hidden]` fix. It keeps heading, list and paragraph margins, so host content doesn't shift.
- **Base** (`kl.base`): `html` and every `[data-kl-theme]` / `[data-kl-style]` boundary paints its own background, text colour and body font. `accent-color` follows the local primary, and `[data-kl-scope]` re-reads it too. Base also styles headings (font, weight, tracking, balance), unclassed links only (`a:not([class])`), inline code, kbd, mark and hr, plus the `:focus-visible` ring, `::selection` and placeholders. All selectors use `:where()`.
- **Utilities** (`kl.utilities`): a small set, all public API. Options use `data-*`.

| Class | Options |
| --- | --- |
| `.kl-sr-only`, `.kl-sr-only-focusable` | visible again when focused (skip links) |
| `.kl-truncate`, `.kl-line-clamp` | `--kl-lines` (default 2) |
| `.kl-tabular` | numeric font + tabular figures |
| `.kl-text-muted`, `-info`, `-success`, `-warning`, `-danger` | |
| `.kl-stack` (column, gap 4), `.kl-cluster` (wrapping row, gap 2), `.kl-grid` (auto-fit, `--kl-min` 16rem) | `data-gap` 0–6, 8, 10, 12, 16; stack/cluster `data-align`, `data-justify` (`start`, `center`, `end`, `between`/`stretch`) |
| `.kl-container` | `data-size` `sm`, `md`, `lg` (default), `xl` |
| `.kl-surface` | `data-variant` `raised`, `muted`; `data-elevation` 0–5 |

### Component class layer

Each component's CSS selects the class and the element alike, e.g. `:is(.kl-btn, kl-button)`. The same variants work on native elements and custom elements:

| Component | Class layer | Element | Options |
| --- | --- | --- | --- |
| Button | `<button class="kl-btn">`, `<a class="kl-btn">` | `<kl-button>` | `data-variant` solid, secondary, outline, ghost, danger, link; `data-size` sm, md, lg; `data-icon`; `data-loading` |
| Input | `<input class="kl-input">`, `<textarea class="kl-input">` | `<kl-input>` (children with `slot="start"` / `slot="end"`) | `data-size`; `aria-invalid="true"` |
| Select | `<select class="kl-select">` | (`<kl-select>` in Step 7) | customizable select styles the list where supported |
| Checkbox | `<input type="checkbox" class="kl-checkbox">` | `<kl-checkbox>Label</kl-checkbox>` | `indeterminate` |
| Switch | `<input type="checkbox" role="switch" class="kl-switch">` | `<kl-switch>Label</kl-switch>` | |
| Menu | `<div class="kl-menu" popover data-kl-menu>` with `.kl-menu__item`, `.kl-menu__label`, `.kl-menu__separator` / `<hr>` | `<kl-menu>` with `<kl-menu-item>` | opened by any `popovertarget`; `placement`; fires `kl-select` |
| Custom select | | `<kl-select>` with `<kl-option>` | `placeholder`, `placement`, `data-size` |
| Tooltip | `data-kl-tooltip="…"` (directive) | | `data-kl-tooltip-placement` |
| Dialog | `<dialog class="kl-dialog">` with `.kl-dialog__header`, `__title`, `__description`, `__body`, `__footer`, `__close` | (native `<dialog>`; `dialog` service) | `data-size`; `closedby="any"`; directives `data-kl-dialog`, `data-kl-dialog-open="id"`, buttons `[data-kl-close="value"]` |
| Toast | `.kl-toaster`, `.kl-toast` (rendered by the service) | (`toast` service) | per-style placement via `--kl-toaster-align` |
| Card | `.kl-card` with `__media`, `__header`, `__title`, `__description`, `__content`, `__footer`; `.kl-card__link` makes the whole card a link | | `data-variant` outlined, elevated, filled |
| Tabs | `.kl-tabs` + `data-kl-tabs` with `.kl-tabs__list`, `__tab` (`value`), `__panel` (`data-value`) | `<kl-tabs>` | `value`, `activation` auto/manual, `orientation`, `variant` segmented/underline; fires `kl-change` |
| Table | `table.kl-table` (+ `.kl-table-wrap`) + `data-kl-table` | | `data-density`, `data-striped`, `data-stacked`, `data-numeric`; `.kl-table__sort` buttons fire `kl-sort`; `data-kl-select-all` / `data-kl-select` |
| Navbar | `.kl-navbar` + `data-kl-navbar` with `__brand`, `__nav`, `__link`, `__actions`, `__toggle` | | `data-sticky`; links collapse into a popover below 48rem |
| Sidebar | `.kl-sidebar` + `data-kl-sidebar` with `__header`, `__section`, `__label`, `__link`, `__text`, `__footer`, `__collapse`; `.kl-app` shell | | `data-collapsed` rail; drawer below 48rem, opened via `popovertarget` |
| Amount input | | `<kl-amount-input>` | `currency`, `locale`, `min`, `max`, `allow-negative`; `value` decimal string, `minorUnits` |
| OTP / PIN | | `<kl-otp-input>` | `length`, `type` numeric/alphanumeric, `mask`; fires `kl-complete` |
| Transactions | `.kl-txn-list` with `.kl-txn` rows (`data-direction`, `data-status`) | `<kl-transaction-list>` (renders from `items`) | `group-by`, `selectable`, `labels`; fires `kl-select` |
| Stepper | `ol.kl-stepper` with `.kl-stepper__step` (`data-state`, `aria-current="step"`) | `<kl-stepper value="2">` | `data-orientation` vertical |
| Field | `.kl-field` with `.kl-field__label`, `__hint`, `__error`, `data-invalid` | `<kl-field>` (children with `slot="hint"` / `slot="error"`) | `error="…"` |

The `slot` attribute is only a marker for light-DOM parts (no Shadow DOM). Elements read it and never move the marked nodes. Hover styles sit inside `@media (hover: hover)`, so taps don't leave a button stuck in hover.

### Popovers

Menus, the select list and tooltips use the native popover API. They render in the top layer (no z-index or overflow clipping), and `popover="auto"` closes on Escape and outside clicks. Positioning comes from `src/core/position.js` (`position`, `autoPosition`): it flips at screen edges, shifts along the edge, follows scrolling and resizing, and exposes `data-placement`, `--kl-anchor-width` and `--kl-available-height` / `--kl-available-width`.

- Position on the next animation frame after `beforetoggle` (shown by then, still before paint). Keep panels `visibility: hidden` until `data-placement` is set, so they never flash at the default spot.
- Measure with `offsetWidth` / `offsetHeight`, not `getBoundingClientRect()`: entry animations scale the panel.
- `<kl-button popovertarget="id">` implements `popovertarget` / `popovertargetaction` itself (browsers only support them natively on built-in buttons). Custom invokers aren't exempt from light dismiss, so they record the popover's state on pointer-down to avoid reopening it on the same click.
- Popovers inherit tokens from their DOM position. The shared tooltip element moves next to its anchor's nearest theme/style/scope boundary so it matches nested themes.
- A menu is a popover panel driven by `menuController` (`src/components/menu/menu.js`): roles, `aria-expanded` / `aria-controls` on the opener, arrow keys, Home/End, type-to-find, Tab to close and focus back on the opener. `<kl-menu>` and the `data-kl-menu` directive both use it.
- `<kl-select>` follows the WAI-ARIA select-only combobox. Your `<kl-option>`s stay in place (hidden), and the element renders its own listbox in a popover it owns, re-rendering when options change. Focus stays on the element with `aria-activedescendant`. A label click focuses without opening, like a native select.

### Layout and data

- Elements only where there is behaviour: `<kl-tabs>`. Card, table, navbar and sidebar are classes plus small directives.
- Sorting never moves your rows unless you opt in. `data-kl-table` sets `aria-sort` and fires a cancelable `kl-sort`, and your app re-orders its data. `data-kl-table="dom"` re-orders `<tbody>` rows itself, for plain HTML pages only.
- Responsive navbars and sidebars switch modes with a media query in the directive. They add `data-compact` / `data-drawer` and a `popover` attribute, which they remove again above the breakpoint, so no markup is duplicated or moved.
- Tables on phones: `.kl-table-wrap` scrolls sideways with a sticky header and first column, and the directive makes it a focusable, labelled region. `data-stacked` turns rows into cards (labels from the headers via `data-label`).
- Contrast pairs with translucent tokens (Solo's frosted navbar, transparent tab backgrounds) are checked against the page background they sit on (`check:tokens` composites them).

### Money

- Amounts are exact decimal strings in the main unit (`"45000.50"`), never floats. `src/core/money.js` does maths in BigInt minor units: `toMinor`, `fromMinor`, `fixDecimal`, `compareDecimal`, `formatMoney`, `currencyDigits`, `currencySymbol`. It's also exported as `money` from `klesora-ui`. Intl formats decimal strings exactly.
- `<kl-amount-input>` groups thousands live and keeps the caret. Backspace after a separator deletes the digit before it. Decimals are capped to the currency's digits and padded on blur. The symbol is placed per locale and hidden from screen readers, which hear the currency name instead.
- Credits get "+" and the success colour; debits stay neutral (red only for failures). Direction and status are always written out for screen readers (never colour alone).
- Components that render from data use `textContent` only and allow just http(s), relative, `mailto:` and `tel:` links.
- Elements that wrap an inner `<input>` share `src/core/inner-control.js`: ARIA forwarding, label linking, implicit submission and a form-less inner input.

`data-kl-ripple` (`src/directives/ripple.js`) adds press feedback to any element. Presses only record `--kl-press-x/y/size` and `data-pressed`. Only styles with `--kl-btn-ripple` > 0 (Chorus) draw the ripple. `<kl-button>` has it built in.

Layout utilities own their direct children's block margins (set to 0; the gap does the spacing). `--kl-gap`, `--kl-min` and `--kl-lines` are registered with `inherits: false`, so nested layouts start from their own defaults.

**Variants and state use attributes, not modifier classes:**

```html
<button class="kl-btn" data-variant="outline" data-size="sm">Save</button>
```

- Variants: `data-variant`, `data-size`, `data-tone`.
- State: prefer real ARIA or native state (`aria-expanded`, `aria-invalid`, `aria-selected`, `:disabled`, `[open]`). Use `data-state` only when nothing native exists.

This maps one-to-one onto component attributes: `<kl-button variant="outline" size="sm">` mirrors the same `data-*` onto itself, and the component CSS selects `:is(.kl-btn, kl-button)`.

## 5. Web Components

Every element extends `UIElement` (`src/core/element.js`); form controls extend `FormElement` (`src/core/form-element.js`).

### Rendering

- Render in **light DOM** using the class layer, so styles and themes apply with no extra work. No Shadow DOM unless a component has a specific reason, documented in its meta file.
- **Never move, wrap or replace the children a page or framework gave you.** React, Vue, Angular and Svelte track those nodes. The element itself is the control: `<kl-button>` is the button (role, keyboard, form submission via ElementInternals) and your text stays where you put it. A component with no author children (e.g. `<kl-input>`) may create its own internal native element.
- **Elements never add classes to themselves**, because frameworks overwrite `class`. Component CSS selects both forms: `:is(.kl-btn, kl-button)`. Variants reach the CSS as `data-*` attributes mirrored by the element (`variant="outline"` → `data-variant="outline"`).
- Default ARIA roles and states go through `this.setAria('role' | 'ariaChecked' | …, value)`. That sets ElementInternals and mirrors a plain `role` / `aria-*` attribute, unless the author wrote that attribute (theirs always wins). Tools that don't read ElementInternals (Playwright `getByRole`, Testing Library) see the attributes.
- Form controls that are the control themselves (e.g. `<kl-select>`) also point `aria-labelledby` at their `<label for>`. Many tools only compute names from labels for native controls.

### Properties

```js
class KlButton extends UIElement {
  static properties = {
    variant: { type: String, data: true, default: 'solid' }, // attribute + data-variant
    size: { type: String, data: true, default: 'md' },
    loading: { type: Boolean, reflect: true },
  };
  connected() { this.listen(this, 'keydown', this.#onKey); }
  update(changed, first) { if (first || changed.has('loading')) this.internals.ariaBusy = String(this.loading); }
}
define('kl-button', KlButton);
```

- Options: `type` (String, Number, Boolean, Object, Array: how the attribute converts), `attribute` (name or `false`; default kebab-case), `reflect` (write back to the attribute), `data` (mirror to `data-<attribute>`), `default` (use a function for objects and arrays).
- Attributes are kebab-case and properties camelCase (`max-length` ↔ `maxLength`). Boolean attributes follow HTML: present means true. Removing an attribute restores the default.
- Never declare a reactive property as a class field (`variant = 'solid'`): it shadows the accessor. Use `default`.
- Properties set before the element is defined (common in frameworks) are picked up on connect.

### Updates and lifecycle

- Updates are **batched**: any number of property or attribute changes cause one `update(changed, first)` in a microtask. `changed` maps property name → previous value. `await el.updateComplete` waits for it. Call `this.requestUpdate()` after changing internal state.
- Reflection and `data-*` mirroring happen during the update, so attributes lag property sets by one microtask.
- Hooks: `connected()`, `update(changed, first)`, `disconnected()`. Changes made while disconnected apply on the next connect.
- Add listeners with `this.listen(target, type, handler)` and teardown with `this.addCleanup(fn)` (or `this.signal`). Both are undone on disconnect, and `connected()` runs again on reconnect.
- Defining an element twice is a no-op (`define(tag, cls)`). Importing any module is safe without a DOM (server rendering).

### Events

Native events (`input`, `change`, `click`) keep firing as usual. Library events use `this.emit('kl-<verb>', detail, { cancelable })`: a `CustomEvent` with `bubbles: true, composed: true` and data in `detail`. `emit` returns `false` when a cancelable event was prevented, and throws for names not starting with `kl-`.

### Accessibility and testing

Roles and states reach the accessibility tree through ElementInternals and the mirrored attributes, so `getByRole` works in tests. `e2e/components.spec.ts` also checks Chromium's real accessibility tree. Remember that accessible names match as case-insensitive substrings by default; use `exact: true`.

### Form controls

`FormElement` is form-associated (`static formAssociated = true` + ElementInternals), so controls submit with native forms, validate, and are disabled by a disabled `<fieldset>`. That also makes them work with framework form libraries.

- Built in: `name`, `disabled`, `required` properties; `isDisabled` (own or fieldset); `form`, `labels`, `validity`, `validationMessage`, `willValidate`, `checkValidity()`, `reportValidity()`; ARIA disabled and required kept in sync.
- The subclass owns `value`. In `update()`, call `super.update(changed, first)`, then `this.setFormValue(value)` and `this.setValidity(flags, message, anchor)` (`setValidity()` with no arguments means valid).
- Implement the standard `formResetCallback()` (restore the initial value) and `formStateRestoreCallback(state)`.
- Call form methods through `formActions` (`submit`, `reset`, `find`), never `form.reset()`: a control named or id'd `reset` or `requestSubmit` replaces the method on the form object (DOM clobbering).
- `FormElement` mirrors the effective disabled state (own or from a `<fieldset>`) as `data-disabled`. Style that attribute, not `[disabled]`.
- Shared bases: `ToggleElement` (`src/core/toggle-element.js`) backs checkbox and switch. Press feedback is in `src/core/press.js`.

## 6. Directives

Directives are behaviours attached to any element through a `data-kl-*` attribute:

```html
<button data-kl-tooltip="Copy account number">Copy</button>
<button class="kl-btn" data-kl-ripple>Pay</button>
```

```js
import { registerDirective } from 'klesora-ui/core/directives';

registerDirective('tooltip', (el, value) => {
  // …set up
  return () => { /* …clean up */ };
});
```

- One registry (`src/core/directives.js`) watches the document with a MutationObserver, so directives also work on content that a framework renders later. Watching starts with the first registered directive.
- A directive mounts when its attribute appears, **remounts** (cleanup, then mount) when the value changes, and is cleaned up when the attribute or the element goes away. Moving an element within the same task does not remount it.
- A directive that throws is logged and skipped; it never breaks other directives.
- Shadow roots aren't observed automatically: call `observeRoot(root)`, which returns a stop function. `scan(root)` syncs immediately.
- Registering a name twice is a no-op.

## 7. Services

Services are plain ES modules with named exports and no side effects on import:

```js
import { toast } from 'klesora-ui/services/toast';
import { theme } from 'klesora-ui/services/theme';

theme.setStyle('chorus');
toast.success('Payment sent');
```

Async APIs return Promises. Services never touch the DOM until first used, and they build class-layer markup, so they work without any custom element registered.

**dialog** (`src/services/dialog.js`): `alert(options)` → `Promise<void>`, `confirm(options)` → `Promise<boolean>`, `prompt(options)` → `Promise<string | null>`. A string argument is the title. Options: `title`, `message`, `confirmText`, `cancelText`, `tone: 'danger'` (alertdialog, red button, Cancel focused first), `dismissible`, `container` (append inside a themed section to inherit it). Prompt adds `label`, `defaultValue`, `placeholder`, `type`, `inputMode`, `required`, `autocomplete`. Enter confirms (Cancel is `type="button"`), Escape cancels, and focus returns to where it was. Strings default to English.

**toast** (`src/services/toast.js`): `toast(message, options)` returns `{ id, update, dismiss }`. Also `toast.info / success / warning / error`, `toast.dismiss(id?)` and `toast.configure({ position, max, container, label })`. Each toast is a live region (`status`, or `alert` for errors) and is inserted empty, then filled, so it's reliably announced. Timers pause on hover, focus and hidden tabs. At most 3 show at once. The toaster is a top-layer popover, re-shown on each new toast so it stays above earlier dialogs. While a modal is open it moves inside the topmost modal, because a modal makes everything outside it inert, even popovers drawn on top.

**encryption** (`src/services/crypto.js`): `generateKey()` (non-extractable by default), `randomSalt()`, `deriveKey(passphrase, { salt, iterations })` (PBKDF2-SHA256, 600,000 by default), `encrypt(key, data, { aad })` → envelope, `decrypt(key, envelope, { aad })`, `serialize` / `parse`. It's exported as `encryption`, not `crypto`, so it never shadows the global. Errors are `EncryptionError` with a `code`.

**secureStorage** (`src/services/secure-storage.js`): `open(name, { passphrase?, iterations?, autoLock = 5, lockOnHide })` returns a store with `get`, `set`, `has`, `delete`, `keys`, `clear`, `lock`, `unlock`, `changePassphrase`, `destroy`, `close` and `locked` / `mode`. Also `secureStorage.exists(name)` and `secureStorage.delete(name)`. It uses a device key (non-extractable, in IndexedDB) unless given a passphrase. Errors are `SecureStorageError` with a `code`: `wrong-passphrase`, `locked`, `mode-mismatch`, `corrupt`, `not-supported`. **Read SECURITY.md**: this protects data at rest, not against code running on the page.

**theme** (`src/services/theme.js`): `get()` → `{ style, theme, brand, resolved }`, `set({ style, theme, brand }, { persist, target })` (null clears; persisted to `localStorage['kl-theme']` for `<html>`), `toggle()`, `reset()`, `subscribe(fn)` (set, other tabs, and OS changes while on "system"). To avoid a flash of the wrong theme, inline `themeInitScript` as the first thing in `<head>`:

```html
<!-- plain HTML: paste the output of themeInitScript -->
<script>(function applyStored(key){ … })("kl-theme");</script>
```

```jsx
// React / Next.js
import { themeInitScript } from 'klesora-ui/services/theme';
<head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
```

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
| `klesora-ui/css` | all CSS (tokens for all three styles, reset, base, components, utilities) |
| `klesora-ui/css/reset.css`, `base.css`, `utilities.css` | one part; import with `layer(kl.reset)` etc. after declaring the layer order |
| `klesora-ui/core/element`, `form-element`, `directives`, `position`, `money`, `inner-control` | the base classes, directive registry and positioning, for writing or ejecting components |
| `klesora-ui/directives/tooltip`, `menu`, `ripple`, `dialog`, `tabs`, `table`, `navbar`, `sidebar` | one directive (importing registers it) |
| `klesora-ui/components/button` | just `<kl-button>` |
| `klesora-ui/components/button.css` | just the button CSS |
| `klesora-ui/services/toast` | just the toast service |
| `klesora-ui/directives/tooltip` | just the tooltip directive |

## 9b. Typings and manifest

- `types/` and `custom-elements.json` are generated (`npm run build:types`) and committed. Never edit them by hand.
- Attributes, types and defaults come from each element's `static properties`, read by importing the modules in Node. Descriptions, events, slots and tokens come from `*.meta.json`. `npm run check:types` fails when an attribute is in code but not documented (or the reverse), when outputs are stale, or when `types-test/` stops type-checking.
- In `*.meta.json`, `type` may be any readable text. Add `tsType` when it isn't valid TypeScript (e.g. `TransactionItem[]`). Give events a `detailType`, and mark attributes read with `getAttribute` (not reactive properties) as `attributeOnly`.
- Annotate every `static properties` with `/** @type {import('…/core/element.js').PropertyDeclarations} */`, so subclasses type-check against their base.
- Framework typings are opt-in, type-only imports: `klesora-ui/types/react`, `/vue`, `/svelte`.

## 10. Browser support

Chrome / Edge 119+, Firefox 128+, Safari 17+. This baseline gives cascade layers, `color-mix()`, relative colour syntax (used for the automatic `--kl-brand-fg`), custom elements, form-associated elements and `<dialog>` with no polyfills.

## 11. Versioning

Semantic versioning. A **major** release is needed for renaming or removing any public class, element, attribute, event, token or export path, or changing a default. New tokens, components or options are **minor**. Visual fixes are **patch**. Every release gets a CHANGELOG entry.
