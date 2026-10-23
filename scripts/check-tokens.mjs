// Checks the design tokens: sRGB gamut, WCAG contrast in light and dark, and dark/system-dark drift.
// No dependencies. Usage: npm run check:tokens
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  contrast,
  hexToRgb,
  inGamut,
  linearToRgb,
  oklabToLinear,
  oklabToOklch,
  oklchToOklab,
  oklchToRgb,
  rgbToOklab,
  toHex,
} from './lib/color.mjs';

const src = (p) => fileURLToPath(new URL(`../src/tokens/${p}`, import.meta.url));
const primitivesCss = await readFile(src('primitives.css'), 'utf8');
const baseCss = await readFile(src('base.css'), 'utf8');

let failures = 0;
const fail = (msg) => {
  failures++;
  console.log(`  ✗ ${msg}`);
};

/* ---------- CSS parsing ---------- */

// Returns [{ selector, media, decls: Map }] for every rule, including rules nested in @media.
function parseRules(css, media = null) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf('{', i);
    if (open < 0) break;
    const prelude = css.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (depth && j < css.length) {
      if (css[j] === '{') depth++;
      else if (css[j] === '}') depth--;
      j++;
    }
    const body = css.slice(open + 1, j - 1);
    if (prelude.startsWith('@media')) rules.push(...parseRules(body, prelude));
    else rules.push({ selector: prelude.replace(/\s+/g, ' '), media, decls: parseDecls(body) });
    i = j;
  }
  return rules;
}

function parseDecls(body) {
  const decls = new Map();
  let depth = 0;
  let start = 0;
  const push = (s) => {
    const k = s.indexOf(':');
    if (k > 0) decls.set(s.slice(0, k).trim(), s.slice(k + 1).trim().replace(/\s+/g, ' '));
  };
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth--;
    else if (body[i] === ';' && !depth) {
      push(body.slice(start, i));
      start = i + 1;
    }
  }
  push(body.slice(start));
  return decls;
}

const primitiveRule = parseRules(primitivesCss).find((r) => r.selector === ':root');
const rules = parseRules(baseCss);
const find = (pred, label) => {
  const r = rules.find(pred);
  if (!r) throw new Error(`base.css: could not find ${label}`);
  return r.decls;
};
const lightDecls = find((r) => !r.media && r.selector.includes('[data-kl-theme="light"]'), 'light block');
const darkDecls = find((r) => !r.media && r.selector === '[data-kl-theme="dark"]', 'dark block');
const systemDarkDecls = find(
  (r) => r.media?.includes('prefers-color-scheme: dark'),
  'system-dark block',
);
const semanticDecls = find((r) => r.selector.startsWith(':where('), 'semantic block');
const motionFullDecls = find((r) => r.selector === '[data-kl-motion="full"]', 'motion full block');

/* ---------- Value resolution ---------- */

// Split on a separator at parenthesis depth 0.
function splitTop(s, sep) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (!depth && (sep === ' ' ? /\s/.test(s[i]) : s[i] === sep)) {
      out.push(s.slice(start, i));
      start = i + 1;
    }
  }
  out.push(s.slice(start));
  return out.map((x) => x.trim()).filter(Boolean);
}

// Substitute var() references (innermost-first is not needed: we resolve left to right, recursively).
function resolve(value, vars, seen = new Set()) {
  let out = '';
  let i = 0;
  while (i < value.length) {
    const k = value.indexOf('var(', i);
    if (k < 0) {
      out += value.slice(i);
      break;
    }
    out += value.slice(i, k);
    let depth = 1;
    let j = k + 4;
    while (depth && j < value.length) {
      if (value[j] === '(') depth++;
      else if (value[j] === ')') depth--;
      j++;
    }
    const inner = value.slice(k + 4, j - 1);
    const comma = splitTop(inner, ',');
    const name = comma[0];
    const fallback = inner.includes(',') ? inner.slice(inner.indexOf(',') + 1).trim() : null;
    if (vars.has(name)) {
      if (seen.has(name)) throw new Error(`cycle at ${name}`);
      out += resolve(vars.get(name), vars, new Set([...seen, name]));
    } else if (fallback !== null) {
      out += resolve(fallback, vars, seen);
    } else {
      throw new Error(`undefined ${name}`);
    }
    i = j;
  }
  return out;
}

/* ---------- Colour evaluation ---------- */
// Colours are { lab: [L, a, b], alpha }.

const fromRgb = ({ r, g, b, alpha }) => ({ lab: rgbToOklab([r, g, b]), alpha });
const toRgb = (c) => {
  const [r, g, b] = linearToRgb(oklabToLinear(c.lab));
  return { r, g, b, alpha: c.alpha };
};

const num = (s) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));

function evalExpr(expr, env) {
  const js = expr
    .replace(/calc\(/g, '(')
    .replace(/\b(clamp|min|max)\(/g, '$1(')
    .replace(/(\d*\.?\d+)%/g, '($1/100)');
  if (!/^[\d\s.+\-*/(),a-z]*$/.test(js)) throw new Error(`unsupported expression: ${expr}`);
  const clamp = (lo, v, hi) => Math.min(hi, Math.max(lo, v));
  return Function('clamp', 'min', 'max', ...Object.keys(env), `return (${js});`)(
    clamp,
    Math.min,
    Math.max,
    ...Object.values(env),
  );
}

function evalColor(str) {
  str = str.trim();
  if (str.startsWith('#')) return fromRgb(hexToRgb(str));
  if (str === 'white') return fromRgb({ r: 1, g: 1, b: 1, alpha: 1 });
  if (str === 'black') return fromRgb({ r: 0, g: 0, b: 0, alpha: 1 });
  if (str === 'transparent') return { lab: [0, 0, 0], alpha: 0 };
  const m = str.match(/^([a-z-]+)\(([\s\S]*)\)$/);
  if (!m) throw new Error(`unsupported colour: ${str}`);
  const [, fn, args] = m;

  if (fn === 'oklch') {
    const [channels, alphaPart] = splitTop(args, '/');
    const parts = splitTop(channels, ' ');
    if (parts[0] === 'from') {
      // Relative colour syntax: oklch(from <color> <l> <c> <h> [/ <alpha>])
      const base = evalColor(parts[1]);
      const [l, c, h] = oklabToOklch(base.lab);
      const env = { l, c, h, alpha: base.alpha };
      const [L, C, H] = parts.slice(2).map((p) => evalExpr(p, env));
      const a = alphaPart ? evalExpr(alphaPart, env) : base.alpha;
      return { lab: oklchToOklab([Math.min(1, Math.max(0, L)), Math.max(0, C), H]), alpha: a };
    }
    const [L, C, H] = parts.map(num);
    return { lab: oklchToOklab([L, C, H]), alpha: alphaPart ? num(alphaPart) : 1 };
  }

  if (fn === 'color-mix') {
    const [space, a, b] = splitTop(args, ',');
    if (space !== 'in oklab') throw new Error(`unsupported mix space: ${space}`);
    const parse = (s) => {
      const parts = splitTop(s, ' ');
      const last = parts.at(-1);
      return last.endsWith('%') && parts.length > 1
        ? { color: evalColor(parts.slice(0, -1).join(' ')), p: parseFloat(last) / 100 }
        : { color: evalColor(s), p: null };
    };
    const A = parse(a);
    const B = parse(b);
    if (A.p === null && B.p === null) A.p = B.p = 0.5;
    else if (A.p === null) A.p = 1 - B.p;
    else if (B.p === null) B.p = 1 - A.p;
    const total = A.p + B.p;
    const [pa, pb] = [A.p / total, B.p / total];
    // Premultiplied interpolation.
    const alpha = A.color.alpha * pa + B.color.alpha * pb;
    const lab = [0, 1, 2].map((i) =>
      alpha ? (A.color.lab[i] * A.color.alpha * pa + B.color.lab[i] * B.color.alpha * pb) / alpha : 0,
    );
    return { lab, alpha: alpha * Math.min(1, total) };
  }

  throw new Error(`unsupported colour function: ${fn}`);
}

/* ---------- Contexts ---------- */

const ctx = (scheme, extra = {}) =>
  new Map([...primitiveRule.decls, ...scheme, ...semanticDecls, ...Object.entries(extra)]);

const color = (vars, name) => evalColor(resolve(`var(${name})`, vars));
const hex = (c) => toHex(Object.values(toRgb(c)).slice(0, 3));

/* ---------- 1. Primitives: gamut and hex comments ---------- */

console.log('\nPrimitives (sRGB gamut, hex comments)');
let primitiveCount = 0;
for (const m of primitivesCss.matchAll(/(--kl-[a-z]+-\d+): oklch\(([^)]*)\);\s*\/\* (#[0-9a-f]{6}) \*\//g)) {
  primitiveCount++;
  const [, name, value, comment] = m;
  const [L, C, H] = value.split(/\s+/).map(num);
  if (!inGamut([L, C, H])) fail(`${name} is outside sRGB`);
  const actual = toHex(oklchToRgb([L, C, H]));
  if (actual !== comment) fail(`${name} hex comment ${comment} should be ${actual}`);
}
console.log(`  ${primitiveCount} colours checked`);

/* ---------- 2. Drift ---------- */

console.log('\nScheme blocks');
const same = (a, b) => a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
if (!same(darkDecls, systemDarkDecls)) {
  for (const k of new Set([...darkDecls.keys(), ...systemDarkDecls.keys()]))
    if (darkDecls.get(k) !== systemDarkDecls.get(k))
      fail(`dark vs system-dark differ at ${k}: "${darkDecls.get(k)}" vs "${systemDarkDecls.get(k)}"`);
} else console.log('  ✓ dark and system-dark blocks are identical');
const lightKeys = [...lightDecls.keys()].sort().join();
if (lightKeys !== [...darkDecls.keys()].sort().join()) fail('light and dark blocks set different tokens');
else console.log('  ✓ light and dark blocks set the same tokens');
for (const [k, v] of motionFullDecls)
  if (primitiveRule.decls.get(k) !== v) fail(`data-kl-motion="full" ${k} is ${v}, primitives say ${primitiveRule.decls.get(k)}`);

/* ---------- 3. Contrast ---------- */

const TEXT = 4.5;
const BODY = 7;
const UI = 3;
const pairs = [
  // [foreground, background, minimum, label]
  ['--kl-color-fg', '--kl-color-bg', BODY, 'body text'],
  ['--kl-color-fg', '--kl-color-surface', BODY, 'body text on surface'],
  ['--kl-color-fg', '--kl-color-surface-raised', BODY, 'body text on raised'],
  ['--kl-color-fg', '--kl-color-muted', TEXT],
  ['--kl-color-fg', '--kl-color-selected', TEXT],
  ['--kl-color-fg-muted', '--kl-color-bg', TEXT],
  ['--kl-color-fg-muted', '--kl-color-surface', TEXT],
  ['--kl-color-fg-muted', '--kl-color-muted', TEXT],
  ['--kl-color-fg-muted', '--kl-color-muted-hover', TEXT],
  ['--kl-color-primary-fg', '--kl-color-primary', TEXT],
  ['--kl-color-primary-fg', '--kl-color-primary-hover', TEXT],
  ['--kl-color-primary-fg', '--kl-color-primary-active', TEXT],
  ['--kl-color-fg', '--kl-color-primary-subtle', TEXT],
  ['--kl-color-secondary-fg', '--kl-color-secondary', TEXT],
  ['--kl-color-secondary-fg', '--kl-color-secondary-hover', TEXT],
  ...['info', 'success', 'warning', 'danger'].flatMap((s) => [
    [`--kl-color-${s}-fg`, `--kl-color-${s}`, TEXT],
    [`--kl-color-${s}-text`, '--kl-color-bg', TEXT],
    [`--kl-color-${s}-text`, `--kl-color-${s}-subtle`, TEXT],
    [`--kl-color-${s}`, '--kl-color-bg', UI, 'fill'],
  ]),
  ['--kl-color-danger-fg', '--kl-color-danger-hover', TEXT],
  ['--kl-color-border-strong', '--kl-color-bg', UI, 'boundary'],
  ['--kl-color-input', '--kl-color-bg', UI, 'control boundary'],
  ['--kl-color-input', '--kl-color-surface', UI, 'control boundary'],
  ['--kl-color-primary', '--kl-color-bg', UI, 'fill'],
  ['--kl-color-ring', '--kl-color-bg', UI, 'focus ring'],
  ['--kl-color-ring', '--kl-color-surface', UI, 'focus ring'],
  ['--kl-neutral-8', '--kl-neutral-1', UI, 'ramp 8'],
  ['--kl-neutral-11', '--kl-neutral-1', TEXT, 'ramp 11'],
  ['--kl-neutral-11', '--kl-neutral-2', TEXT, 'ramp 11'],
  ['--kl-neutral-12', '--kl-neutral-1', BODY, 'ramp 12'],
];

const schemes = { light: lightDecls, dark: darkDecls };
for (const [name, decls] of Object.entries(schemes)) {
  console.log(`\nContrast: ${name}`);
  const vars = ctx(decls);
  let passed = 0;
  for (const [fg, bg, min, label] of pairs) {
    const ratio = contrast(toRgb(color(vars, fg)), toRgb(color(vars, bg)));
    const short = (n) => n.replace('--kl-color-', '').replace('--kl-', '');
    const line = `${short(fg)} on ${short(bg)}: ${ratio.toFixed(2)} (min ${min}${label ? `, ${label}` : ''})`;
    if (ratio < min) fail(line);
    else passed++;
  }
  console.log(`  ✓ ${passed}/${pairs.length} pairs pass`);
}

/* ---------- 4. Brand samples (informational) ---------- */

const brands = {
  blue: '#0a7cff',
  indigo: '#4f46e5',
  violet: '#7c3aed',
  pink: '#db2777',
  red: '#dc2626',
  orange: '#f97316',
  yellow: '#facc15',
  green: '#16a34a',
  teal: '#14b8a6',
};
console.log('\nBrand samples (informational): auto fg on brand, brand fill and ring on page');
console.log('  brand    hex      fg       fg:brand  light:fill  dark:fill');
for (const [name, value] of Object.entries(brands)) {
  const row = [name.padEnd(8), value];
  const light = ctx(lightDecls, { '--kl-brand': value });
  const dark = ctx(darkDecls, { '--kl-brand': value });
  const fg = color(light, '--kl-color-primary-fg');
  const primary = color(light, '--kl-color-primary');
  const r = (vars) => contrast(toRgb(color(vars, '--kl-color-primary')), toRgb(color(vars, '--kl-color-bg')));
  const fgRatio = contrast(toRgb(fg), toRgb(primary));
  const mark = (v, min) => `${v.toFixed(2)}${v < min ? '!' : ' '}`;
  row.push(hex(fg), mark(fgRatio, TEXT).padEnd(9), mark(r(light), UI).padEnd(11), mark(r(dark), UI));
  console.log('  ' + row.join(' '));
}
console.log('  (! = below the WCAG minimum; set --kl-brand-fg or pick a deeper brand colour)');

console.log(failures ? `\n${failures} check(s) failed.\n` : '\nAll token checks passed.\n');
process.exit(failures ? 1 : 0);
