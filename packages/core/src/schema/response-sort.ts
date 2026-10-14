import { ownValue } from './conditions.ts';
import { answerTexts } from './response-filter.ts';

// Studio's Responses table sorts on a column. Storage adapters sort with the
// keys made here, so SQLite and the memory adapter agree on the order.

export type ResponseSort = {
  /** The answer to sort by. Without it, responses sort by when they were submitted. */
  field?: string;
  direction: 'asc' | 'desc';
  /**
   * A choice question's option values in form order. Answers then sort by an
   * option's place in the list ("Under 1 year" before "5+ years"), not its text.
   */
  values?: string[];
};

/** What an answer sorts as. `null` is an empty answer; those always come last. */
export type ResponseSortKey = number | string | null;

const MAX_TEXT = 500;
const MAX_OPTIONS = 200;

/** Checks a sort that arrived as JSON. Throws with what's wrong. */
export function parseResponseSort(input: unknown): ResponseSort {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('sort must be an object with a direction');
  }
  const { field, direction, values } = input as Record<string, unknown>;
  if (direction !== 'asc' && direction !== 'desc') {
    throw new Error('direction must be "asc" or "desc"');
  }
  if (field !== undefined && (typeof field !== 'string' || !field || field.length > MAX_TEXT)) {
    throw new Error('field must be a field name');
  }
  if (
    values !== undefined &&
    (!Array.isArray(values) ||
      values.length > MAX_OPTIONS ||
      !values.every((v) => typeof v === 'string' && v.length <= MAX_TEXT))
  ) {
    throw new Error(`values must list at most ${MAX_OPTIONS} options`);
  }
  return {
    direction,
    ...(field !== undefined ? { field: field as string } : {}),
    ...(values !== undefined && field !== undefined ? { values: values as string[] } : {}),
  };
}

/** The sort key of each response's answer to `sort.field`. Runs `parseResponseSort` first. */
export function responseSortKey(
  sort: ResponseSort,
): (data: Record<string, unknown>) => ResponseSortKey {
  const { field, values } = parseResponseSort(sort);
  if (field === undefined) return () => null;
  const place = values ? new Map(values.map((v, i) => [v, i])) : null;
  return (data) => {
    const answer = ownValue(data, field);
    if (typeof answer === 'boolean') return answer ? 1 : 0;
    if (typeof answer === 'number') return Number.isFinite(answer) ? answer : null;
    const parts = answerTexts(answer);
    if (parts.length === 0) return null;
    if (place) {
      // Unknown values (options since removed) go after the known ones.
      const known = parts.map((p) => place.get(p) ?? values?.length ?? 0);
      return Math.min(...known);
    }
    return parts.join(', ').toLowerCase();
  };
}

/**
 * SQLite's order for the keys: numbers before text, text by code point, empty
 * answers last whichever way it runs. `desc` reverses everything but the empties.
 */
export function compareResponseSortKeys(
  a: ResponseSortKey,
  b: ResponseSortKey,
  direction: 'asc' | 'desc',
): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  let order: number;
  if (typeof a === 'number' && typeof b === 'number') order = a - b;
  else if (typeof a === 'number') order = -1;
  else if (typeof b === 'number') order = 1;
  else order = a < b ? -1 : a > b ? 1 : 0;
  return direction === 'desc' ? -order : order;
}
