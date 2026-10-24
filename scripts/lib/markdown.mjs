// Minimal Markdown → HTML for our own docs (README-style GFM subset). No dependencies.
// Supports: headings (with ids), paragraphs, **bold**, *italic*, `code`, [links](url), images,
// fenced code (```lang), "```html live" fences (rendered as editable live examples by the caller),
// ul/ol lists (nested by indentation), GFM tables, blockquotes, horizontal rules, and raw HTML
// blocks (lines starting with "<" pass through untouched).

export const escape = (text) =>
  String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (text) =>
  String(text)
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .trim()
    .replace(/\s+/g, '-');

/* ---------- Syntax highlighting (small and safe: works on escaped text) ---------- */

export function highlight(code, lang = '') {
  const esc = escape(code);
  if (/^(html|xml|svelte|vue)$/.test(lang)) {
    return esc
      .replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="tok-comment">$1</span>')
      .replace(/(&lt;\/?)([a-zA-Z][\w-]*)([\s\S]*?)(\/?&gt;)/g, (_, open, tag, attrs, close) => {
        const a = attrs.replace(/([\w:@.-]+)(=)(&quot;[\s\S]*?&quot;)/g, '<span class="tok-attr">$1</span>$2<span class="tok-string">$3</span>').replace(/(\s)([\w:@.-]+)(?=\s|$)/g, '$1<span class="tok-attr">$2</span>');
        return `${open}<span class="tok-tag">${tag}</span>${a}${close}`;
      });
  }
  if (/^(js|javascript|ts|typescript|jsx|tsx|mjs)$/.test(lang)) {
    const KEYWORDS = /\b(import|from|export|const|let|var|function|return|await|async|if|else|for|of|new|class|extends|type|interface|true|false|null|undefined)\b/g;
    // Tokenise strings and comments first, so keywords inside them aren't coloured.
    const parts = [];
    let rest = esc;
    const re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/|&quot;(?:[^&]|&(?!quot;))*?&quot;|'(?:[^'\\\n]|\\.)*'|`[^`]*`)/;
    while (rest) {
      const m = re.exec(rest);
      if (!m) {
        parts.push(rest.replace(KEYWORDS, '<span class="tok-keyword">$1</span>'));
        break;
      }
      parts.push(rest.slice(0, m.index).replace(KEYWORDS, '<span class="tok-keyword">$1</span>'));
      parts.push(`<span class="${m[0].startsWith('/') ? 'tok-comment' : 'tok-string'}">${m[0]}</span>`);
      rest = rest.slice(m.index + m[0].length);
    }
    return parts.join('');
  }
  if (/^(css)$/.test(lang)) {
    return esc
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="tok-comment">$1</span>')
      .replace(/(--[\w-]+)/g, '<span class="tok-attr">$1</span>');
  }
  if (/^(sh|bash|shell)$/.test(lang)) return esc.replace(/(^|\n)(#[^\n]*)/g, '$1<span class="tok-comment">$2</span>');
  return esc;
}

/* ---------- Inline ---------- */

function inline(text) {
  const codes = [];
  let out = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(`<code>${escape(c)}</code>`);
    return `\u0000${codes.length - 1}\u0000`;
  });
  out = escape(out)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img src="$2" alt="$1">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => `<a href="${href}">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*\w])\*([^*\n]+)\*(?=[^*\w]|$)/g, '$1<em>$2</em>');
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[Number(i)]);
}

/* ---------- Blocks ---------- */

/**
 * @param {string} source
 * @param {{ liveExample?: (code: string, info: string) => string, rewriteLink?: (href: string) => string }} [hooks]
 * @returns {{ html: string, headings: { level: number, text: string, id: string }[], title: string }}
 */
export function markdown(source, hooks = {}) {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const headings = [];
  const used = new Map();
  let i = 0;

  const uniqueId = (text) => {
    const base = slugify(text) || 'section';
    const n = used.get(base) ?? 0;
    used.set(base, n + 1);
    return n ? `${base}-${n}` : base;
  };

  const isBlank = (l) => /^\s*$/.test(l);
  const listItem = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

  function parseList(start) {
    const items = [];
    const baseIndent = listItem.exec(lines[start])[1].length;
    const ordered = /\d/.test(listItem.exec(lines[start])[2]);
    let j = start;
    while (j < lines.length) {
      const m = listItem.exec(lines[j]);
      if (!m || m[1].length < baseIndent) break;
      if (m[1].length > baseIndent) break;
      const body = [m[3]];
      j++;
      const nested = [];
      while (j < lines.length && !isBlank(lines[j])) {
        const sub = listItem.exec(lines[j]);
        if (sub && sub[1].length > baseIndent) {
          const [html, next] = parseList(j);
          nested.push(html);
          j = next;
          continue;
        }
        if (sub) break;
        if (/^\s{2,}\S/.test(lines[j])) {
          body.push(lines[j].trim());
          j++;
          continue;
        }
        break;
      }
      // A blank line followed by an indented continuation keeps the item going.
      while (j + 1 < lines.length && isBlank(lines[j]) && /^\s{2,}\S/.test(lines[j + 1]) && !listItem.test(lines[j + 1])) {
        j++;
        if (/^\s{2,}```/.test(lines[j])) {
          const fence = [];
          const indent = lines[j].match(/^\s*/)[0].length;
          const lang = lines[j].trim().slice(3).trim();
          j++;
          while (j < lines.length && !/^\s*```\s*$/.test(lines[j])) fence.push(lines[j].slice(indent)), j++;
          j++;
          body.push(`\u0001<pre class="doc-code"><code class="lang-${escape(lang)}">${highlight(fence.join('\n'), lang)}</code></pre>`);
        } else {
          while (j < lines.length && /^\s{2,}\S/.test(lines[j])) body.push(lines[j].trim()), j++;
        }
      }
      const text = body.map((b) => (b.startsWith('\u0001') ? b.slice(1) : inline(b))).join(' ');
      items.push(`<li>${text}${nested.join('')}</li>`);
    }
    return [`<${ordered ? 'ol' : 'ul'}>${items.join('')}</${ordered ? 'ol' : 'ul'}>`, j];
  }

  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    // Fenced code
    const fence = /^```\s*([\w-]*)\s*(.*)$/.exec(line);
    if (fence) {
      const [, lang, info] = fence;
      const body = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++;
      const code = body.join('\n');
      if (info.includes('live') && hooks.liveExample) out.push(hooks.liveExample(code, `${lang} ${info}`.trim()));
      else out.push(`<pre class="doc-code"><code class="lang-${escape(lang)}">${highlight(code, lang)}</code></pre>`);
      continue;
    }

    // Headings
    const h = /^(#{1,4})\s+(.+?)\s*#*$/.exec(line);
    if (h) {
      const level = h[1].length;
      // "## Title {#custom-id}" sets the id explicitly
      const custom = /\s*\{#([\w-]+)\}$/.exec(h[2]);
      const text = custom ? h[2].slice(0, custom.index) : h[2];
      const id = custom ? custom[1] : uniqueId(text);
      if (custom) used.set(id, (used.get(id) ?? 0) + 1);
      headings.push({ level, text: text.replace(/`/g, ''), id });
      out.push(`<h${level} id="${id}">${inline(text)}${level > 1 ? ` <a class="doc-anchor" href="#${id}" aria-label="Link to this section">#</a>` : ''}</h${level}>`);
      i++;
      continue;
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,})\s*$/.test(line)) {
      out.push('<hr>');
      i++;
      continue;
    }

    // Raw HTML block
    if (/^\s*<[a-zA-Z!/]/.test(line)) {
      const block = [];
      while (i < lines.length && !isBlank(lines[i])) block.push(lines[i++]);
      out.push(block.join('\n'));
      continue;
    }

    // Table
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{3,}/.test(lines[i + 1])) {
      const cells = (l) => l.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => inline(c.trim().replace(/\\\|/g, '|')));
      const head = cells(line);
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && !isBlank(lines[i])) rows.push(cells(lines[i++]));
      out.push(
        `<div class="doc-table"><table class="kl-table" data-density="compact"><thead><tr>${head.map((c) => `<th>${c}</th>`).join('')}</tr></thead><tbody>${rows
          .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`)
          .join('')}</tbody></table></div>`,
      );
      continue;
    }

    // Blockquote
    if (/^>\s?/.test(line)) {
      const block = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) block.push(lines[i++].replace(/^>\s?/, ''));
      out.push(`<blockquote>${markdown(block.join('\n'), hooks).html}</blockquote>`);
      continue;
    }

    // List
    if (listItem.test(line)) {
      const [html, next] = parseList(i);
      out.push(html);
      i = next;
      continue;
    }

    // Paragraph
    const para = [];
    while (i < lines.length && !isBlank(lines[i]) && !/^(#{1,4}\s|```|>\s?|\s*<[a-zA-Z!/])/.test(lines[i]) && !listItem.test(lines[i])) para.push(lines[i++]);
    out.push(`<p>${inline(para.join(' '))}</p>`);
  }

  let html = out.join('\n');
  if (hooks.rewriteLink) html = html.replace(/href="([^"]+)"/g, (_, href) => `href="${hooks.rewriteLink(href)}"`);
  return { html, headings, title: headings.find((h) => h.level === 1)?.text ?? '' };
}
