import { compareResponseSortKeys, responseFilterTest, responseSortKey } from '../schema/index.ts';
import type { ListSubmissionsOptions, StoredSubmission } from './types.ts';

/**
 * Studio's filters, sort and paging over one form's responses, for adapters
 * that can't run the filter rules inside their database. Search is left to the caller.
 */
export function pageSubmissions<T extends StoredSubmission>(
  rows: T[],
  opts: Omit<ListSubmissionsOptions, 'search'> = {},
): { items: T[]; total: number } {
  let selected = opts.filter ? rows.filter(responseFilterTest(opts.filter, opts.now)) : rows;
  const direction = opts.sort?.direction ?? opts.order ?? 'desc';
  if (opts.sort?.field !== undefined) {
    const key = responseSortKey(opts.sort);
    const keyed = selected.map((row) => ({ row, key: key(row.data) }));
    keyed.sort(
      (a, b) => compareResponseSortKeys(a.key, b.key, direction) || b.row.number - a.row.number,
    );
    selected = keyed.map(({ row }) => row);
  } else {
    selected = [...selected].sort((a, b) =>
      direction === 'asc' ? a.number - b.number : b.number - a.number,
    );
  }
  const offset = opts.offset ?? 0;
  const items = selected.slice(offset, opts.limit === undefined ? undefined : offset + opts.limit);
  return { items, total: selected.length };
}
