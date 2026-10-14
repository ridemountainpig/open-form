import { describe, expect, it } from 'vitest';
import {
  parseResponseFilter,
  type ResponseFilter,
  type ResponseFilterRule,
  responseFilterRuleProblem,
  responseFilterTest,
} from './response-filter.ts';

const responses = [
  {
    data: { name: 'Amy', email: 'amy@example.com', seats: 3, plan: 'pro', tags: ['design', 'dev'] },
    createdAt: '2026-10-13T16:30:00.000Z',
  },
  {
    data: { name: 'Ben', email: 'ben@corp.io', seats: '12', plan: 'free', agree: true },
    createdAt: '2026-10-14T01:00:00.000Z',
  },
  {
    data: { name: 'Cleo', seats: 0, tags: ['dev'], birthday: '1990-05-01', agree: false },
    createdAt: '2026-10-01T00:00:00.000Z',
  },
];

const NOW = Date.parse('2026-10-14T12:00:00.000Z');

function names(filter: ResponseFilter): string[] {
  const test = responseFilterTest(filter, NOW);
  return responses.filter(test).map((r) => r.data.name);
}

const one = (rule: ResponseFilterRule) => names({ rules: [rule] });

describe('responseFilterTest', () => {
  it('matches text case-insensitively, inside lists too', () => {
    expect(one({ field: 'email', op: 'contains', value: 'EXAMPLE' })).toEqual(['Amy']);
    expect(one({ field: 'email', op: 'notContains', value: 'example' })).toEqual(['Ben', 'Cleo']);
    expect(one({ field: 'name', op: 'is', value: 'amy' })).toEqual(['Amy']);
    expect(one({ field: 'name', op: 'isNot', value: 'amy' })).toEqual(['Ben', 'Cleo']);
    expect(one({ field: 'email', op: 'startsWith', value: 'ben' })).toEqual(['Ben']);
    expect(one({ field: 'email', op: 'endsWith', value: '.io' })).toEqual(['Ben']);
    expect(one({ field: 'tags', op: 'contains', value: 'des' })).toEqual(['Amy']);
  });

  it('compares numbers, including ones stored as text', () => {
    expect(one({ field: 'seats', op: 'gt', value: 2 })).toEqual(['Amy', 'Ben']);
    expect(one({ field: 'seats', op: 'lte', value: 3 })).toEqual(['Amy', 'Cleo']);
    expect(one({ field: 'seats', op: 'eq', value: 0 })).toEqual(['Cleo']);
    expect(one({ field: 'seats', op: 'neq', value: 12 })).toEqual(['Amy', 'Cleo']);
    expect(one({ field: 'missing', op: 'lt', value: 100 })).toEqual([]);
  });

  it('picks options from single and multiple choices', () => {
    expect(one({ field: 'plan', op: 'anyOf', values: ['pro', 'team'] })).toEqual(['Amy']);
    expect(one({ field: 'plan', op: 'noneOf', values: ['pro'] })).toEqual(['Ben', 'Cleo']);
    expect(one({ field: 'tags', op: 'anyOf', values: ['dev'] })).toEqual(['Amy', 'Cleo']);
    expect(one({ field: 'tags', op: 'allOf', values: ['dev', 'design'] })).toEqual(['Amy']);
  });

  it('reads checkboxes and empty answers', () => {
    expect(one({ field: 'agree', op: 'checked' })).toEqual(['Ben']);
    expect(one({ field: 'agree', op: 'unchecked' })).toEqual(['Amy', 'Cleo']);
    expect(one({ field: 'email', op: 'empty' })).toEqual(['Cleo']);
    expect(one({ field: 'tags', op: 'notEmpty' })).toEqual(['Amy', 'Cleo']);
  });

  it('compares date answers by day', () => {
    expect(one({ field: 'birthday', op: 'before', value: '2000-01-01' })).toEqual(['Cleo']);
    expect(one({ field: 'birthday', op: 'on', value: '1990-05-01' })).toEqual(['Cleo']);
    expect(
      one({ field: 'birthday', op: 'between', value: '1990-01-01', to: '1990-05-01' }),
    ).toEqual(['Cleo']);
    expect(one({ field: 'name', op: 'after', value: '2000-01-01' })).toEqual([]);
  });

  it('reads submission days in the given time zone', () => {
    const on = (timeZone: string) =>
      names({ timeZone, rules: [{ op: 'on', value: '2026-10-14' }] });
    // 16:30 UTC on the 13th is already the 14th in Taipei.
    expect(on('Asia/Taipei')).toEqual(['Amy', 'Ben']);
    expect(on('UTC')).toEqual(['Ben']);
    expect(names({ rules: [{ op: 'before', value: '2026-10-13' }] })).toEqual(['Cleo']);
    expect(names({ rules: [{ op: 'onOrAfter', value: '2026-10-13' }] })).toEqual(['Amy', 'Ben']);
    expect(names({ rules: [{ op: 'between', value: '2026-10-01', to: '2026-10-13' }] })).toEqual([
      'Amy',
      'Cleo',
    ]);
  });

  it('counts the past days back from now', () => {
    expect(names({ rules: [{ op: 'pastDays', value: 1 }] })).toEqual(['Amy', 'Ben']);
    expect(names({ rules: [{ op: 'pastDays', value: 30 }] })).toEqual(['Amy', 'Ben', 'Cleo']);
  });

  it('needs every rule by default, or any one of them', () => {
    const rules: ResponseFilterRule[] = [
      { field: 'tags', op: 'anyOf', values: ['dev'] },
      { field: 'seats', op: 'gt', value: 1 },
    ];
    expect(names({ rules })).toEqual(['Amy']);
    expect(names({ match: 'any', rules })).toEqual(['Amy', 'Ben', 'Cleo']);
    expect(names({ rules: [] })).toEqual(['Amy', 'Ben', 'Cleo']);
  });

  it("doesn't read inherited properties as answers", () => {
    expect(one({ field: 'constructor', op: 'notEmpty' })).toEqual([]);
  });
});

describe('parseResponseFilter', () => {
  it('accepts a well-formed filter and drops unknown keys', () => {
    expect(
      parseResponseFilter({
        match: 'any',
        timeZone: 'Asia/Taipei',
        rules: [{ field: 'email', op: 'contains', value: 'x', extra: 1 }],
      }),
    ).toEqual({
      match: 'any',
      timeZone: 'Asia/Taipei',
      rules: [{ field: 'email', op: 'contains', value: 'x' }],
    });
  });

  it.each([
    [null, /object with rules/],
    [{ rules: 'x' }, /at most 20/],
    [{ rules: Array.from({ length: 21 }, () => ({ op: 'pastDays', value: 1 })) }, /at most 20/],
    [{ match: 'some', rules: [] }, /match/],
    [{ timeZone: 'Mars/Base', rules: [] }, /timeZone/],
    [{ rules: [{ field: 'a', op: 'like', value: 'x' }] }, /unknown operator/],
    [{ rules: [{ field: 'a', op: 'contains' }] }, /needs some text/],
    [{ rules: [{ field: 'a', op: 'contains', value: '   ' }] }, /needs some text/],
    [{ rules: [{ field: 'a', op: 'gt', value: '3' }] }, /needs a number/],
    [{ rules: [{ field: 'a', op: 'anyOf', values: [] }] }, /options/],
    [{ rules: [{ field: 'a', op: 'on', value: '2026-02-30' }] }, /YYYY-MM-DD/],
    [{ rules: [{ op: 'between', value: '2026-10-02', to: '2026-10-01' }] }, /earlier one first/],
    [{ rules: [{ op: 'contains', value: 'x' }] }, /submission time/],
    [{ rules: [{ field: 'a', op: 'pastDays', value: 7 }] }, /only applies/],
    [{ rules: [{ op: 'pastDays', value: 1.5 }] }, /whole number/],
  ])('rejects %j', (input, message) => {
    expect(() => parseResponseFilter(input)).toThrow(message);
  });

  it('tells Studio which rules are still unfinished', () => {
    expect(responseFilterRuleProblem({ field: 'a', op: 'contains', value: '' })).toBeDefined();
    expect(responseFilterRuleProblem({ field: 'a', op: 'empty' })).toBeUndefined();
  });
});
