---
title: Getting started
description: Install Klesora UI, load the CSS and elements, and build a first form.
order: 1
---
# Getting started

Klesora UI is plain CSS plus light-DOM custom elements, with no runtime dependencies. It works in plain HTML and in React, Vue, Angular and Svelte.

## Install

```sh
npm install klesora-ui
```

## Load it

Load the CSS once and register the elements once. Everything else is HTML.

```html
<link rel="stylesheet" href="/node_modules/klesora-ui/src/klesora-ui.css">
<script type="module" src="/node_modules/klesora-ui/src/index.js"></script>
```

With a bundler:

```js
import 'klesora-ui/css';
import 'klesora-ui'; // registers every element and directive
```

For smaller bundles, import only what you use:

```js
import 'klesora-ui/components/button';
import 'klesora-ui/components/amount-input';
import 'klesora-ui/directives/tooltip';
```

## A first form

Edit the code below and the preview updates as you type. Use the style and theme switchers in the header to re-skin it.

```html live
<form class="kl-stack" data-gap="4" style="max-inline-size: 24rem">
  <kl-field>
    <label>Account number</label>
    <kl-input name="account" inputmode="numeric" pattern="\d{10}" required></kl-input>
    <p slot="hint">10 digits</p>
  </kl-field>
  <kl-field>
    <label>Amount</label>
    <kl-amount-input name="amount" min="100" required></kl-amount-input>
  </kl-field>
  <kl-checkbox name="save" checked>Save beneficiary</kl-checkbox>
  <div class="kl-cluster">
    <kl-button type="submit">Send money</kl-button>
    <kl-button type="reset" variant="ghost">Reset</kl-button>
  </div>
</form>
```

## Two layers

Every component works as a class on native HTML and, where it adds behaviour, as a custom element. Both read the same tokens.

```html live
<div class="kl-cluster">
  <button class="kl-btn" data-variant="outline">Class layer</button>
  <kl-button variant="outline">Element</kl-button>
</div>
```

## Pick a style and theme

Set them on `<html>` (or any container):

```html
<html data-kl-style="solo" data-kl-theme="dark" style="--kl-brand: #0a7cff">
```

To remember the choice across visits without a flash on reload, use the [theme service](../services/#theme) and its head snippet.

## Next

- [Theming](../theming/): tokens, brand colour, radius and density
- [Styles](../styles/): Solo, Mono and Chorus compared
- [Frameworks](../frameworks/): React, Vue, Angular, Svelte, Next.js
- [Components](../../components/button/)
