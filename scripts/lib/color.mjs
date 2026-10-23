// Minimal colour maths for the token scripts (no dependencies).
// Colours are { r, g, b, alpha } in gamma-encoded sRGB, channels 0–1 (may be out of range before clamping).

const cbrt = Math.cbrt;

export function oklchToOklab([l, c, h]) {
  const rad = ((h || 0) * Math.PI) / 180;
  return [l, c * Math.cos(rad), c * Math.sin(rad)];
}

export function oklabToOklch([l, a, b]) {
  const c = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return [l, c, c < 1e-6 ? 0 : h];
}

export function oklabToLinear([l, a, b]) {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

export function linearToOklab([r, g, b]) {
  const l = cbrt(0.4122214708 * r + 0.5363288310 * g + 0.0514459929 * b);
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

const toGamma = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055);
const toLinear = (x) => (x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4);

export const linearToRgb = (lin) => lin.map(toGamma);
export const rgbToLinear = (rgb) => rgb.map(toLinear);

export const oklchToRgb = (lch) => linearToRgb(oklabToLinear(oklchToOklab(lch)));
export const rgbToOklab = (rgb) => linearToOklab(rgbToLinear(rgb));

/** True when an OKLCH colour fits inside sRGB (tiny tolerance for float noise only). */
export function inGamut(lch, eps = 1e-7) {
  return oklabToLinear(oklchToOklab(lch)).every((v) => v >= -eps && v <= 1 + eps);
}

export function toHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

export function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
  return { r: n(0), g: n(2), b: n(4), alpha: h.length === 8 ? n(6) : 1 };
}

/** WCAG 2 relative luminance of an sRGB colour (channels clamped). */
export function luminance({ r, g, b }) {
  const [lr, lg, lb] = rgbToLinear([r, g, b].map((v) => Math.min(1, Math.max(0, v))));
  return 0.2126 * lr + 0.7152 * lg + 0.0722 * lb;
}

export function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
