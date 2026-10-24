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

> Status: early development (Step 9 of the roadmap: fintech extras (amount input, OTP/PIN, transactions, stepper)). Not yet published.

Browser support: Chrome / Edge 119+, Firefox 128+, Safari 17+.

## Customise

Set knobs on `<html>`, or on any element marked `data-kl-scope`:

```html
<html style="--kl-brand: #0a7cff; --kl-radius-base: 0.75rem; --kl-density: 0.9">
<section data-kl-scope style="--kl-brand: #16a34a">…</section>
<aside data-kl-theme="dark">…</aside>
```

The text colour on the brand is picked automatically; set `--kl-brand-fg` to override it. See CONVENTIONS.md §2–3 for every token.

Components work as classes on native elements or as custom elements:

```html
<kl-field>
  <label>Amount</label>
  <kl-input name="amount" inputmode="decimal" required><span slot="start">₦</span></kl-input>
  <p slot="hint">Minimum ₦100</p>
</kl-field>
<kl-checkbox name="save" checked>Save beneficiary</kl-checkbox>
<kl-button type="submit">Send money</kl-button>

<button class="kl-btn" data-variant="outline">Cancel</button>

<kl-button variant="outline" popovertarget="acct">Account</kl-button>
<kl-menu id="acct">
  <kl-menu-item value="statement">Download statement</kl-menu-item>
</kl-menu>
<kl-select name="bank" placeholder="Choose a bank">
  <kl-option value="gtb">GTBank</kl-option>
</kl-select>
<kl-button icon aria-label="Copy" data-kl-tooltip="Copy account number">⧉</kl-button>

<kl-amount-input name="amount" currency="NGN" min="100" required></kl-amount-input>
<kl-otp-input name="code" length="6"></kl-otp-input>
<kl-stepper value="2"><div class="kl-stepper__step">Recipient</div>…</kl-stepper>
```

```js
import { dialog, toast, theme } from 'klesora-ui';

if (await dialog.confirm({ title: 'Send ₦45,000 to Ada Obi?', confirmText: 'Send' })) {
  toast.success('Payment sent');
}
theme.set({ style: 'solo', theme: 'dark' }); // remembered; see CONVENTIONS.md §7 for the <head> snippet
```

The CSS also includes a gentle reset, page defaults (nested themes paint themselves) and a small set of utilities: `.kl-stack`, `.kl-cluster`, `.kl-grid`, `.kl-container`, `.kl-surface`, `.kl-sr-only`, `.kl-truncate` and more (CONVENTIONS.md §4).

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
npm run dev            # http://localhost:5173/docs/ (test pages under /tests/: tokens, base, core, components, overlays, services, layout, fintech)
npm run check:tokens   # gamut, WCAG contrast per style in light and dark, drift, style-pack rules
npm run gen:palette    # regenerate the OKLCH colour scales in src/tokens/primitives.css
npm test               # Playwright tests in Chromium, Firefox and WebKit (starts the dev server)
```

## Rules

See [CONVENTIONS.md](./CONVENTIONS.md) for naming, tokens, CSS layers, element and event conventions, and versioning.
