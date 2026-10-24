// Vue GlobalComponents entries (used by Volar / vue-tsc for templates).
import type {} from '../types/vue.js';
import type { GlobalComponents } from 'vue';

type ButtonProps = InstanceType<GlobalComponents['kl-button']>['$props'];
const ok: ButtonProps = { variant: 'ghost', size: 'lg' };
// @ts-expect-error: unknown size
const bad: ButtonProps = { size: 'huge' };
void [ok, bad];
