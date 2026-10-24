// Builds custom-elements.json and the framework typings from the components themselves.
//
// Source of truth: each element's `static properties` (read by importing the modules in Node,
// which is safe without a DOM) for attributes, types and defaults; each *.meta.json for
// descriptions, events, slots and CSS tokens. `--check` fails if the two disagree.
//
// Writes: custom-elements.json, types/elements.d.ts, types/index.d.ts, types/react.d.ts,
// types/vue.d.ts, types/svelte.d.ts. Run after `tsc -p tsconfig.build.json` (npm run build:types).
import { readFile, writeFile, readdir, mkdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { join, relative } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const check = process.argv.includes('--check');
const problems = [];

/* ---------- 1. Load the code ---------- */

// Record every define(tag, Class) while importing (no real registry in Node).
const defined = new Map();
globalThis.customElements = { get: () => undefined, define: (tag, cls) => defined.set(tag, cls) };
await import(pathToFileURL(join(root, 'src/index.js')).href);
delete globalThis.customElements;

async function files(dir, ext) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await files(path, ext)));
    else if (entry.name.endsWith(ext)) out.push(path);
  }
  return out;
}

// Which file declares each class and defines each tag.
const classFile = new Map();
const tagInfo = new Map(); // tag → { className, file }
for (const file of await files(join(root, 'src'), '.js')) {
  const source = await readFile(file, 'utf8');
  for (const m of source.matchAll(/export class (\w+)/g)) classFile.set(m[1], relative(root, file));
  for (const m of source.matchAll(/define\('([a-z0-9-]+)',\s*(\w+)\)/g)) tagInfo.set(m[1], { className: m[2], file: relative(root, file) });
}

// Metadata, keyed by element tag (child elements come from a parent's "children").
const meta = new Map();
for (const file of await files(join(root, 'src/components'), '.meta.json')) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  if (data.element) meta.set(data.element, data);
  for (const child of data.children ?? []) if (child.element) meta.set(child.element, { ...child, description: child.description ?? `Child of <${data.element}>.`, parent: data.element });
}

/* ---------- 2. Properties from code ---------- */

const kebab = (name) => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
const codeType = (type) => ({ String: 'string', Number: 'number', Boolean: 'boolean', Array: 'unknown[]', Object: 'Record<string, unknown>' })[type?.name] ?? 'string';

/** Own declared properties of one class (not inherited). */
function ownProperties(cls) {
  if (!Object.hasOwn(cls, 'properties')) return [];
  return Object.entries(cls.properties).map(([name, opts]) => {
    const attribute = opts.attribute === false ? null : (opts.attribute ?? kebab(name));
    // Same rule as UIElement: booleans start false, everything else null, unless a default is given.
    const def = typeof opts.default === 'function' ? opts.default() : (opts.default ?? (opts.type === Boolean ? false : null));
    return { name, attribute, type: codeType(opts.type ?? String), reflects: Boolean(opts.reflect), data: Boolean(opts.data), default: def };
  });
}

/** The class chain from the element up to (not including) UIElement. */
function chain(cls) {
  const out = [];
  for (let c = cls; c && c.name && c.name !== 'UIElement'; c = Object.getPrototypeOf(c)) out.push(c);
  return out;
}

const VALID_TS = /^(\s*('[^']*'|string|number|boolean|null)\s*\|?)+$/;
const GLOBAL_ATTRS = new Set(['id', 'class', 'style', 'slot', 'hidden', 'lang', 'dir', 'title']);

/* ---------- 3. Build the manifest ---------- */

const modules = new Map();
const elements = [];

for (const [tag, cls] of [...defined].sort(([a], [b]) => a.localeCompare(b))) {
  const info = tagInfo.get(tag);
  if (!info) {
    problems.push(`<${tag}> is defined but its define('${tag}', …) call wasn't found in src/`);
    continue;
  }
  const m = meta.get(tag);
  if (!m) problems.push(`<${tag}> has no meta.json entry (add a component meta file, or a "children" entry in its parent's)`);
  const docAttrs = new Map((m?.attributes ?? []).map((a) => [a.name, a]));

  const props = chain(cls).flatMap((c) => ownProperties(c).map((p) => ({ ...p, owner: c.name })));
  const seen = new Set();
  const unique = props.filter((p) => (seen.has(p.name) ? false : seen.add(p.name)));

  for (const p of unique) {
    if (p.attribute && m && !docAttrs.has(p.attribute) && !['name', 'disabled', 'required'].includes(p.attribute)) {
      problems.push(`<${tag}> attribute "${p.attribute}" (${p.owner}.${p.name}) isn't documented in its meta.json`);
    }
  }
  for (const name of docAttrs.keys()) {
    if (name.startsWith('data-') || name.includes('/') || name.includes(' ') || GLOBAL_ATTRS.has(name)) continue;
    if (docAttrs.get(name).attributeOnly) continue; // read with getAttribute, not a reactive property
    if (!unique.some((p) => p.attribute === name)) problems.push(`<${tag}> meta.json documents "${name}", but the element has no such property`);
  }

  const tsType = (p) => {
    const doc = docAttrs.get(p.attribute);
    if (doc?.tsType) return doc.tsType;
    if (doc?.type && VALID_TS.test(doc.type)) return doc.type;
    return p.type;
  };

  const element = {
    tag,
    className: info.className,
    file: info.file,
    description: m?.description ?? '',
    props: unique.map((p) => ({ ...p, tsType: tsType(p), description: docAttrs.get(p.attribute)?.description ?? '' })),
    events: (m?.events ?? []).filter((e) => !e.native).map((e) => ({ name: e.name, description: e.description ?? '', detailType: e.detailType ?? 'unknown' })),
    slots: (m?.slots ?? []).map((s) => ({ name: s.name, description: s.description ?? '' })),
    cssProperties: (m?.tokens ?? []).filter((t) => !t.includes('*')).map((name) => ({ name })),
    superclass: Object.getPrototypeOf(cls).name,
  };
  elements.push(element);

  const mod = modules.get(info.file) ?? { kind: 'javascript-module', path: info.file, declarations: [], exports: [] };
  mod.declarations.push({
    kind: 'class',
    name: info.className,
    tagName: tag,
    customElement: true,
    description: element.description,
    superclass: { name: element.superclass, module: classFile.get(element.superclass) ?? 'src/core/element.js' },
    attributes: element.props.filter((p) => p.attribute).map((p) => ({
      name: p.attribute,
      fieldName: p.name,
      type: { text: p.tsType },
      ...(p.default !== null ? { default: JSON.stringify(p.default) } : {}),
      ...(p.description ? { description: p.description } : {}),
    })),
    members: element.props.map((p) => ({
      kind: 'field',
      name: p.name,
      type: { text: p.tsType },
      ...(p.attribute ? { attribute: p.attribute } : {}),
      ...(p.reflects ? { reflects: true } : {}),
      ...(p.default !== null ? { default: JSON.stringify(p.default) } : {}),
      ...(p.description ? { description: p.description } : {}),
    })),
    events: element.events.map((e) => ({ name: e.name, type: { text: `CustomEvent<${e.detailType}>` }, ...(e.description ? { description: e.description } : {}) })),
    slots: element.slots,
    cssProperties: element.cssProperties,
  });
  mod.exports.push({ kind: 'js', name: info.className, declaration: { name: info.className, module: info.file } });
  mod.exports.push({ kind: 'custom-element-definition', name: tag, declaration: { name: info.className, module: info.file } });
  modules.set(info.file, mod);
}

const manifest = { schemaVersion: '2.1.0', readme: 'README.md', modules: [...modules.values()] };

/* ---------- 4. Typings ---------- */

const header = '// Generated by scripts/build-manifest.mjs. Do not edit.\n';
const dts = (file) => `./${file.replace(/\.js$/, '.js')}`; // types/src/... mirrors src/...
const pascal = (tag) => tag.replace(/(^|-)(\w)/g, (_, __, c) => c.toUpperCase());
const propsName = (e) => `${pascal(e.tag)}Props`;
const eventsName = (e) => `${pascal(e.tag)}Events`;
const quote = (s) => (/^[A-Za-z_$][\w$]*$/.test(s) ? s : `'${s}'`);

// Augment each class (including shared bases) with its reactive properties.
const augments = new Map(); // module → Map(className → props)
for (const e of elements) {
  for (const p of e.props) {
    const file = classFile.get(p.owner);
    if (!file) continue;
    if (!augments.has(file)) augments.set(file, new Map());
    const classes = augments.get(file);
    if (!classes.has(p.owner)) classes.set(p.owner, new Map());
    classes.get(p.owner).set(p.name, p);
  }
}

// Properties HTMLElement already declares: our types must stay compatible (no null).
const NATIVE = new Set(['inputMode', 'title', 'lang', 'dir', 'hidden', 'tabIndex', 'translate', 'draggable', 'spellcheck', 'autocapitalize', 'enterKeyHint', 'popover', 'accessKey']);
const nullable = (p) => (p.default === null && !NATIVE.has(p.name) ? ' | null' : '');

const doc = (text, indent = '  ') => (text ? `${indent}/** ${text.replace(/\*\//g, '* /')} */\n` : '');

let elementsDts = `${header}
/** A transaction for <kl-transaction-list>. */
export interface TransactionItem {
  id?: string | number;
  title: string;
  /** Decimal string ("-45000.50") or number; the sign gives the direction unless \`direction\` is set. */
  amount: string | number;
  currency?: string;
  direction?: 'credit' | 'debit';
  date?: string | Date;
  meta?: string;
  status?: 'completed' | 'pending' | 'failed';
  /** Initials, or an image URL. */
  icon?: string;
  href?: string;
}
`;
for (const [file, classes] of augments) {
  elementsDts += `\ndeclare module '${dts(file)}' {\n`;
  for (const [cls, props] of classes) {
    elementsDts += `  interface ${cls} {\n`;
    for (const p of props.values()) elementsDts += doc(p.description, '    ') + `    ${quote(p.name)}: ${p.tsType}${nullable(p)};\n`;
    elementsDts += '  }\n';
  }
  elementsDts += '}\n';
}

for (const e of elements) {
  elementsDts += `\nimport type { ${e.className} } from '${dts(e.file)}';\n`;
  elementsDts += `/** Props for <${e.tag}> (property names; kebab-case attribute names also accepted). */\nexport interface ${propsName(e)} {\n`;
  for (const p of e.props) {
    elementsDts += doc(p.description) + `  ${quote(p.name)}?: ${p.tsType}${nullable(p)};\n`;
    if (p.attribute && p.attribute !== p.name) elementsDts += `  ${quote(p.attribute)}?: ${p.tsType} | string;\n`;
  }
  elementsDts += `}\nexport interface ${eventsName(e)} {\n`;
  for (const ev of e.events) elementsDts += doc(ev.description) + `  ${quote(ev.name)}: CustomEvent<${ev.detailType}>;\n`;
  elementsDts += '}\n';
}

const eventUnion = new Map();
for (const e of elements) for (const ev of e.events) eventUnion.set(ev.name, [...(eventUnion.get(ev.name) ?? []), ev.detailType]);

elementsDts += `
/** Props for every Klesora UI element, by tag. */
export interface KlElementProps {
${elements.map((e) => `  '${e.tag}': ${propsName(e)};`).join('\n')}
}

/** Library events for every Klesora UI element, by tag. */
export interface KlElementEvents {
${elements.map((e) => `  '${e.tag}': ${eventsName(e)};`).join('\n')}
}

declare global {
  interface HTMLElementTagNameMap {
${elements.map((e) => `    '${e.tag}': ${e.className};`).join('\n')}
  }
  interface HTMLElementEventMap {
${[...eventUnion].map(([name, types]) => `    '${name}': CustomEvent<${[...new Set(types)].join(' | ')}>;`).join('\n')}
  }
}
`;

const indexDts = `${header}import './elements.js';
export * from './src/index.js';
export type * from './elements.js';
`;

const reactDts = `${header}// React 19 sets these as properties and listens to kl-* events with on<event-name>, e.g.
// <kl-tabs onkl-change={(e) => …}>. Include with: import type {} from 'klesora-ui/types/react';
import type * as React from 'react';
import type { KlElementProps, KlElementEvents } from './elements.js';

type KlEventProps<E> = { [K in keyof E as \`on\${K & string}\`]?: (event: E[K]) => void };
type KlReactProps<T extends keyof KlElementProps> = Omit<React.HTMLAttributes<HTMLElementTagNameMap[T]>, keyof KlElementProps[T]> &
  KlElementProps[T] &
  KlEventProps<KlElementEvents[T]> & {
    ref?: React.Ref<HTMLElementTagNameMap[T]>;
    class?: string;
    key?: React.Key;
    [attribute: \`data-\${string}\`]: string | number | boolean | undefined;
  };

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
${elements.map((e) => `      '${e.tag}': KlReactProps<'${e.tag}'>;`).join('\n')}
    }
  }
}
`;

const vueDts = `${header}// Template type-checking (Volar / vue-tsc). Include with: import type {} from 'klesora-ui/types/vue';
// Tell Vue they're custom elements: compilerOptions.isCustomElement = (tag) => tag.startsWith('kl-').
import type { DefineComponent } from 'vue';
import type { KlElementProps } from './elements.js';

declare module 'vue' {
  interface GlobalComponents {
${elements.map((e) => `    '${e.tag}': DefineComponent<KlElementProps['${e.tag}']>;`).join('\n')}
  }
}
`;

const svelteDts = `${header}// Svelte 5 template typing. Include with: import type {} from 'klesora-ui/types/svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { KlElementProps, KlElementEvents } from './elements.js';

type KlEventProps<E> = { [K in keyof E as \`on\${K & string}\`]?: (event: E[K]) => void };
type KlSvelteProps<T extends keyof KlElementProps> = Omit<HTMLAttributes<HTMLElementTagNameMap[T]>, keyof KlElementProps[T]> &
  KlElementProps[T] &
  KlEventProps<KlElementEvents[T]>;

declare module 'svelte/elements' {
  interface SvelteHTMLElements {
${elements.map((e) => `    '${e.tag}': KlSvelteProps<'${e.tag}'>;`).join('\n')}
  }
}
`;

/* ---------- 5. Write or check ---------- */

if (problems.length) {
  console.error(`Manifest problems:\n${problems.map((p) => `  ✗ ${p}`).join('\n')}`);
  process.exit(1);
}

const outputs = {
  'custom-elements.json': `${JSON.stringify(manifest, null, 2)}\n`,
  'types/elements.d.ts': elementsDts,
  'types/index.d.ts': indexDts,
  'types/react.d.ts': reactDts,
  'types/vue.d.ts': vueDts,
  'types/svelte.d.ts': svelteDts,
};

// TypeScript infers `value: any` from assignments like `this.value = …` in the JS. Remove those
// inferred declarations for reactive properties so the generated (accurate) types apply.
async function stripInferred() {
  for (const [file, classes] of augments) {
    const path = join(root, 'types', file.replace(/\.js$/, '.d.ts'));
    let text = await readFile(path, 'utf8').catch(() => null);
    if (text === null) continue;
    for (const [cls, props] of classes) {
      const start = text.indexOf(`class ${cls} `);
      if (start < 0) continue;
      const end = text.indexOf('\n}', start);
      let body = text.slice(start, end);
      for (const name of props.keys()) body = body.replace(new RegExp(`\\n    ${name}\\??: [^;\\n]+;`, 'g'), '');
      text = text.slice(0, start) + body + text.slice(end);
    }
    if (!check) await writeFile(path, text);
  }
}
await stripInferred();

if (check) {
  const stale = [];
  for (const [file, content] of Object.entries(outputs)) {
    const current = await readFile(join(root, file), 'utf8').catch(() => null);
    if (current !== content) stale.push(file);
  }
  if (stale.length) {
    console.error(`Out of date (run npm run build:types): ${stale.join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ manifest and typings are up to date (${elements.length} elements)`);
} else {
  await mkdir(join(root, 'types'), { recursive: true });
  for (const [file, content] of Object.entries(outputs)) await writeFile(join(root, file), content);
  console.log(`Wrote custom-elements.json and types/ for ${elements.length} elements: ${elements.map((e) => e.tag).join(', ')}`);
}
