# Klesora UI

A zero-dependency UI component library written in plain HTML, CSS and JavaScript. It works in plain HTML, React, Angular, Vue, Svelte and anything else that renders to the DOM.

It ships three switchable styles:

| Style | Look |
| --- | --- |
| **Solo** | simple, modern, clean, high end |
| **Mono** | minimal, neutral, developer-focused |
| **Chorus** | layered, bold, tactile |

```html
<html data-kl-style="solo" data-kl-theme="system">
```

> Status: early development (Step 1 of the roadmap: project setup and conventions). Not yet published.

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
npm run dev
```

Serves the repo at `http://localhost:5173/docs/`.

## Rules

See [CONVENTIONS.md](./CONVENTIONS.md) for naming, tokens, CSS layers, element and event conventions, and versioning.
