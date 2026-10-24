/**
 * <kl-transaction-list>: renders a grouped, formatted transaction list from data.
 *
 *   const list = document.querySelector('kl-transaction-list');
 *   list.items = [
 *     { id: 't1', title: 'Ada Obi', amount: '-45000', date: '2026-10-20T14:05', meta: 'Transfer' },
 *     { id: 't2', title: 'Salary', amount: '850000', date: '2026-10-01', status: 'completed' },
 *   ];
 *
 * Item fields: id, title, amount (decimal string or number; the sign gives the direction unless
 * `direction` is "credit"/"debit"), currency (defaults to the list's), date (ISO string or
 * Date), meta (secondary text; defaults to the time), status ("completed" | "pending" |
 * "failed"), icon (initials or a URL; defaults to the title's initials), href (row becomes a link).
 *
 * - Groups by day ("Today", "Yesterday", "12 Oct") unless group-by="none".
 * - Formats amounts with Intl. Credits read "Received", debits "Sent" for screen readers.
 * - Renders only with textContent, so titles can never inject markup.
 * - Fires `kl-select` (detail: { item }) when a row is activated, if `selectable` (rows become
 *   buttons) or the item has an href.
 * - This element owns its children; for framework-rendered lists use the .kl-txn-list classes.
 * - `labels` overrides the English words: { today, yesterday, received, sent, pending, failed, empty }.
 */
import { UIElement, define } from '../../core/element.js';
import { defaultLocale, formatMoney, normalizeDecimal } from '../../core/money.js';

const LABELS = { today: 'Today', yesterday: 'Yesterday', received: 'Received', sent: 'Sent', pending: 'Pending', failed: 'Failed', empty: 'No transactions yet.' };

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

const initials = (title) =>
  String(title ?? '')
    .split(/\s+/)
    .filter((w) => /\p{L}|\p{N}/u.test(w))
    .slice(0, 2)
    .map((w) => [...w][0].toUpperCase())
    .join('');

/** Only ordinary links: http(s), relative, mailto and tel. Never javascript: or data: URLs from data. */
const safeHref = (href) => {
  try {
    const url = new URL(String(href), document.baseURI);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
};

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export class KlTransactionList extends UIElement {
  static properties = {
    items: { type: Array, default: () => [] },
    currency: { type: String, default: 'NGN' },
    locale: { type: String },
    groupBy: { type: String, attribute: 'group-by', default: 'day' },
    headingLevel: { type: Number, attribute: 'heading-level', default: 3 },
    selectable: { type: Boolean },
    labels: { type: Object, default: () => ({}) },
  };

  connected() {
    this.listen(this, 'click', (e) => {
      const row = e.target.closest('.kl-txn__row');
      if (!row || !this.contains(row)) return;
      const item = this.items.find((i, index) => String(i.id ?? index) === row.closest('.kl-txn').dataset.id);
      if (item) this.emit('kl-select', { item });
    });
  }

  update() {
    const loc = this.locale || defaultLocale();
    const labels = { ...LABELS, ...this.labels };
    const items = [...(this.items ?? [])].map((item, index) => ({ item, index, date: item.date ? new Date(item.date) : null }));
    items.sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));

    if (!items.length) {
      this.replaceChildren(el('p', 'kl-txn-list__empty', labels.empty));
      return;
    }

    const groups = new Map();
    for (const entry of items) {
      const key = this.groupBy === 'none' || !entry.date ? 'all' : dayKey(entry.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    }

    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const sameYear = (d) => d.getFullYear() === now.getFullYear();
    const dayLabel = (d) =>
      dayKey(d) === dayKey(now)
        ? labels.today
        : dayKey(d) === dayKey(yesterday)
          ? labels.yesterday
          : new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'short', year: sameYear(d) ? undefined : 'numeric' }).format(d);
    const time = new Intl.DateTimeFormat(loc, { hour: 'numeric', minute: '2-digit' });

    const sections = [...groups].map(([key, entries]) => {
      const section = el('section', 'kl-txn-list__group');
      const list = el('ul', 'kl-txn-list__items');
      if (key !== 'all') {
        const heading = el(`h${Math.min(6, Math.max(2, this.headingLevel || 3))}`, 'kl-txn-list__date', dayLabel(entries[0].date));
        heading.id = `kl-txn-${this.#uid}-${key}`;
        section.setAttribute('aria-labelledby', heading.id);
        section.append(heading);
      }
      for (const { item, index, date } of entries) list.append(this.#row(item, index, date, { loc, labels, time }));
      section.append(list);
      return section;
    });
    this.replaceChildren(...sections);
  }

  #uid = Math.random().toString(36).slice(2, 8);

  #row(item, index, date, { loc, labels, time }) {
    const amount = normalizeDecimal(String(item.amount ?? '')) ?? '';
    const negative = amount.startsWith('-');
    const direction = item.direction ?? (negative ? 'debit' : 'credit');
    const magnitude = amount.replace('-', '');
    const currency = item.currency ?? this.currency;
    const li = el('li', 'kl-txn');
    li.dataset.id = String(item.id ?? index);
    li.dataset.direction = direction;
    if (item.status && item.status !== 'completed') li.dataset.status = item.status;

    const icon = el('span', 'kl-txn__icon');
    icon.setAttribute('aria-hidden', 'true');
    if (item.icon && /^(https?:|\/|data:image\/)/.test(item.icon)) {
      const img = el('img');
      img.src = item.icon;
      img.alt = '';
      icon.append(img);
    } else icon.textContent = item.icon ?? initials(item.title);

    const main = el('span', 'kl-txn__main');
    main.append(el('span', 'kl-txn__title', item.title ?? ''));
    const metaText = [date ? time.format(date) : null, item.meta].filter(Boolean).join(' · ');
    if (metaText) main.append(el('span', 'kl-txn__meta', metaText));

    const end = el('span', 'kl-txn__end');
    const amountEl = el('span', 'kl-txn__amount');
    const sr = el('span', 'kl-sr-only', `${direction === 'credit' ? labels.received : labels.sent} `);
    const visible = el('span', '', `${direction === 'credit' ? '+' : '−'}${formatMoney(magnitude || '0', { locale: loc, currency })}`);
    visible.setAttribute('aria-hidden', 'true');
    const spoken = el('span', 'kl-sr-only', formatMoney(magnitude || '0', { locale: loc, currency }));
    amountEl.append(sr, visible, spoken);
    end.append(amountEl);
    if (item.status === 'pending' || item.status === 'failed') end.append(el('span', 'kl-txn__status', labels[item.status]));

    let row;
    const href = item.href ? safeHref(item.href) : null;
    if (href) {
      row = el('a', 'kl-txn__row');
      row.href = href;
    } else if (this.selectable) {
      row = el('button', 'kl-txn__row');
      row.type = 'button';
    }
    if (row) {
      row.append(icon, main, end);
      li.append(row);
    } else li.append(icon, main, end);
    return li;
  }
}

define('kl-transaction-list', KlTransactionList);
