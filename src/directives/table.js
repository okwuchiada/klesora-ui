/**
 * data-kl-table: sorting state, select-all and phone labels for <table class="kl-table">.
 * Importing registers it.
 *
 * Sorting. Put a <button class="kl-table__sort" value="key"> in each sortable <th>.
 *   - A click sets aria-sort on that header (ascending ↔ descending) and clears the others.
 *   - It fires `kl-sort` (detail: { key, direction, column }, cancelable) on the table.
 *   - Your app re-orders its rows, so frameworks keep control of their nodes.
 *   - data-kl-table="dom" re-orders the <tbody> rows itself (plain HTML pages). It compares
 *     cell text, numbers numerically, or a cell's data-sort-value when present.
 *
 * Selection. A header checkbox [data-kl-select-all] toggles every row checkbox [data-kl-select].
 *   - It shows indeterminate when some rows are selected.
 *   - Selected rows get aria-selected="true".
 *   - Fires `kl-change` (detail: { selected: values }) on the table.
 *
 * Phones. Cells get data-label from their column header (for data-stacked), and the scroll
 * wrapper (.kl-table-wrap) becomes a focusable, labelled region so keyboard users can scroll it.
 */
import { registerDirective } from '../core/directives.js';

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
const cellValue = (cell) => cell?.dataset.sortValue ?? cell?.textContent.trim() ?? '';
const asNumber = (text) => {
  const n = Number(text.replace(/[^\d.-]/g, ''));
  return text.trim() !== '' && /\d/.test(text) && !Number.isNaN(n) ? n : null;
};

/** @param {HTMLTableElement} table @param {string} value */
export function mount(table, value) {
  const controller = new AbortController();
  const { signal } = controller;
  const headers = () => [...(table.tHead?.rows[0]?.cells ?? [])];

  const label = () => {
    const names = headers().map((th) => th.textContent.trim());
    for (const body of table.tBodies) {
      for (const row of body.rows) {
        [...row.cells].forEach((cell, i) => {
          if (names[i] && !cell.hasAttribute('data-label')) cell.dataset.label = names[i];
        });
      }
    }
    const wrap = table.parentElement?.classList.contains('kl-table-wrap') ? table.parentElement : null;
    if (wrap) {
      if (!wrap.hasAttribute('tabindex')) wrap.tabIndex = 0;
      if (!wrap.hasAttribute('role')) wrap.setAttribute('role', 'region');
      const name = table.caption?.textContent.trim() || table.getAttribute('aria-label');
      if (name && !wrap.hasAttribute('aria-label')) wrap.setAttribute('aria-label', name);
    }
  };

  const syncSelection = (emit) => {
    const all = table.querySelector('[data-kl-select-all]');
    const boxes = [...table.querySelectorAll('[data-kl-select]')];
    const checked = boxes.filter((b) => b.checked);
    for (const box of boxes) {
      const row = box.closest('tr');
      if (box.checked) row?.setAttribute('aria-selected', 'true');
      else row?.removeAttribute('aria-selected');
    }
    if (all) {
      all.checked = checked.length > 0 && checked.length === boxes.length;
      all.indeterminate = checked.length > 0 && checked.length < boxes.length;
    }
    if (emit) {
      const selected = checked.map((b) => b.value && b.value !== 'on' ? b.value : b.closest('tr')?.rowIndex);
      table.dispatchEvent(new CustomEvent('kl-change', { detail: { selected }, bubbles: true, composed: true }));
    }
  };

  table.addEventListener(
    'change',
    (e) => {
      if (e.target.matches('[data-kl-select-all]')) {
        for (const box of table.querySelectorAll('[data-kl-select]')) if (!box.disabled) box.checked = e.target.checked;
        syncSelection(true);
      } else if (e.target.matches('[data-kl-select]')) {
        syncSelection(true);
      }
    },
    { signal },
  );

  table.addEventListener(
    'click',
    (e) => {
      const button = e.target.closest('.kl-table__sort');
      const th = button?.closest('th');
      if (!th || !table.contains(th)) return;
      const direction = th.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
      const column = headers().indexOf(th);
      const key = button.value || button.dataset.key || String(column);
      const allowed = table.dispatchEvent(
        new CustomEvent('kl-sort', { detail: { key, direction, column }, bubbles: true, composed: true, cancelable: true }),
      );
      if (!allowed) return;
      for (const other of headers()) if (other !== th) other.removeAttribute('aria-sort');
      th.setAttribute('aria-sort', direction);
      if (value === 'dom') sortRows(column, direction);
    },
    { signal },
  );

  function sortRows(column, direction) {
    const factor = direction === 'ascending' ? 1 : -1;
    for (const body of table.tBodies) {
      const rows = [...body.rows];
      rows.sort((a, b) => {
        const x = cellValue(a.cells[column]);
        const y = cellValue(b.cells[column]);
        const nx = asNumber(x);
        const ny = asNumber(y);
        return factor * (nx !== null && ny !== null ? nx - ny : collator.compare(x, y));
      });
      body.append(...rows); // opt-in only: moves the rows (plain HTML pages)
    }
  }

  const observer = new MutationObserver(() => {
    label();
    syncSelection(false);
  });
  observer.observe(table, { childList: true, subtree: true });
  signal.addEventListener('abort', () => observer.disconnect());
  label();
  syncSelection(false);
  return () => controller.abort();
}

registerDirective('table', mount);
