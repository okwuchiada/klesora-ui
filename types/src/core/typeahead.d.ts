/**
 * Type-to-find for menus and listboxes: printable keys build a short buffer (reset after 500ms)
 * and the next item whose label starts with it is returned. Repeating one letter cycles.
 * @template T
 * @param {(item: T) => string} label
 */
export declare function typeahead<T>(label: (item: T) => string): (event: KeyboardEvent, items: T[], current: number) => number;
