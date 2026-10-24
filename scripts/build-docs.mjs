// Builds the docs site into site/ from:
//   src/components/*/*.meta.json + custom-elements.json  → one page per component
//   docs/pages/*.md, FRAMEWORKS.md, SECURITY.md           → guide pages
//   docs/assets/*                                         → site assets
//   src/                                                  → site/lib/ (the library the site runs on)
// Every page is static HTML built with Klesora UI itself. Links are relative, so the site works
// at any path (/site/ locally, / on Vercel). Fails if any internal link is broken.
//
//   node scripts/build-docs.mjs            build once
//   node scripts/build-docs.mjs --watch    rebuild on changes and serve at http://localhost:5173/site/
import { readFile, writeFile, mkdir, rm, cp, readdir, stat } from 'node:fs/promises';
import { watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname, relative, resolve } from 'node:path';
import { markdown, escape, highlight, slugify } from './lib/markdown.mjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'site');
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const REPO = pkg.repository?.url?.replace(/^git\+/, '').replace(/\.git$/, '') ?? '';

const GROUPS = [
  ['Form controls', ['button', 'input', 'amount-input', 'otp-input', 'select', 'checkbox', 'switch', 'field']],
  ['Overlays and feedback', ['menu', 'tooltip', 'dialog', 'toast']],
  ['Layout and data', ['card', 'tabs', 'table', 'navbar', 'sidebar', 'transaction-list', 'stepper']],
];

async function listFiles(dir, ext) {
  const found = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(path, ext)));
    else if (entry.name.endsWith(ext)) found.push(path);
  }
  return found;
}

function frontMatter(source) {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(source);
  if (!m) return { meta: {}, body: source };
  const meta = Object.fromEntries(m[1].split('\n').map((l) => l.split(/:\s*(.*)/s)).filter(([k]) => k).map(([k, v]) => [k.trim(), v.trim()]));
  return { meta, body: source.slice(m[0].length) };
}

/* ---------- Example widgets ---------- */

let exampleId = 0;
function htmlExample(code, { title = '', compare = false } = {}) {
  const id = `ex-${++exampleId}`;
  return `<figure class="doc-example" data-lang="html"${compare ? ' data-compare-default' : ''}>
${title ? `<figcaption class="doc-example__title">${escape(title)}</figcaption>` : ''}
<div class="doc-example__preview">${code}</div>
<div class="doc-example__bar">
  <span class="doc-example__lang">HTML · editable</span>
  <button type="button" class="kl-btn" data-variant="ghost" data-size="sm" data-action="compare" aria-pressed="${compare}">Compare styles</button>
  <button type="button" class="kl-btn" data-variant="ghost" data-size="sm" data-action="reset">Reset</button>
  <button type="button" class="kl-btn" data-variant="outline" data-size="sm" data-action="copy">Copy</button>
</div>
<textarea class="doc-example__code" id="${id}" spellcheck="false" autocapitalize="off" aria-label="${escape(title || 'Example')} code (edit to update the preview)">${escape(code)}</textarea>
</figure>`;
}

function jsExample(code, { title = '' } = {}) {
  const id = `ex-${++exampleId}`;
  return `<figure class="doc-example" data-lang="js">
${title ? `<figcaption class="doc-example__title">${escape(title)}</figcaption>` : ''}
<div class="doc-example__bar">
  <span class="doc-example__lang">JavaScript · editable</span>
  <button type="button" class="kl-btn" data-variant="ghost" data-size="sm" data-action="reset">Reset</button>
  <button type="button" class="kl-btn" data-variant="outline" data-size="sm" data-action="copy">Copy</button>
  <button type="button" class="kl-btn" data-size="sm" data-action="run">Run</button>
</div>
<textarea class="doc-example__code" id="${id}" spellcheck="false" autocapitalize="off" aria-label="${escape(title || 'Example')} code">${escape(code)}</textarea>
<p class="doc-example__status" role="status"></p>
</figure>`;
}

const liveExample = (code, info) => (/^(js|javascript)\b/.test(info) ? jsExample(code) : htmlExample(code, { compare: /\bcompare\b/.test(info) }));

/* ---------- Layout ---------- */

function layout({ path, title, description, body, toc = [], nav }) {
  const depth = path === '' ? 0 : path.split('/').filter(Boolean).length;
  const base = depth ? '../'.repeat(depth) : './';
  const link = (target) => `${base}${target}`;
  const current = (target) => (target === path ? ' aria-current="page"' : '');
  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  const sidebar = `<nav class="kl-sidebar" id="doc-sidebar" data-kl-sidebar aria-label="Documentation">
  <div class="kl-sidebar__header"><a class="kl-sidebar__link" href="${link('')}"${current('')}>${icon('<path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"/>')}<span class="kl-sidebar__text"><strong>Klesora UI</strong></span></a></div>
  <ul class="kl-sidebar__section">
    <li class="kl-sidebar__label">Guides</li>
    ${nav.guides.map((g) => `<li><a class="kl-sidebar__link" href="${link(g.path)}"${current(g.path)}><span class="kl-sidebar__text">${escape(g.title)}</span></a></li>`).join('\n    ')}
  </ul>
  ${nav.groups
    .map(
      ([label, items]) => `<ul class="kl-sidebar__section">
    <li class="kl-sidebar__label">${escape(label)}</li>
    ${items.map((c) => `<li><a class="kl-sidebar__link" href="${link(c.path)}"${current(c.path)}><span class="kl-sidebar__text">${escape(c.title)}</span></a></li>`).join('\n    ')}
  </ul>`,
    )
    .join('\n  ')}
</nav>`;

  const tocHtml = toc.length
    ? `<aside class="doc-toc" aria-label="On this page"><strong>On this page</strong>${toc.map((h) => `<a href="#${h.id}">${escape(h.text)}</a>`).join('')}</aside>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<script>${nav.themeInitScript}</script>
<title>${escape(title)} · Klesora UI</title>
<meta name="description" content="${escape(description ?? '')}">
<link rel="stylesheet" href="${link('lib/klesora-ui.css')}">
<link rel="stylesheet" href="${link('assets/site.css')}">
<script type="module" src="${link('lib/index.js')}"></script>
<script>window.KL_BASE = ${JSON.stringify(base)};</script>
<script type="module" src="${link('assets/site.js')}"></script>
</head>
<body>
<a class="kl-sr-only-focusable kl-btn" href="#main" style="position: fixed; z-index: var(--kl-z-tooltip); inset: var(--kl-space-2) auto auto var(--kl-space-2)">Skip to content</a>
<div class="kl-app">
${sidebar}
<header class="kl-navbar" data-sticky>
  <button class="kl-btn kl-navbar__toggle kl-sidebar__open" data-variant="ghost" data-icon popovertarget="doc-sidebar" aria-label="Open navigation"></button>
  <div class="doc-search" role="search">
    <input class="kl-input" type="search" id="doc-search" placeholder="Search docs  /" aria-label="Search the docs" autocomplete="off">
    <div class="kl-menu doc-search__results" id="doc-search-results" popover="auto" aria-label="Search results"></div>
  </div>
  <div class="kl-navbar__actions doc-navbar-controls">
    <select class="kl-select" id="doc-style" aria-label="Style"><option value="mono">Mono</option><option value="solo">Solo</option><option value="chorus">Chorus</option></select>
    <select class="kl-select doc-hide-phone" id="doc-theme" aria-label="Theme"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></select>
    <input type="color" id="doc-brand" class="doc-hide-phone" value="#0a7cff" aria-label="Brand colour" data-kl-tooltip="Brand colour">
    <button type="button" class="kl-btn doc-hide-phone" id="doc-brand-reset" data-variant="ghost" data-size="sm" hidden>Reset brand</button>
    ${REPO ? `<a class="kl-btn doc-hide-phone" data-variant="ghost" data-size="sm" href="${REPO}">GitHub</a>` : ''}
  </div>
</header>
<main class="kl-app__main doc-main" id="main">
<article class="doc-prose">
${body}
</article>
${tocHtml}
</main>
</div>
</body>
</html>
`;
}

/* ---------- Component pages ---------- */

function table(head, rows) {
  if (!rows.length) return '';
  return `<div class="doc-table"><table class="kl-table" data-density="compact"><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows
    .map((r) => `<tr>${r.map((c) => `<td>${c ?? ''}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

const code = (text) => (text === undefined || text === null || text === '' ? '' : `<code>${escape(text)}</code>`);
const md = (text) => (text ? markdown(String(text)).html.replace(/^<p>|<\/p>$/g, '') : '');

function componentPage(meta, manifestByTag, hasJs, hasCss) {
  const body = [];
  const toc = [];
  const h2 = (text) => {
    const id = slugify(text);
    toc.push({ id, text });
    return `<h2 id="${id}">${escape(text)} <a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a></h2>`;
  };

  body.push(`<h1 id="top">${escape(meta.title)}</h1>`);
  body.push(`<p class="doc-lede">${md(meta.description)}</p>`);
  const chips = [];
  if (meta.element) chips.push(`<span class="doc-chip">Element ${code(`<${meta.element}>`)}</span>`);
  if (meta.class) chips.push(`<span class="doc-chip">Class ${code(`.${meta.class}`)}</span>`);
  if (meta.directive) chips.push(`<span class="doc-chip">Directive ${code(meta.directive)}</span>`);
  if (meta.service) chips.push(`<span class="doc-chip">Service ${code(meta.service)}</span>`);
  body.push(`<div class="doc-chips">${chips.join('')}</div>`);

  const imports = [];
  if (hasJs) imports.push(`import 'klesora-ui/components/${meta.name}';`);
  if (meta.directive) imports.push(`import 'klesora-ui/directives/${meta.directive.replace(/^data-kl-/, '').split(/[ ,]/)[0]}';`);
  if (meta.service) imports.push(`import { ${meta.service} } from 'klesora-ui/services/${meta.service === 'dialog' ? 'dialog' : meta.service}';`);
  if (hasCss) imports.push(`// CSS: included in klesora-ui/css, or alone: klesora-ui/components/${meta.name}.css`);
  if (imports.length) body.push(`<pre class="doc-code"><code class="lang-js">${highlight(imports.join('\n'), 'js')}</code></pre>`);

  if (meta.examples?.length) {
    body.push(h2('Examples'));
    for (const ex of meta.examples) {
      if (ex.html) body.push(htmlExample(ex.html, { title: ex.title }));
      else if (ex.js) body.push(jsExample(ex.js, { title: ex.title }));
    }
  }

  const element = meta.element ? manifestByTag.get(meta.element) : null;
  if (element) {
    body.push(h2('Attributes and properties'));
    const docs = new Map((meta.attributes ?? []).map((a) => [a.name, a]));
    body.push(
      table(
        ['Attribute', 'Property', 'Type', 'Default', 'Description'],
        (element.members ?? []).map((m) => [
          code(m.attribute),
          code(m.name),
          code(m.type?.text),
          code(m.default),
          md(m.description || docs.get(m.attribute)?.description || ''),
        ]),
      ),
    );
    const extra = (meta.attributes ?? []).filter((a) => a.name.startsWith('data-') || a.attributeOnly);
    if (extra.length) body.push(table(['Also', 'Type', 'Description'], extra.map((a) => [code(a.name), code(a.type), md(a.description)])));
  } else if (meta.attributes?.length) {
    body.push(h2('Attributes'));
    body.push(table(['Attribute', 'Type', 'Default', 'Description'], meta.attributes.map((a) => [code(a.name), code(a.tsType ?? a.type), code(a.default), md(a.description)])));
  }

  for (const child of meta.children ?? []) {
    body.push(h2(`<${child.element}>`));
    body.push(table(['Attribute', 'Type', 'Description'], (child.attributes ?? []).map((a) => [code(a.name), code(a.tsType ?? a.type), md(a.description)])));
  }

  if (meta.properties?.length) {
    body.push(h2('More properties'));
    body.push(table(['Property', 'Type', 'Description'], meta.properties.map((p) => [code(p.name), code(p.type), md(p.description)])));
  }
  if (meta.options?.length) {
    body.push(h2('Options'));
    body.push(table(['Option', 'Type', 'Default', 'Description'], meta.options.map((o) => [code(o.name), code(o.type), code(o.default), md(o.description)])));
  }
  if (meta.api?.length) {
    body.push(h2('API'));
    body.push(`<ul>${meta.api.map((a) => `<li>${code(a)}</li>`).join('')}</ul>`);
  }
  if (meta.methods?.length) {
    body.push(h2('Methods'));
    body.push(`<ul>${meta.methods.map((m) => `<li>${code(m)}</li>`).join('')}</ul>`);
  }
  if (meta.events?.length) {
    body.push(h2('Events'));
    body.push(
      table(
        ['Event', 'Detail', 'Notes'],
        meta.events.map((e) => [code(e.name), code(e.detailType ?? e.detail ?? ''), e.native ? 'Native event' : [e.cancelable ? 'Cancelable. ' : '', md(e.description)].join('')]),
      ),
    );
  }
  if (meta.slots?.length) {
    body.push(h2('Slots'));
    body.push(table(['Slot', 'Description'], meta.slots.map((s) => [code(s.name), md(s.description)])));
  }
  if (meta.parts?.length) {
    body.push(h2('Parts'));
    body.push(`<ul>${meta.parts.map((p) => `<li>${code(p)}</li>`).join('')}</ul>`);
  }
  const tokens = (meta.tokens ?? []).filter((t) => !t.includes('*'));
  if (tokens.length) {
    body.push(h2('CSS tokens'));
    body.push(`<p>Set these in your CSS to restyle this component everywhere. Values shown are live for the current style and theme.</p>`);
    body.push(table(['Token', 'Current value'], tokens.map((t) => [code(t), `<span class="doc-token-value" data-token-value="${escape(t)}"></span>`])));
  }
  if (meta.notes?.length) {
    body.push(h2('Notes'));
    body.push(`<ul>${meta.notes.map((n) => `<li>${md(n)}</li>`).join('')}</ul>`);
  }
  return { body: body.join('\n'), toc };
}

/* ---------- Semantic token table (theming guide) ---------- */

async function tokenTable() {
  const css = await readFile(join(root, 'src/tokens/base.css'), 'utf8');
  const block = css.slice(css.indexOf(':where(:root, [data-kl-theme]'));
  const names = [...new Set([...block.matchAll(/^\s*(--kl-color-[\w-]+):/gm)].map((m) => m[1]))];
  return table(
    ['Token', 'Swatch', 'Current value'],
    names.map((n) => [code(n), `<span class="doc-swatch" style="background: var(${n})"></span>`, `<span class="doc-token-value" data-token-value="${n}"></span>`]),
  );
}

/* ---------- Home ---------- */

function homePage() {
  const sample = `<div class="kl-stack" data-gap="3">
  <kl-field><label>Amount</label><kl-amount-input value="45000"></kl-amount-input></kl-field>
  <div class="kl-cluster"><kl-checkbox checked>Save beneficiary</kl-checkbox></div>
  <div class="kl-cluster"><kl-button>Send money</kl-button><kl-button variant="outline">Cancel</kl-button></div>
</div>`;
  const features = [
    ['Three styles, one API', 'Solo (Apple-inspired), Mono (shadcn-inspired) and Chorus (Material-inspired). Switch at runtime with one attribute.'],
    ['Any framework', 'Plain CSS and light-DOM custom elements: HTML, React, Vue, Angular and Svelte, with types for each.'],
    ['Built for money', 'Exact amounts (never floats), ₦/$ locale formatting, OTP and PIN input, transaction lists and steppers.'],
    ['Accessible by default', 'WAI-ARIA keyboard patterns, labelled forms, and contrast checked in every style, in light and dark.'],
    ['Zero dependencies', 'Nothing at runtime. Import the whole library, or one component at a time.'],
    ['Secure storage', 'AES-GCM encrypted storage via Web Crypto, with an honest note on what it protects.'],
  ];
  return `<section class="doc-hero">
  <h1>Klesora UI</h1>
  <p>A zero-dependency UI library in plain HTML, CSS and JavaScript, with three switchable styles. Made for fintech, and fine for everything else.</p>
  <div class="kl-cluster"><a class="kl-btn" data-size="lg" href="guides/getting-started/">Get started</a><a class="kl-btn" data-variant="outline" data-size="lg" href="components/button/">Browse components</a></div>
  <pre class="doc-code"><code class="lang-sh">npm install klesora-ui</code></pre>
</section>
<h2 id="one-markup-three-styles">One markup, three styles <a class="doc-anchor" href="#one-markup-three-styles" aria-label="Link to this section">#</a></h2>
<p>Edit the HTML and all three update. The header switchers change the theme and brand for the whole site.</p>
${htmlExample(sample, { compare: true, title: 'Transfer form' })}
<h2 id="why-klesora-ui">Why Klesora UI <a class="doc-anchor" href="#why-klesora-ui" aria-label="Link to this section">#</a></h2>
<div class="doc-features">
${features.map(([t, d]) => `<article class="kl-card"><div class="kl-card__header"><h3 class="kl-card__title">${escape(t)}</h3></div><div class="kl-card__content"><p>${escape(d)}</p></div></article>`).join('\n')}
</div>`;
}

/* ---------- Build ---------- */

export async function build() {
  exampleId = 0;
  const started = Date.now();
  await rm(out, { recursive: true, force: true });
  await mkdir(out, { recursive: true });
  await cp(join(root, 'src'), join(out, 'lib'), { recursive: true });
  await cp(join(root, 'docs/assets'), join(out, 'assets'), { recursive: true });

  const { themeInitScript } = await import(`${join(root, 'src/services/theme.js')}?${Date.now()}`);
  const manifest = JSON.parse(await readFile(join(root, 'custom-elements.json'), 'utf8'));
  const manifestByTag = new Map(manifest.modules.flatMap((m) => m.declarations).filter((d) => d.tagName).map((d) => [d.tagName, d]));

  // Components
  const metas = new Map();
  for (const file of await listFiles(join(root, 'src/components'), '.meta.json')) {
    const meta = JSON.parse(await readFile(file, 'utf8'));
    const dir = dirname(file);
    const exists = async (p) => Boolean(await stat(p).catch(() => null));
    metas.set(meta.name, { meta, hasJs: await exists(join(dir, `${meta.name}.js`)), hasCss: await exists(join(dir, `${meta.name}.css`)) });
  }
  const grouped = new Set(GROUPS.flatMap(([, names]) => names));
  const ungrouped = [...metas.keys()].filter((n) => !grouped.has(n));
  const groups = [...GROUPS, ...(ungrouped.length ? [['More', ungrouped]] : [])].map(([label, names]) => [
    label,
    names.filter((n) => metas.has(n)).map((n) => ({ path: `components/${n}/`, title: metas.get(n).meta.title })),
  ]);

  // Guides
  const guideSources = [];
  for (const file of await listFiles(join(root, 'docs/pages'), '.md')) {
    const { meta, body } = frontMatter(await readFile(file, 'utf8'));
    guideSources.push({ slug: file.split('/').pop().replace(/\.md$/, ''), meta, body });
  }
  for (const [slug, file, title, description, order] of [
    ['frameworks', 'FRAMEWORKS.md', 'Frameworks', 'React, Vue, Angular, Svelte and server rendering.', 7],
    ['security', 'SECURITY.md', 'Security', 'What client-side encryption does and does not protect.', 8],
  ]) {
    guideSources.push({ slug, meta: { title, description, order: String(order) }, body: await readFile(join(root, file), 'utf8') });
  }
  guideSources.sort((a, b) => Number(a.meta.order ?? 99) - Number(b.meta.order ?? 99));
  const guides = guideSources.map((g) => ({ path: `guides/${g.slug}/`, title: g.meta.title }));

  const nav = { guides, groups, themeInitScript };
  const search = [];
  const pages = [];
  const write = async (path, html) => {
    await mkdir(join(out, path), { recursive: true });
    await writeFile(join(out, path, 'index.html'), html);
    pages.push(path);
  };

  const rewriteLink = (href) => {
    if (/^(https?:|mailto:|#)/.test(href)) return href;
    const map = { 'SECURITY.md': '../security/', 'FRAMEWORKS.md': '../frameworks/', 'README.md': '../../', './SECURITY.md': '../security/', './FRAMEWORKS.md': '../frameworks/' };
    if (map[href]) return map[href];
    if (/CONVENTIONS\.md/.test(href) && REPO) return `${REPO}/blob/main/CONVENTIONS.md${href.split('CONVENTIONS.md')[1] ?? ''}`;
    return href;
  };

  const tokens = await tokenTable();
  for (const g of guideSources) {
    const path = `guides/${g.slug}/`;
    const { html, headings } = markdown(g.body, { liveExample, rewriteLink });
    const body = (g.meta.description ? html.replace(/<\/h1>/, `</h1>\n<p class="doc-lede">${escape(g.meta.description)}</p>`) : html).replace('<!-- token-table -->', tokens);
    await write(path, layout({ path, title: g.meta.title, description: g.meta.description, body, toc: headings.filter((h) => h.level === 2), nav }));
    search.push({ title: g.meta.title, section: 'Guide', url: path, text: [g.meta.description, ...headings.map((h) => h.text)].join(' ') });
  }

  for (const { meta, hasJs, hasCss } of metas.values()) {
    const path = `components/${meta.name}/`;
    const { body, toc } = componentPage(meta, manifestByTag, hasJs, hasCss);
    await write(path, layout({ path, title: meta.title, description: meta.description, body, toc, nav }));
    search.push({
      title: meta.title,
      section: 'Component',
      url: path,
      text: [meta.description, meta.element, meta.class, meta.directive, meta.service, ...(meta.attributes ?? []).map((a) => a.name), ...(meta.events ?? []).map((e) => e.name)].filter(Boolean).join(' '),
    });
  }

  await write('', layout({ path: '', title: 'Klesora UI', description: pkg.description, body: homePage(), nav }));
  await writeFile(join(out, 'search.json'), JSON.stringify(search));
  await writeFile(
    join(out, '404.html'),
    layout({ path: '', title: 'Not found', description: '', body: '<h1>Page not found</h1><p>Try the search box, or start from the <a href="/">home page</a>.</p>', nav }),
  );

  // Link check: every relative href/src in the generated pages must exist.
  const broken = [];
  for (const page of pages) {
    const html = await readFile(join(out, page, 'index.html'), 'utf8');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|data:|#|javascript:)/.test(url)) continue;
      const clean = url.split('#')[0].split('?')[0];
      if (!clean) continue;
      const target = resolve(join(out, page), clean);
      const ok = await stat(target).then((s) => (s.isDirectory() ? stat(join(target, 'index.html')) : s)).catch(() => null);
      if (!ok) broken.push(`${page || '(home)'} → ${url}`);
    }
  }
  if (broken.length) throw new Error(`Broken links:\n  ${[...new Set(broken)].join('\n  ')}`);
  console.log(`Docs: ${pages.length} pages in ${relative(root, out)}/ (${Date.now() - started}ms)`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await build();
  } catch (error) {
    console.error(error.message);
    if (!process.argv.includes('--watch')) process.exit(1);
  }
  if (process.argv.includes('--watch')) {
    let timer = 0;
    const rebuild = () => {
      clearTimeout(timer);
      timer = setTimeout(() => build().catch((e) => console.error(e.message)), 150);
    };
    for (const target of ['src', 'docs', 'FRAMEWORKS.md', 'SECURITY.md', 'custom-elements.json']) {
      watch(join(root, target), { recursive: true }, rebuild);
    }
    spawn(process.execPath, [join(root, 'scripts/serve.mjs')], { stdio: 'inherit' });
    console.log('Watching for changes. Docs at http://localhost:5173/site/');
  }
}
