/**
 * Type-to-find for menus and listboxes: printable keys build a short buffer (reset after 500ms)
 * and the next item whose label starts with it is returned. Repeating one letter cycles.
 * @template T
 * @param {(item: T) => string} label
 */
export function typeahead(label) {
  let buffer = '';
  let timer = 0;
  /**
   * @param {KeyboardEvent} event
   * @param {T[]} items
   * @param {number} current index of the active item (-1 for none)
   * @returns {number} index to activate, or -1 if the key isn't typeahead or nothing matches
   */
  return (event, items, current) => {
    if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return -1;
    if (event.key === ' ' && !buffer) return -1; // Space activates unless we're mid-word
    clearTimeout(timer);
    timer = setTimeout(() => (buffer = ''), 500);
    buffer += event.key.toLowerCase();
    const cycling = buffer.length > 1 && [...buffer].every((c) => c === buffer[0]);
    const query = cycling ? buffer[0] : buffer;
    const start = cycling || buffer.length === 1 ? current + 1 : current;
    for (let i = 0; i < items.length; i++) {
      const index = (start + i + items.length) % items.length;
      if (label(items[index]).trim().toLowerCase().startsWith(query)) return index;
    }
    return -1;
  };
}
