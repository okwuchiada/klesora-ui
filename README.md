# Klesora UI

A zero-dependency UI component library written in plain HTML, CSS and JavaScript. It works in plain HTML, React, Angular, Vue, Svelte and anything else that renders to the DOM.

It ships three switchable styles:

| Style | Look |
| --- | --- |
| **Solo** | simple, modern, clean, high end; one blue accent |
| **Mono** (default) | minimal, neutral, developer-focused |
| **Chorus** | layered, bold, tactile; violet, tinted surfaces |

```html
<html data-kl-style="solo" data-kl-theme="system">
```

> Status: early development (Step 3 of the roadmap: style packs). Not yet published.

Browser support: Chrome / Edge 119+, Firefox 128+, Safari 17+.

## Customise

Set knobs on `<html>`, or on any element marked `data-kl-scope`:

```html
<html style="--kl-brand: #0a7cff; --kl-radius-base: 0.75rem; --kl-density: 0.9">
<section data-kl-scope style="--kl-brand: #16a34a">…</section>
<aside data-kl-theme="dark">…</aside>
```

The text colour on the brand is picked automatically; set `--kl-brand-fg` to override it. See CONVENTIONS.md §2–3 for every token.

## Project layout

```
src/
  tokens/       design tokens (base + one file per style)
  styles/       structural overrides per style
  css/          reset, base, utilities
  core/         base element class, directive registry, shared helpers
  components/   one folder per component (css + js + meta.json)
  directives/   data-kl-* behaviours
  services/     toast, dialog, theme, crypto, secure storage
docs/           showcase site, built with the library itself
cli/            init / add / eject / switch-style
scripts/        dev server and build scripts
tests/          test pages
```

## Develop

```sh
npm run dev            # http://localhost:5173/docs/ (token test page: /tests/tokens.html)
npm run check:tokens   # gamut, WCAG contrast per style in light and dark, drift, style-pack rules
npm run gen:palette    # regenerate the OKLCH colour scales in src/tokens/primitives.css
```

## Rules

See [CONVENTIONS.md](./CONVENTIONS.md) for naming, tokens, CSS layers, element and event conventions, and versioning.
