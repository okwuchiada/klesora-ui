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

## 2. Styles and themes

Three independent switches, all set on `<html>` (or on any container, for scoped previews):

```html
<html data-kl-style="solo" data-kl-theme="dark" style="--kl-brand: #0a7cff">
```

| Attribute | Values | Default |
| --- | --- | --- |
| `data-kl-style` | `solo` (Apple-inspired: simple, clean, high end), `mono` (shadcn-inspired: minimal, neutral), `chorus` (Material-inspired: layered, bold, tactile) | `mono` |
| `data-kl-theme` | `light`, `dark`, `system` | `system` |
| `--kl-brand` | any CSS colour | style's own accent |

A style is made of a token file (`src/tokens/<style>.css`) plus a small structural override file (`src/styles/<style>.css`). Components never check which style is active in JS; they only read tokens.

## 3. Tokens

Three tiers. Each tier may only reference the tier below it.

1. **Primitive**: raw values. `--kl-gray-50` … `--kl-gray-950`, `--kl-blue-500`, `--kl-font-sans`.
2. **Semantic**: meaning. `--kl-color-bg`, `--kl-color-fg`, `--kl-color-primary`, `--kl-color-primary-fg`, `--kl-color-border`, `--kl-color-danger`, `--kl-radius-md`, `--kl-space-4`, `--kl-shadow-md`, `--kl-duration-fast`, `--kl-ease-out`.
3. **Component**: per-component knobs. `--kl-btn-height`, `--kl-btn-radius`, `--kl-input-bg`.

Component CSS reads only semantic or component tokens, never primitives and never hard-coded values (except `0`, `1px` hairlines and `100%`). This is what lets a style or brand colour change everything at once.

Scales:
- Spacing: `--kl-space-0` to `--kl-space-12`, 4px base.
- Radius: `--kl-radius-none | xs | sm | md | lg | xl | full`.
- Shadow / elevation: `--kl-shadow-0` to `--kl-shadow-5`.
- Type: `--kl-text-xs | sm | md | lg | xl | 2xl | 3xl`, `--kl-weight-regular | medium | semibold | bold`.
- Motion: `--kl-duration-fast | base | slow`, `--kl-ease-standard | out | in | spring`.

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

Evergreen browsers from roughly the last three years: Chrome / Edge 111+, Firefox 113+, Safari 16.4+. This baseline gives cascade layers, `color-mix()`, custom elements, form-associated elements and `<dialog>` with no polyfills.

## 11. Versioning

Semantic versioning. A **major** release is needed for renaming or removing any public class, element, attribute, event, token or export path, or changing a default. New tokens, components or options are **minor**. Visual fixes are **patch**. Every release gets a CHANGELOG entry.
