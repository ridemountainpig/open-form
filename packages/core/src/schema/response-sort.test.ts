import { describe, expect, it } from 'vitest';
import {
  compareResponseSortKeys,
  parseResponseSort,
  type ResponseSort,
  responseSortKey,
} from './response-sort.ts';

const rows = [
  { name: 'Amy', seats: 12, plan: 'pro', tags: ['dev'], agree: true },
  { name: 'ben', seats: 3, plan: 'free', tags: ['design', 'dev'] },
  { name: 'Cleo', seats: '', plan: 'team', agree: false },
  { name: 'Dee', seats: 40, tags: [] },
];

function sorted(sort: ResponseSort): string[] {
  const key = responseSortKey(sort);
  return rows
    .map((row) => ({ row, key: key(row) }))
    .sort((a, b) => compareResponseSortKeys(a.key, b.key, sort.direction))
    .map(({ row }) => row.name);
}

describe('responseSortKey', () => {
  it('sorts text without regard to case', () => {
    expect(sorted({ field: 'name', direction: 'asc' })).toEqual(['Amy', 'ben', 'Cleo', 'Dee']);
    expect(sorted({ field: 'name', direction: 'desc' })).toEqual(['Dee', 'Cleo', 'ben', 'Amy']);
  });

  it('sorts numbers as numbers and keeps empty answers last both ways', () => {
    expect(sorted({ field: 'seats', direction: 'asc' })).toEqual(['ben', 'Amy', 'Dee', 'Cleo']);
    expect(sorted({ field: 'seats', direction: 'desc' })).toEqual(['Dee', 'Amy', 'ben', 'Cleo']);
  });

  it('follows the option order it is given', () => {
    const values = ['free', 'pro', 'team'];
    expect(sorted({ field: 'plan', direction: 'asc', values })).toEqual([
      'ben',
      'Amy',
      'Cleo',
      'Dee',
    ]);
    expect(sorted({ field: 'tags', direction: 'asc', values: ['design', 'dev'] })).toEqual([
      'ben',
      'Amy',
      'Cleo',
      'Dee',
    ]);
  });

  it('puts ticked checkboxes after unticked ones when ascending', () => {
    expect(sorted({ field: 'agree', direction: 'asc' })).toEqual(['Cleo', 'Amy', 'ben', 'Dee']);
  });
});

describe('compareResponseSortKeys', () => {
  it('puts numbers before text, like SQLite', () => {
    expect(compareResponseSortKeys(5, 'a', 'asc')).toBeLessThan(0);
    expect(compareResponseSortKeys(5, 'a', 'desc')).toBeGreaterThan(0);
    expect(compareResponseSortKeys(null, 'a', 'desc')).toBeGreaterThan(0);
  });
});

describe('parseResponseSort', () => {
  it('keeps option values only for a field', () => {
    expect(parseResponseSort({ direction: 'asc', values: ['a'] })).toEqual({ direction: 'asc' });
    expect(parseResponseSort({ field: 'plan', direction: 'desc', values: ['a'] })).toEqual({
      field: 'plan',
      direction: 'desc',
      values: ['a'],
    });
  });

  it.each([
    [null, /direction/],
    [{ field: 'a' }, /direction/],
    [{ field: '', direction: 'asc' }, /field/],
    [{ field: 'a', direction: 'asc', values: 'x' }, /values/],
  ])('rejects %j', (input, message) => {
    expect(() => parseResponseSort(input)).toThrow(message);
  });
});
