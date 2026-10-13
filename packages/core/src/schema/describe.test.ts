import { describe, expect, it } from 'vitest';
import { describeCondition, explainCondition, schemaNames } from './describe.ts';

const schema = {
  fields: [
    {
      name: 'nps',
      type: 'number' as const,
      label: 'How likely are you to recommend us?',
      page: 0,
      when: [],
    },
    {
      name: 'role',
      type: 'radio' as const,
      label: 'Role',
      page: 0,
      when: [],
      options: [
        { value: 'student', label: 'Student' },
        { value: 'engineer', label: 'Engineer' },
        { value: 'designer', label: 'Designer' },
      ],
    },
    { name: 'speak', type: 'checkbox' as const, label: 'I want to speak', page: 0, when: [] },
    { name: 'email', type: 'email' as const, label: 'Email', page: 0, when: [] },
  ],
};

describe('describeCondition', () => {
  it('reads like code — for the CLI and agents', () => {
    expect(describeCondition({ field: 'nps', lte: 6 })).toBe('nps ≤ 6');
    expect(describeCondition({ field: 'role', in: ['student'] })).toBe('role in ["student"]');
    expect(
      describeCondition({
        all: [
          { field: 'email', filled: true },
          { field: 'nps', gte: 9 },
        ],
      }),
    ).toBe('email is filled and nps ≥ 9');
  });
});

describe('explainCondition', () => {
  const names = schemaNames(schema);

  it('reads as a sentence in the form’s words', () => {
    expect(explainCondition({ field: 'role', equals: 'student' }, names, 'en')).toBe(
      '“Role” is “Student”',
    );
    expect(
      explainCondition({ field: 'role', in: ['student', 'engineer', 'designer'] }, names, 'en'),
    ).toBe('“Role” is “Student”, “Engineer”, or “Designer”');
    expect(explainCondition({ field: 'speak', equals: true }, names, 'en')).toBe(
      '“I want to speak” is checked',
    );
    expect(explainCondition({ field: 'email', filled: true }, names, 'en')).toBe(
      '“Email” is answered',
    );
    // Numbers keep their symbols; they read faster than words.
    expect(explainCondition({ field: 'nps', gte: 9 }, names, 'en')).toBe(
      '“How likely are you to recommend us?” ≥ 9',
    );
    // Unknown fields and values fall back to their names.
    expect(explainCondition({ field: 'ghost', equals: 'boo' }, names, 'en')).toBe(
      '“ghost” is “boo”',
    );
  });

  it('joins a list as “and” and groups nested “or”', () => {
    expect(
      explainCondition(
        [
          { field: 'email', filled: true },
          {
            any: [
              { field: 'role', equals: 'student' },
              { field: 'nps', lt: 7 },
            ],
          },
        ],
        names,
        'en',
      ),
    ).toBe(
      '“Email” is answered and (“Role” is “Student” or “How likely are you to recommend us?” < 7)',
    );
  });

  it('speaks every locale', () => {
    const cond = { field: 'role', in: ['student', 'engineer'] };
    expect(explainCondition(cond, names, 'zh-TW')).toBe('「Role」是「Student」或「Engineer」');
    expect(explainCondition(cond, names, 'zh-CN')).toBe('“Role”是“Student”或“Engineer”');
    expect(explainCondition(cond, names, 'ja')).toBe('「Role」が「Student」または「Engineer」');
    expect(
      explainCondition(
        [
          { field: 'speak', equals: true },
          { field: 'email', filled: false },
        ],
        names,
        'zh-TW',
      ),
    ).toBe('「I want to speak」有勾選且「Email」沒有填寫');
  });

  it('translates labels when given a translator', () => {
    const zh = schemaNames(schema, (text) => (text === 'Role' ? '身分' : text));
    expect(explainCondition({ field: 'role', equals: 'engineer' }, zh, 'zh-TW')).toBe(
      '「身分」是「Engineer」',
    );
  });
});
