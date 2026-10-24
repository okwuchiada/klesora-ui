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
3. ✅ Style packs: `src/tokens/{solo,mono,chorus}.css` (token remaps) + `src/styles/<style>.css` (structural stubs until components exist)
4. ✅ CSS class layer: `src/css/{reset,base,utilities}.css`, test page `tests/base.html`
5. ✅ JS core: `src/core/{element,form-element,directives}.js`; tests in `e2e/core.spec.ts` (fixtures `tests/fixtures/core.js`, page `tests/core.html`)
6. ✅ Core inputs: `src/components/{button,input,select,checkbox,switch,field}/`, ripple directive, test page `tests/components.html`, tests `e2e/components.spec.ts`
7. Overlays and services, split in two:
   - 7a ✅ positioning (`src/core/position.js`), `<kl-menu>` + `data-kl-menu`, `<kl-select>`/`<kl-option>`, `data-kl-tooltip`; test page `tests/overlays.html`, tests `e2e/overlays.spec.ts`
   - 7b ✅ `dialog.kl-dialog` + `data-kl-dialog`/`data-kl-dialog-open` directives + `dialog` service; `toast` service; `theme` service + `themeInitScript`; test page `tests/services.html`, tests `e2e/services.spec.ts`
8. ✅ Layout and data: `src/components/{card,tabs,table,navbar,sidebar}/`, directives `tabs`, `table`, `navbar`, `sidebar`; test page `tests/layout.html` (app shell), tests `e2e/layout.spec.ts`
9. ✅ Fintech extras: `src/components/{amount-input,otp-input,transaction-list,stepper}/`, `src/core/money.js`, `src/core/inner-control.js`; test page `tests/fintech.html`, tests `e2e/fintech.spec.ts`
10. ✅ Encryption and secure storage: `src/services/crypto.js` (`encryption`), `src/services/secure-storage.js` (`secureStorage`), SECURITY.md (honest threat model + reporting); test page `tests/security.html`, tests `e2e/security.spec.ts`
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
- Style packs: one rule each, an own selector plus a zero-specificity descendant rule with a `:not()` so the nearest style wins (CONVENTIONS §2, "Writing a style pack"). Packs set only semantic tokens and `--kl-style-*` defaults. `mono.css` is empty because Mono is the base.
- Solo primary is blue (`--kl-blue-solid`). Chorus primary is Material-like violet (`--kl-violet-solid`, violet-700 ≈ #6750a4), with surfaces tinted from the primary.
- Hover and press: Mono mixes toward the page bg (as specced). Solo presses away from the text colour. Chorus uses state layers (mixes in the text colour). The reason is contrast with white text on mid-tone primaries.
- Step 4: the reset is gentle (keeps host margins). Base paints html + theme/style boundaries and styles only unclassed links. Utilities are a small set (CONVENTIONS §4) with data-* options. Links are coloured per style via `--kl-color-link` / `--kl-link`, not by the brand.
- Step 5: elements never move or wrap author children; the element itself is the control (framework-safe). Elements never add classes to themselves; CSS selects `:is(.kl-x, kl-x)`, variants via mirrored `data-*`, ARIA defaults via `internals`. Updates are batched in a microtask (`updateComplete`), Lit-style static `properties`.
- Step 6: component tokens live in `src/tokens/components.css` (boundaries, Mono defaults), and style packs remap them. Structural style CSS (only Chorus floating labels so far) uses the nearest-style guard. Select stays native (`.kl-select`); `<kl-select>` comes in Step 7 with the dropdown. Inside `<kl-field>`, errors are inline (after blur or a submit attempt) and the native bubble is suppressed. Call form methods via `formActions` (DOM clobbering).
- Step 7a: `setAria()` mirrors ElementInternals ARIA to attributes unless the author set them (the user chose this so getByRole works). Popovers use the native popover API + our positioning; see CONVENTIONS §5 "Popovers" for the gotchas (position on rAF after beforetoggle, measure offset sizes, kl-button implements popovertarget, pointer-down state vs light dismiss).
- Step 7b: services build class-layer markup only (no elements needed). The toaster moves inside the topmost open modal (modals make outside popovers inert). Contrast pairs can be conditional (`when`), e.g. toast icons only where the style draws them.
- Step 8 (user chose): table sorting is event-based (`kl-sort`), DOM re-ordering only with `data-kl-table="dom"`. Phones get a scrolling table wrapper (sticky header and first column) plus opt-in `data-stacked`. Tabs: segmented in Mono/Solo, underline in Chorus, with `variant` to override. Elements only where there's behaviour (`<kl-tabs>`); the rest are classes + directives.
- Step 9 (user chose): amounts are exact decimal strings (`minorUnits` helper, BigInt beyond MAX_SAFE); live grouping while typing; OTP = one real input drawn as boxes; transaction list = classes + data-driven element; stepper = indicator only.
- Step 10 (user chose): device-key and passphrase modes (device default); PBKDF2 600k; passphrase stores auto-lock after 5 idle minutes, optional lockOnHide. Store/key names are bound as AES-GCM aad. Chromium rejects `additionalData: undefined`, so only pass it when set.
- Open item: validation messages in amount/OTP/dialog/toast default to English. A consistent i18n option (like the transaction list's `labels`) would help before 1.0.
- Styles never change duration primitives; they pick steps via `--kl-motion-*`, so reduced motion keeps working.

## Commands

- `npm run dev`: static server at http://localhost:5173 (test pages under /tests/).
- `npm run check:tokens`: gamut, WCAG contrast (light + dark), drift. It must pass. Extend its `pairs` list when you add colour pairs.
- `npm run gen:palette`: regenerate the colour scales.
- `npm test`: Playwright (`e2e/`) in chromium, firefox and webkit; the config starts the dev server on port 5180.

## How the user likes to work

- Ask clarifying questions before big or ambiguous work. One focused step at a time; they will correct assumptions quickly.
- Keep it simple and direct. Short summaries of what changed, not long recaps.
- Before finishing each step:
  - `npm run check:tokens` and `npm test` pass. Add e2e tests for new behaviour.
  - Check the relevant test page in light and dark, and in every style built so far. Fix anything that looks wrong.
  - Update CONVENTIONS.md and README.md if anything public changed.
  - **Do not commit** (since Step 3). Leave changes uncommitted for the user; a suggested conventional message (feat:, fix:, docs:…) is fine.
