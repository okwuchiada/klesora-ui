# Klesora UI

Zero-dependency UI component library in plain HTML, CSS and JS. npm package `klesora-ui` (public, not yet published). The docs site will deploy to Vercel. It must work in plain HTML, React, Angular, Vue and Svelte. No runtime dependencies; dev-only tools are fine.

**CONVENTIONS.md is the rulebook** (naming, tokens, CSS layers, element/event rules, versioning). Read it before changing anything public, and follow it strictly.

## Shape

- Prefix `kl-`: classes `.kl-btn`, elements `<kl-button>`, tokens `--kl-*`, attributes `data-kl-*`, events `kl-*`.
- Two layers: a CSS class layer, plus light-DOM Web Components built on those classes. Install via npm (runtime style switching), and later a CLI that can eject component source, shadcn-style.
- Three styles via `data-kl-style` (the names are the user's own; the references only describe the look):
  - `solo`: Apple-inspired. Simple, modern, clean, high end. Generous whitespace, one accent, soft larger radii, very subtle depth, few borders, calm eased motion.
  - `mono` (**default**): shadcn-inspired. Minimal, neutral, developer-focused.
  - `chorus`: Material-inspired. Layered, bold, tactile; elevation, ripple, floating labels.
- Theme via `data-kl-theme` (light/dark/system). Motion via `data-kl-motion` (reduce/full, else OS).

## Roadmap (one step at a time)

1. ✅ Setup and conventions
2. ✅ Design tokens: `src/tokens/primitives.css`, `src/tokens/base.css`, `scripts/check-tokens.mjs`, `scripts/gen-palette.mjs`, `tests/tokens.html`
3. Style packs: `src/tokens/{solo,mono,chorus}.css` (token remaps) + `src/styles/<style>.css` (structural overrides)
4. CSS class layer: reset, base, utilities
5. JS core: UIElement base class (attribute/property reflection, kl-* events, cleanup), form-associated elements via ElementInternals, directive registry (MutationObserver)
6. Core inputs: button, input, select, checkbox, switch, form field
7. Overlays and services: dialog, dropdown, tooltip directive, toast service, theme service
8. Layout and data: card, tabs, table, navbar, sidebar
9. Fintech extras: amount input (₦/$ locale formatting), OTP/PIN input, transaction list, stepper
10. Encryption and secure storage via Web Crypto (AES-GCM; PBKDF2 or non-extractable keys in IndexedDB). Document honestly what client-side encryption does and does not protect.
11. Framework integration: .d.ts files, custom-elements.json, Angular/Vue setup notes
12. Docs site generated from each component's `*.meta.json`, with a live style and theme switcher
13. CLI: init (choose style), switch-style, add/eject
14. Testing: Playwright + axe, visual checks across 3 styles × light/dark
15. Publishing and updates

## Decisions so far

- Browser baseline: Chrome/Edge 119+, Firefox 128+, Safari 17+. It was raised for relative colour syntax, which picks `--kl-brand-fg` automatically.
- Mono stays the default style.
- Fonts: system font stacks for every style. No bundled fonts; projects can set `--kl-font-sans` themselves.
- Colours: OKLCH, generated inside sRGB by `npm run gen:palette`. Never hand-edit the generated block in primitives.css.
- Light/dark live only in the scheme ramps (`--kl-neutral-1..12`, hue roles). The dark block and the system-dark block must stay identical.
- Semantic tokens are declared once, on `:where(:root, [data-kl-theme], [data-kl-style], [data-kl-scope], [data-kl-motion])`, with zero specificity. Knobs (`--kl-brand`, `--kl-brand-fg`, `--kl-radius-base`, `--kl-density`, `--kl-ring`) are never declared by the library.
- Mono primary is neutral-9 (near-black in light, near-white in dark). The ring defaults to brand, else neutral-8.
- **Step 3 note:** a style pack that sets semantic tokens on `[data-kl-style="x"]` is reset by nested `[data-kl-theme]`/`[data-kl-scope]` boundaries. Style packs must also target the boundaries inside their style, e.g. `[data-kl-style="x"], [data-kl-style="x"] :where([data-kl-theme], [data-kl-scope])`, or remap through knob-like defaults. Decide this at the start of Step 3.

## Commands

- `npm run dev`: static server at http://localhost:5173 (test pages under /tests/).
- `npm run check:tokens`: gamut, WCAG contrast (light + dark), drift. It must pass. Extend its `pairs` list when you add colour pairs.
- `npm run gen:palette`: regenerate the colour scales.
- Playwright and its browsers (chromium, firefox, webkit) are installed for screenshots and later tests.

## How the user likes to work

- Ask clarifying questions before big or ambiguous work. One focused step at a time; they will correct assumptions quickly.
- Keep it simple and direct. Short summaries of what changed, not long recaps.
- Before finishing each step:
  - `npm run check:tokens` passes.
  - Check the relevant test page in light and dark, and in every style built so far. Fix anything that looks wrong.
  - Update CONVENTIONS.md and README.md if anything public changed.
  - Commit with a conventional message (feat:, fix:, docs:…).
