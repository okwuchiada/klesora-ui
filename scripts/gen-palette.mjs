// Generates the OKLCH colour scales in src/tokens/primitives.css.
// Each step has a target lightness, chroma and hue; chroma is reduced until the
// colour (after rounding) sits inside the sRGB gamut, so no browser ever clips it.
// Usage: npm run gen:palette
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { inGamut, oklchToRgb, toHex } from './lib/color.mjs';

const file = fileURLToPath(new URL('../src/tokens/primitives.css', import.meta.url));
const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];

// Shared lightness ladder for chromatic hues. 600 stays dark enough for white text (≥4.5:1).
const hueL = [0.971, 0.936, 0.885, 0.81, 0.714, 0.632, 0.535, 0.48, 0.41, 0.35, 0.262];

const scales = {
  // Near-neutral, faintly cool. Ladder follows shadcn's neutral.
  gray: {
    l: [0.985, 0.97, 0.922, 0.87, 0.708, 0.556, 0.439, 0.371, 0.269, 0.205, 0.145],
    c: [0.002, 0.002, 0.003, 0.004, 0.006, 0.008, 0.008, 0.008, 0.007, 0.006, 0.005],
    h: 264,
  },
  blue: {
    l: hueL,
    c: [0.014, 0.032, 0.062, 0.11, 0.165, 0.2, 0.215, 0.2, 0.17, 0.13, 0.09],
    h: [254, 255, 256, 257, 258, 259, 261, 263, 265, 266, 267],
  },
  green: {
    l: hueL,
    c: [0.024, 0.05, 0.088, 0.13, 0.165, 0.17, 0.16, 0.14, 0.12, 0.1, 0.07],
    h: [156, 155, 154, 152, 150, 149, 149, 150, 151, 152, 153],
  },
  // Yellow sits lighter, so amber gets its own ladder. 600 is the light-mode warning fill.
  amber: {
    l: [0.987, 0.962, 0.924, 0.879, 0.828, 0.769, 0.66, 0.555, 0.473, 0.414, 0.279],
    c: [0.022, 0.059, 0.115, 0.153, 0.172, 0.17, 0.147, 0.135, 0.115, 0.095, 0.067],
    h: [95, 93, 90, 85, 78, 72, 68, 58, 52, 50, 48],
  },
  // Muted, Material-like violet (Chorus primary).
  violet: {
    l: hueL,
    c: [0.012, 0.028, 0.05, 0.085, 0.12, 0.14, 0.15, 0.14, 0.12, 0.1, 0.07],
    h: [300, 299, 298, 297, 296, 295, 294, 293, 292, 291, 290],
  },
  red: {
    l: hueL,
    c: [0.013, 0.03, 0.062, 0.11, 0.18, 0.22, 0.22, 0.2, 0.17, 0.14, 0.1],
    h: [17, 17, 18, 20, 22, 25, 27, 27, 26, 25, 24],
  },
};

const round = (v, d) => Math.round(v * 10 ** d) / 10 ** d;

function fit(l, c, h) {
  l = round(l, 3);
  h = round(h, 1);
  // Binary search for the largest in-gamut chroma, then round down until the rounded value fits.
  let lo = 0;
  let hi = c;
  if (!inGamut([l, c, h])) {
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      inGamut([l, mid, h]) ? (lo = mid) : (hi = mid);
    }
    c = lo;
  }
  c = Math.floor(c * 1000) / 1000;
  while (c > 0 && !inGamut([l, c, h])) c = round(c - 0.001, 3);
  return [l, c, h];
}

const lines = [];
for (const [name, s] of Object.entries(scales)) {
  lines.push(`  /* ${name} */`);
  steps.forEach((step, i) => {
    const h = Array.isArray(s.h) ? s.h[i] : s.h;
    const [l, c, hh] = fit(s.l[i], s.c[i], h);
    const value = `oklch(${round(l * 100, 1)}% ${c} ${hh})`;
    lines.push(`  --kl-${name}-${step}: ${value}; /* ${toHex(oklchToRgb([l, c, hh]))} */`);
  });
}

const start = '/* @generated palette: start (npm run gen:palette) */';
const end = '/* @generated palette: end */';
const css = await readFile(file, 'utf8');
const a = css.indexOf(start);
const b = css.indexOf(end);
if (a < 0 || b < 0) throw new Error('palette markers not found in primitives.css');
const next = css.slice(0, a + start.length) + '\n' + lines.join('\n') + '\n  ' + css.slice(b);
await writeFile(file, next);
console.log(`Wrote ${lines.length - Object.keys(scales).length} colours to src/tokens/primitives.css`);
