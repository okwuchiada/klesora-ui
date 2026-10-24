# Using Klesora UI with frameworks

Klesora UI is plain CSS plus light-DOM custom elements, so it works anywhere HTML does. Each
section below covers how to load it, tell the framework the `kl-*` tags are custom elements,
bind values, and get typed templates.

All frameworks share three facts:

- **CSS once:** `import 'klesora-ui/css'` (or `<link rel="stylesheet" href="…/klesora-ui/src/klesora-ui.css">`).
- **Elements once:** `import 'klesora-ui'` registers every element and directive. For smaller
  bundles import only what you use: `import 'klesora-ui/components/button'`,
  `import 'klesora-ui/directives/tooltip'`. Registering twice is harmless.
- **Values and events:** controls are form-associated and fire native `input` / `change`, so
  `event.currentTarget.value` (or `.checked` for checkbox and switch) is the current value.
  Library events are `kl-*` CustomEvents with data in `detail`.

## Plain HTML

```html
<link rel="stylesheet" href="/node_modules/klesora-ui/src/klesora-ui.css">
<script type="module" src="/node_modules/klesora-ui/src/index.js"></script>

<kl-field>
  <label>Amount</label>
  <kl-amount-input name="amount" min="100" required></kl-amount-input>
</kl-field>
```

The sources are native ES modules, so a bundler is optional. To remember the theme without a
flash on reload, inline `themeInitScript` at the top of `<head>` (CONVENTIONS.md §7).

## React 19

React 19 supports custom elements natively. It sets matching props as properties and turns
`on<event>` props into listeners, so `kl-*` events are `onkl-change`, `onkl-select`, and so on.

```tsx
import 'klesora-ui/css';
import 'klesora-ui';
import type {} from 'klesora-ui/types/react'; // typed JSX for kl-* tags (once, anywhere)

export function Transfer() {
  const [amount, setAmount] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); send(new FormData(e.currentTarget)); }}>
      <kl-field>
        <label>Amount</label>
        <kl-amount-input name="amount" value={amount} onInput={(e) => setAmount(e.currentTarget.value)} />
      </kl-field>
      <kl-tabs value="overview" onkl-change={(e) => setTab(e.detail.value)}>…</kl-tabs>
      <kl-button type="submit">Send</kl-button>
    </form>
  );
}
```

- **Attributes and classes:** use `className` or `class`. Variants are plain attributes (`variant="outline"`).
- **Refs:** `useRef<HTMLElementTagNameMap['kl-select']>(null)` gives typed access to
  methods (`show()`, `setCustomValidity()`).
- **React 18** doesn't pass properties or custom events to custom elements. Set non-string
  values and listen to `kl-*` events through a ref:

  ```tsx
  const ref = useRef<HTMLElementTagNameMap['kl-transaction-list']>(null);
  useEffect(() => {
    const list = ref.current!;
    list.items = items;
    const onSelect = (e: CustomEvent) => open(e.detail.item);
    list.addEventListener('kl-select', onSelect as EventListener);
    return () => list.removeEventListener('kl-select', onSelect as EventListener);
  }, [items]);
  ```

### Next.js and other server rendering

Light DOM means your content server-renders normally: a `<kl-button>Pay</kl-button>` is in
the HTML from the first byte. The elements add their behaviour on the client.

- **Register after hydration.** Some elements add attributes and helper nodes when they
  upgrade: `<kl-input>` appends its inner `<input>`, and roles are mirrored as attributes. If
  that happens before React hydrates, React reports mismatches. Load the library in a client
  effect:

  ```tsx
  'use client';
  import { useEffect } from 'react';
  export function KlesoraProvider({ children }) {
    useEffect(() => { import('klesora-ui'); }, []);
    return children;
  }
  ```

- **Importing is server-safe:** modules don't touch `document` or `customElements` on import.
- **Theme without a flash:**

  ```tsx
  import { themeInitScript } from 'klesora-ui/services/theme';
  <head><script dangerouslySetInnerHTML={{ __html: themeInitScript }} /></head>
  ```

## Vue 3

Tell Vue's compiler that `kl-*` tags are custom elements:

```js
// vite.config.js
import vue from '@vitejs/plugin-vue';
export default {
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag.startsWith('kl-') } } })],
};
```

```vue
<script setup lang="ts">
import 'klesora-ui/css';
import 'klesora-ui';
import type {} from 'klesora-ui/types/vue'; // typed templates in Volar / vue-tsc
const amount = ref('');
const alerts = ref(true);
</script>

<template>
  <kl-amount-input :value="amount" @input="amount = $event.currentTarget.value" />
  <kl-switch :checked="alerts" @change="alerts = $event.currentTarget.checked">Alerts</kl-switch>
  <kl-tabs @kl-change="(e) => (tab = e.detail.value)">…</kl-tabs>
</template>
```

- **Binding:** explicit `:value` + `@input` always works. `v-model` on a custom element binds
  `value` and `input` like on `<input>`, so it suits the text-like controls (`kl-input`,
  `kl-amount-input`, `kl-select`, `kl-otp-input`). For `kl-checkbox` and `kl-switch` use
  `:checked` + `@change`.
- **Properties:** Vue sets props as properties when the element has them, so arrays and
  objects work: `<kl-transaction-list :items="txns">`.

## Angular

Allow custom elements in the components that use them, and register the library once (in
`main.ts`):

```ts
// main.ts
import 'klesora-ui';
// angular.json → "styles": ["node_modules/klesora-ui/src/klesora-ui.css"]

@Component({
  selector: 'app-transfer',
  standalone: true,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [ReactiveFormsModule, KlValueAccessor],
  template: `
    <kl-field>
      <label>Amount</label>
      <kl-amount-input [formControl]="amount"></kl-amount-input>
    </kl-field>
    <kl-tabs (kl-change)="tab = $event.detail.value">…</kl-tabs>
  `,
})
export class TransferComponent {
  amount = new FormControl('');
}
```

Angular forms (`formControl`, `formControlName`, `ngModel`) need a ControlValueAccessor to talk
to custom elements. Copy this directive into your app. It's kept out of the package so
Klesora UI has no Angular dependency:

```ts
// kl-value-accessor.ts
import { Directive, ElementRef, HostListener, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

type KlControl = HTMLElement & { value: string; checked: boolean; disabled: boolean };

@Directive({
  selector: `
    :is(kl-input, kl-amount-input, kl-select, kl-otp-input, kl-checkbox, kl-switch)[formControl],
    :is(kl-input, kl-amount-input, kl-select, kl-otp-input, kl-checkbox, kl-switch)[formControlName],
    :is(kl-input, kl-amount-input, kl-select, kl-otp-input, kl-checkbox, kl-switch)[ngModel]`,
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => KlValueAccessor), multi: true }],
})
export class KlValueAccessor implements ControlValueAccessor {
  private onChange: (value: unknown) => void = () => {};
  private onTouched: () => void = () => {};
  constructor(private ref: ElementRef<KlControl>) {}

  private get toggle() {
    return /^kl-(checkbox|switch)$/.test(this.ref.nativeElement.localName);
  }

  writeValue(value: unknown) {
    const el = this.ref.nativeElement;
    if (this.toggle) el.checked = Boolean(value);
    else el.value = value == null ? '' : String(value);
  }
  registerOnChange(fn: (value: unknown) => void) { this.onChange = fn; }
  registerOnTouched(fn: () => void) { this.onTouched = fn; }
  setDisabledState(disabled: boolean) { this.ref.nativeElement.disabled = disabled; }

  @HostListener('input') handleInput() {
    const el = this.ref.nativeElement;
    this.onChange(this.toggle ? el.checked : el.value);
  }
  @HostListener('focusout') handleBlur() { this.onTouched(); }
}
```

If your Angular version doesn't accept `:is()` in directive selectors, list the combinations
out (`kl-input[formControl], kl-input[formControlName], …`).

## Svelte 5

```svelte
<script lang="ts">
  import 'klesora-ui/css';
  import 'klesora-ui';
  import type {} from 'klesora-ui/types/svelte'; // typed templates
  let amount = $state('');
</script>

<kl-amount-input value={amount} oninput={(e) => (amount = e.currentTarget.value)}></kl-amount-input>
<kl-tabs onkl-change={(e) => (tab = e.detail.value)}>…</kl-tabs>
```

- **Properties:** Svelte sets props as properties when the element has them, so
  `<kl-transaction-list items={txns}>` works.
- **Binding:** prefer `value` + `oninput` over `bind:value` on custom elements.

## Editor support and typings

- **`custom-elements.json`** (the `customElements` field in package.json) describes every element:
  attributes, properties, events, slots and CSS tokens. VS Code (with the Custom Elements
  Language Server or the HTML custom data tooling), Storybook and doc generators read it.
- **TypeScript:**
  - `import { dialog, toast, money } from 'klesora-ui'` is fully typed.
  - `HTMLElementTagNameMap` knows every `kl-*` tag, so `document.querySelector('kl-select')` is a typed `KlSelect`.
  - Opt into the per-framework typings with a type-only import: `klesora-ui/types/react`, `/vue` or `/svelte`.
- Both are generated from the components' own property declarations
  (`npm run build:types`). `npm run check:types` fails if they drift or stop type-checking.
