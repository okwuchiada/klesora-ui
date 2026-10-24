// Docs site behaviour: style/theme/brand switcher, editable live examples (with copy, reset and
// compare), runnable JS examples, the theming builder, token values and search.
// Loaded as a module after the library (the page sets window.KL_BASE to the site root).
const base = window.KL_BASE ?? './'; // page-relative site root, for links and fetches
// Imports resolve against this module's URL (site/assets/), not the page.
const kl = await import('../lib/index.js');
const { theme, toast } = kl;

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------- Style, theme and brand ---------- */

const styleSelect = $('#doc-style');
const themeSelect = $('#doc-theme');
const brandInput = $('#doc-brand');
const brandReset = $('#doc-brand-reset');

function syncControls() {
  const state = theme.get();
  if (styleSelect) styleSelect.value = state.style;
  if (themeSelect) themeSelect.value = state.theme;
  if (brandInput && state.brand) brandInput.value = state.brand;
  if (brandReset) brandReset.hidden = !state.brand;
  refreshTokenValues();
  refreshContrast();
}
styleSelect?.addEventListener('change', () => theme.set({ style: styleSelect.value === 'mono' ? null : styleSelect.value }));
themeSelect?.addEventListener('change', () => theme.set({ theme: themeSelect.value === 'system' ? null : themeSelect.value }));
brandInput?.addEventListener('input', () => theme.set({ brand: brandInput.value }));
brandReset?.addEventListener('click', () => theme.set({ brand: null }));
theme.subscribe(syncControls);

/* ---------- Copy ---------- */

async function copy(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    const label = button.textContent;
    button.textContent = 'Copied';
    setTimeout(() => (button.textContent = label), 1500);
  } catch {
    toast.error('Copy failed: select the code and copy it manually.');
  }
}

/* ---------- Live HTML examples ---------- */

const STYLES = ['mono', 'solo', 'chorus'];

for (const example of $$('.doc-example[data-lang="html"]')) {
  const preview = $('.doc-example__preview', example);
  const code = $('.doc-example__code', example);
  const original = code.value;
  let timer = 0;
  let compare = example.hasAttribute('data-compare-default');

  const render = () => {
    if (compare) {
      preview.setAttribute('data-compare', '');
      preview.replaceChildren(
        ...STYLES.map((style) => {
          const pane = document.createElement('div');
          pane.className = 'doc-example__pane';
          pane.dataset.klStyle = style;
          pane.innerHTML = `<span class="doc-example__pane-label">${style}</span>${code.value}`;
          return pane;
        }),
      );
    } else {
      preview.removeAttribute('data-compare');
      preview.innerHTML = code.value;
    }
  };
  if (compare) render();

  code.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(render, 150);
  });
  code.addEventListener('keydown', (e) => {
    // Tab indents inside the editor; Escape releases focus to the page (so Tab moves on).
    if (e.key === 'Tab' && !e.shiftKey && !code.dataset.released) {
      e.preventDefault();
      code.setRangeText('  ', code.selectionStart, code.selectionEnd, 'end');
      code.dispatchEvent(new Event('input'));
    } else if (e.key === 'Escape') {
      code.dataset.released = '1';
    }
  });
  code.addEventListener('blur', () => delete code.dataset.released);

  $('[data-action="copy"]', example)?.addEventListener('click', (e) => copy(code.value, e.currentTarget));
  $('[data-action="reset"]', example)?.addEventListener('click', () => {
    code.value = original;
    render();
  });
  const compareButton = $('[data-action="compare"]', example);
  compareButton?.addEventListener('click', () => {
    compare = !compare;
    compareButton.setAttribute('aria-pressed', String(compare));
    render();
  });
}

/* ---------- Runnable JS examples ---------- */

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
const scope = { ...kl, kl };

for (const example of $$('.doc-example[data-lang="js"]')) {
  const code = $('.doc-example__code', example);
  const status = $('.doc-example__status', example);
  const original = code.value;
  $('[data-action="run"]', example)?.addEventListener('click', async () => {
    status.textContent = '';
    try {
      // Drop import lines: everything the examples import is already in scope.
      const body = code.value.replace(/^\s*import[^;]+;?\s*$/gm, '');
      await new AsyncFunction(...Object.keys(scope), body)(...Object.values(scope));
    } catch (error) {
      status.textContent = `Error: ${error.message}`;
    }
  });
  $('[data-action="copy"]', example)?.addEventListener('click', (e) => copy(code.value, e.currentTarget));
  $('[data-action="reset"]', example)?.addEventListener('click', () => {
    code.value = original;
    status.textContent = '';
  });
}

/* ---------- Static code blocks: copy buttons ---------- */

for (const pre of $$('.doc-prose > pre.doc-code, .doc-prose li pre.doc-code')) {
  const wrap = document.createElement('div');
  wrap.style.position = 'relative';
  pre.replaceWith(wrap);
  wrap.append(pre);
  const button = Object.assign(document.createElement('button'), { type: 'button', className: 'kl-btn', textContent: 'Copy' });
  Object.assign(button.dataset, { variant: 'ghost', size: 'sm' });
  button.style.cssText = 'position:absolute; inset-block-start: var(--kl-space-2); inset-inline-end: var(--kl-space-2)';
  button.setAttribute('aria-label', 'Copy code');
  button.addEventListener('click', () => copy(pre.textContent, button));
  wrap.append(button);
}

/* ---------- Wide tables: focusable when they scroll (keyboard users can scroll them) ---------- */

function labelScrollers() {
  for (const wrap of $$('.doc-table')) {
    const scrolls = wrap.scrollWidth > wrap.clientWidth + 1;
    if (scrolls && !wrap.hasAttribute('tabindex')) {
      wrap.tabIndex = 0;
      wrap.setAttribute('role', 'region');
      let heading = wrap.previousElementSibling;
      while (heading && !/^H[1-4]$/.test(heading.tagName)) heading = heading.previousElementSibling;
      wrap.setAttribute('aria-label', `${heading?.textContent.replace(/#$/, '').trim() || 'Table'} (scrolls sideways)`);
    } else if (!scrolls && wrap.getAttribute('role') === 'region') {
      wrap.removeAttribute('tabindex');
      wrap.removeAttribute('role');
      wrap.removeAttribute('aria-label');
    }
  }
}
labelScrollers();
new ResizeObserver(labelScrollers).observe(document.documentElement);

/* ---------- Token values ---------- */

function refreshTokenValues() {
  const probe = $('.doc-prose') ?? document.body;
  for (const cell of $$('[data-token-value]')) {
    const value = getComputedStyle(probe).getPropertyValue(cell.dataset.tokenValue).trim();
    cell.textContent = value.length > 48 ? `${value.slice(0, 46)}…` : value;
  }
}

/* ---------- Theming builder ---------- */

const preview = $('#tb-preview');
function refreshContrast() {
  const out = $('#tb-contrast');
  if (!out || !preview) return;
  const probe = document.createElement('span');
  probe.style.cssText = 'color: var(--kl-color-primary-fg); background-color: var(--kl-color-primary)';
  preview.append(probe);
  const cs = getComputedStyle(probe);
  const ratio = contrastRatio(cs.color, cs.backgroundColor);
  const page = getComputedStyle(preview).backgroundColor;
  const fill = contrastRatio(cs.backgroundColor, page);
  probe.remove();
  out.textContent = `Text on brand: ${ratio.toFixed(2)}:1 ${ratio >= 4.5 ? '(passes AA)' : '(below 4.5:1)'} · Brand fill on page: ${fill.toFixed(2)}:1 ${fill >= 3 ? '(passes)' : '(below 3:1)'}`;
}

function toRgb(color) {
  const canvas = toRgb.canvas ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 });
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  return [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3).map((v) => v / 255);
}

function contrastRatio(a, b) {
  const lum = (c) => {
    const [r, g, bl] = toRgb(c).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

if (preview) {
  const brand = $('#tb-brand');
  const radius = $('#tb-radius');
  const density = $('#tb-density');
  const css = $('#tb-css');
  const apply = () => {
    preview.style.setProperty('--kl-brand', brand.value);
    preview.style.setProperty('--kl-radius-base', `${radius.value}rem`);
    preview.style.setProperty('--kl-density', density.value);
    $('#tb-radius-out').textContent = `${radius.value}rem`;
    $('#tb-density-out').textContent = density.value;
    css.textContent = `:root {\n  --kl-brand: ${brand.value};\n  --kl-radius-base: ${radius.value}rem;\n  --kl-density: ${density.value};\n}`;
    requestAnimationFrame(refreshContrast);
  };
  for (const input of [brand, radius, density]) input.addEventListener('input', apply);
  apply();
}

/* ---------- Table of contents: highlight the section in view ---------- */

const tocLinks = $$('.doc-toc a');
if (tocLinks.length && 'IntersectionObserver' in window) {
  const byId = new Map(tocLinks.map((a) => [a.hash.slice(1), a]));
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        tocLinks.forEach((a) => a.removeAttribute('aria-current'));
        byId.get(entry.target.id)?.setAttribute('aria-current', 'true');
      }
    },
    { rootMargin: '0px 0px -70% 0px' },
  );
  for (const id of byId.keys()) {
    const heading = document.getElementById(id);
    if (heading) observer.observe(heading);
  }
}

/* ---------- Search ---------- */

const searchInput = $('#doc-search');
const results = $('#doc-search-results');
let index = null;

async function loadIndex() {
  index ??= fetch(`${base}search.json`).then((r) => r.json()).catch(() => []);
  return index;
}

function score(entry, words) {
  const hay = `${entry.title} ${entry.section} ${entry.text}`.toLowerCase();
  let total = 0;
  for (const word of words) {
    if (!hay.includes(word)) return 0;
    total += entry.title.toLowerCase().includes(word) ? 10 : 1;
  }
  return total;
}

async function search() {
  const words = searchInput.value.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) {
    if (results.matches(':popover-open')) results.hidePopover();
    return;
  }
  const entries = await loadIndex();
  const hits = entries
    .map((entry) => ({ entry, s: score(entry, words) }))
    .filter((h) => h.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 8);
  results.replaceChildren(
    ...(hits.length
      ? hits.map(({ entry }) => {
          const a = document.createElement('a');
          a.className = 'kl-menu__item';
          a.href = `${base}${entry.url}`;
          const title = document.createElement('span');
          title.textContent = entry.title;
          const section = document.createElement('small');
          section.textContent = entry.section;
          a.append(title, section);
          return a;
        })
      : [Object.assign(document.createElement('div'), { className: 'kl-menu__label', textContent: 'No results' })]),
  );
  if (!results.matches(':popover-open')) results.showPopover();
}

if (searchInput && results) {
  let timer = 0;
  searchInput.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(search, 120);
  });
  searchInput.addEventListener('focus', loadIndex);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && results.matches(':popover-open')) {
      e.preventDefault();
      $('a', results)?.focus();
    } else if (e.key === 'Enter') {
      const first = $('a', results);
      if (first) location.href = first.href;
    }
  });
  results.addEventListener('keydown', (e) => {
    const links = $$('a', results);
    const i = links.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') links[Math.min(i + 1, links.length - 1)]?.focus();
    else if (e.key === 'ArrowUp') (i <= 0 ? searchInput : links[i - 1]).focus();
    else return;
    e.preventDefault();
  });
  results.addEventListener('beforetoggle', (e) => {
    if (e.newState === 'open') requestAnimationFrame(() => kl.position(searchInput, results, { placement: 'bottom-start' }));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !e.target.closest('input, textarea, [contenteditable]')) {
      e.preventDefault();
      searchInput.focus();
    }
  });
}

syncControls();
