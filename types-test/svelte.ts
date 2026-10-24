// Svelte 5 element typings.
import type {} from '../types/svelte.js';
import type { SvelteHTMLElements } from 'svelte/elements';

const ok: SvelteHTMLElements['kl-select'] = { placeholder: 'Choose', placement: 'bottom-end', class: 'w-full' };
const events: SvelteHTMLElements['kl-menu'] = { 'onkl-select': (e) => console.log(e.detail.value) };
// @ts-expect-error: unknown placement
const bad: SvelteHTMLElements['kl-select'] = { placement: 'middle' };
void [ok, events, bad];
