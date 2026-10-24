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
import { UIElement } from '../../core/element.js';
export declare class KlTransactionList extends UIElement {
    #private;
    /** @type {import('../../core/element.js').PropertyDeclarations} */
    static properties: import('../../core/element.js').PropertyDeclarations;
    connected(): void;
    update(): void;
}
