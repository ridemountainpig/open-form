import { describe, expect, it } from 'vitest';
import {
  applyOverrides,
  coerceValue,
  coerceValues,
  evaluateCondition,
  type FieldSchema,
  type FormSchema,
  getMessages,
  isTimeZone,
  mostVisibleSteps,
  overriddenTimeZone,
  parseDuration,
  parseSchedule,
  patternProblem,
  policyDateParts,
  policyInstant,
  resolveProtection,
  resolveVisibleFields,
  sampleAnswers,
  scheduleChanges,
  schemaVersion,
  studioProblem,
  submissionValues,
  submissionWindow,
  themeToCss,
  timeZoneOffsetLabel,
  timeZoneProblem,
  translate,
  validateField,
  validateSubmission,
  validatorForFields,
  wallClock,
} from './index.ts';

function field(partial: Partial<FieldSchema> & Pick<FieldSchema, 'name' | 'type'>): FieldSchema {
  return { page: 0, when: [], ...partial };
}

describe('evaluateCondition', () => {
  it('compares primitives by their string form', () => {
    expect(evaluateCondition({ field: 'n', equals: 1 }, { n: '1' })).toBe(true);
    expect(evaluateCondition({ field: 'b', equals: true }, { b: true })).toBe(true);
    expect(evaluateCondition({ field: 'role', equals: 'Student' }, { role: 'Engineer' })).toBe(
      false,
    );
  });

  it('supports membership, contains, filled and numeric operators', () => {
    expect(evaluateCondition({ field: 'r', in: ['a', 'b'] }, { r: 'b' })).toBe(true);
    expect(evaluateCondition({ field: 'r', notIn: ['a', 'b'] }, { r: 'b' })).toBe(false);
    expect(evaluateCondition({ field: 'tags', contains: 'x' }, { tags: ['x', 'y'] })).toBe(true);
    expect(evaluateCondition({ field: 's', contains: 'ell' }, { s: 'hello' })).toBe(true);
    expect(evaluateCondition({ field: 'e', filled: true }, { e: '  ' })).toBe(false);
    expect(evaluateCondition({ field: 'e', empty: true }, {})).toBe(true);
    expect(evaluateCondition({ field: 'age', gte: 18 }, { age: '20' })).toBe(true);
    expect(evaluateCondition({ field: 'age', lt: 18 }, { age: 'abc' })).toBe(false);
  });

  it('reads a checkbox group as the options ticked', () => {
    const one = { tags: ['AI'] };
    const two = { tags: ['AI', 'Web'] };
    expect(evaluateCondition({ field: 'tags', equals: 'AI' }, one)).toBe(true);
    expect(evaluateCondition({ field: 'tags', equals: 'AI' }, two)).toBe(false);
    expect(evaluateCondition({ field: 'tags', notEquals: 'AI' }, one)).toBe(false);
    expect(evaluateCondition({ field: 'tags', notEquals: 'AI' }, two)).toBe(true);
    expect(evaluateCondition({ field: 'tags', in: ['AI', 'Data'] }, two)).toBe(true);
    expect(evaluateCondition({ field: 'tags', in: ['Data'] }, two)).toBe(false);
    expect(evaluateCondition({ field: 'tags', in: ['Data'] }, {})).toBe(false);
    expect(evaluateCondition({ field: 'tags', notIn: ['Web'] }, two)).toBe(false);
    expect(evaluateCondition({ field: 'tags', notIn: ['Data'] }, two)).toBe(true);
    expect(evaluateCondition({ field: 'tags', notIn: ['Data'] }, {})).toBe(true);
  });

  it('reads an untouched checkbox as unticked', () => {
    expect(evaluateCondition({ field: 'ok', equals: false }, {})).toBe(true);
    expect(evaluateCondition({ field: 'ok', equals: false }, { ok: true })).toBe(false);
    expect(evaluateCondition({ field: 'ok', notEquals: false }, {})).toBe(false);
    expect(evaluateCondition({ field: 'ok', notEquals: true }, {})).toBe(true);
    expect(evaluateCondition({ field: 'ok', equals: true }, {})).toBe(false);
  });

  it('combines with all / any / not', () => {
    const values = { role: 'Student', country: 'Taiwan' };
    expect(
      evaluateCondition(
        {
          all: [
            { field: 'role', equals: 'Student' },
            { field: 'country', equals: 'Taiwan' },
          ],
        },
        values,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          any: [
            { field: 'role', equals: 'Engineer' },
            { not: { field: 'country', equals: 'Japan' } },
          ],
        },
        values,
      ),
    ).toBe(true);
  });
});

describe('sampleAnswers', () => {
  const field = (extra: Partial<FieldSchema>): FieldSchema => ({
    name: 'x',
    type: 'number',
    page: 0,
    when: [],
    ...extra,
  });

  it('tries each option, each step of a short scale and its upper bound', () => {
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    expect(sampleAnswers(field({ type: 'radio', options }))).toEqual(['a', 'b']);
    expect(sampleAnswers(field({ type: 'checkbox-group', options }))).toEqual([
      ['a'],
      ['b'],
      ['a', 'b'],
    ]);
    expect(sampleAnswers(field({ min: 0, max: 3 }))).toEqual([0, 1, 2, 3]);
    expect(sampleAnswers(field({ min: 0.5, max: 1 }))).toEqual([0.5, 1]);
    expect(sampleAnswers(field({ min: 0, max: 100 }))).toEqual([0, 100]);
    expect(sampleAnswers(field({ type: 'text' }))).toEqual(['answer']);
  });

  it('adds the values conditions compare the field with, inside its bounds', () => {
    const when = [
      {
        any: [
          { field: 'x', equals: 50 },
          { field: 'x', gt: 80 },
          { field: 'x', lt: 0 },
        ],
      },
      { field: 'other', equals: 7 },
    ];
    expect(sampleAnswers(field({ min: 0, max: 100 }), when)).toEqual([0, 100, 50, 81, 65.5]);
    expect(sampleAnswers(field({ min: 0, max: 100 }), [{ field: 'x', gt: 50, lt: 51 }])).toContain(
      50.5,
    );
    expect(
      sampleAnswers(field({ min: 0, max: 100 }), [
        {
          all: [
            { field: 'x', gt: 50 },
            { field: 'x', lt: 51 },
          ],
        },
      ]),
    ).toContain(50.5);
    expect(sampleAnswers(field({ type: 'text' }), [{ field: 'x', equals: 'yes' }])).toEqual([
      'answer',
      'yes',
    ]);
  });
});

describe('mostVisibleSteps', () => {
  const required = (name: string, extra: Partial<FieldSchema> = {}): FieldSchema => ({
    name,
    type: 'radio',
    page: 0,
    when: [],
    required: true,
    options: [
      { value: 'x', label: 'X' },
      { value: 'y', label: 'Y' },
    ],
    ...extra,
  });

  it('counts a step only a compared number reveals, and one behind several answers', () => {
    const fields = [
      required('age', { type: 'number', options: undefined, min: 0, max: 100 }),
      required('a', { page: 1, when: [{ field: 'age', equals: 50 }] }),
      required('b', { page: 1, when: [{ field: 'age', equals: 50 }] }),
    ];
    const steps = [
      { when: [] },
      { when: [{ field: 'age', equals: 50 }] },
      {
        when: [
          { field: 'a', equals: 'y' },
          { field: 'b', equals: 'y' },
        ],
      },
    ];
    expect(mostVisibleSteps(steps, fields, {})).toBe(3);
    expect(mostVisibleSteps(steps, fields, { age: 20 })).toBe(1);
    expect(mostVisibleSteps(steps, fields, { age: 50, a: 'x' })).toBe(2);
  });

  it('answers the question that reveals a deciding question first', () => {
    const fields = [required('a'), required('b', { when: [{ field: 'a', equals: 'y' }] })];
    const steps = [{ when: [] }, { when: [{ field: 'b', equals: 'y' }] }];
    expect(mostVisibleSteps(steps, fields, {})).toBe(2);
  });

  it('tries each combination once, so many branching questions stay within budget', () => {
    const fields = Array.from({ length: 9 }, (_, i) => required(`q${i}`));
    const steps = [{ when: [] }, { when: fields.map((f) => ({ field: f.name, equals: 'y' })) }];
    expect(mostVisibleSteps(steps, fields, {})).toBe(2);
  });
});

describe('validateField', () => {
  const m = getMessages('en');

  it('enforces required, with a checkbox-specific message', () => {
    expect(validateField(field({ name: 'a', type: 'text', required: true }), '  ', m)).toBe(
      m.required,
    );
    expect(validateField(field({ name: 'a', type: 'checkbox', required: true }), false, m)).toBe(
      m.mustAccept,
    );
    expect(validateField(field({ name: 'a', type: 'text' }), undefined, m)).toBeUndefined();
  });

  it('validates text formats and lengths', () => {
    expect(validateField(field({ name: 'e', type: 'email' }), 'nope', m)).toBe(m.invalidEmail);
    expect(validateField(field({ name: 'e', type: 'email' }), 'a@b.co', m)).toBeUndefined();
    expect(validateField(field({ name: 'u', type: 'url' }), 'ftp://x.y', m)).toBe(m.invalidUrl);
    expect(validateField(field({ name: 't', type: 'text', minLength: 3 }), 'ab', m)).toBe(
      'Use at least 3 characters.',
    );
    expect(
      validateField(
        field({ name: 't', type: 'text', pattern: '[a-z]+', patternMessage: 'lc' }),
        'aB',
      ),
    ).toBe('lc');
  });

  it('keeps the format regexes fast on hostile input', () => {
    const hostile = `a@${'.'.repeat(250_000)}@`;
    const started = Date.now();
    expect(validateField(field({ name: 'e', type: 'email' }), hostile, m)).toBe(m.invalidEmail);
    expect(validateField(field({ name: 't', type: 'text', pattern: '[a-z.@]+' }), hostile, m)).toBe(
      'Use 1000 characters or fewer.',
    );
    expect(Date.now() - started).toBeLessThan(500);
    expect(
      validateField(
        field({ name: 't', type: 'text', pattern: 'a+', maxLength: 2000 }),
        'a'.repeat(1500),
      ),
    ).toBeUndefined();
  });

  it('bounds what custom fields and checkbox groups accept', () => {
    let deep: unknown = 'x';
    for (let i = 0; i < 12; i++) deep = [deep];
    const custom = field({ name: 'c', type: 'custom' });
    expect(validateField(custom, deep, m)).toBe(m.invalidValue);
    expect(validateField(custom, { street: 'Main', geo: [1, 2] }, m)).toBeUndefined();

    const group = field({ name: 'g', type: 'checkbox-group' });
    expect(coerceValue(group, ['a', 'a', { toString: 1 }, null, '', 2])).toEqual(['a', '2']);
  });

  it('validates numbers, options, dates and groups', () => {
    expect(validateField(field({ name: 'n', type: 'number', min: 1 }), 0, m)).toBe(
      'Enter 1 or more.',
    );
    expect(validateField(field({ name: 'n', type: 'number', integer: true }), 1.5, m)).toBe(
      m.integer,
    );
    const options = [
      { value: 'a', label: 'A' },
      { value: 'b', label: 'B' },
    ];
    expect(validateField(field({ name: 's', type: 'select', options }), 'c', m)).toBe(
      m.invalidOption,
    );
    expect(validateField(field({ name: 'd', type: 'date' }), '2026-02-30', m)).toBe(m.invalidDate);
    expect(
      validateField(field({ name: 'd', type: 'date', min: '2026-01-01' }), '2025-12-31', m),
    ).toBe('Pick a date on or after January 1, 2026.');
    expect(
      validateField(field({ name: 'g', type: 'checkbox-group', options, maxSelected: 1 }), [
        'a',
        'b',
      ]),
    ).toBe('Select at most 1.');
  });

  it('never skips an author pattern the `u` flag rejects', () => {
    const phone = field({ name: 'p', type: 'text', pattern: '\\d{3}\\-\\d{4}' });
    expect(validateField(phone, '555-1234', m)).toBeUndefined();
    expect(validateField(phone, 'hello', m)).toBe(m.pattern);
    const handle = field({ name: 'h', type: 'text', pattern: '[\\w-.]+' });
    expect(validateField(handle, 'a.b-c', m)).toBeUndefined();
    expect(validateField(handle, '!!! $$$', m)).toBe(m.pattern);
    expect(patternProblem('[\\w-.]+')).toBeUndefined();
    expect(patternProblem('(')).toMatch(/isn't a valid regular expression/);
    expect(validateField(field({ name: 'x', type: 'text', pattern: '(' }), 'anything', m)).toBe(
      m.pattern,
    );
  });

  it('checks number steps from min, tolerating binary fractions', () => {
    const half = field({ name: 'n', type: 'number', min: 1, step: 0.5 });
    expect(validateField(half, 2.5, m)).toBeUndefined();
    expect(validateField(half, 1.7, m)).toBe('Enter a valid value. The nearest is 1.5.');
    const tenth = field({ name: 'n', type: 'number', step: 0.1 });
    expect(validateField(tenth, 0.3, m)).toBeUndefined();
    expect(validateField(tenth, 1_000_000.7, m)).toBeUndefined();
    expect(validateField(tenth, 0.37, m)).toBe('Enter a valid value. The nearest is 0.4.');
    const five = field({ name: 'n', type: 'number', max: 20, step: 5 });
    expect(validateField(five, 12, m)).toBe('Enter a valid value. The nearest is 10.');
    expect(
      validateField(field({ name: 'n', type: 'number', min: 0, max: 7, step: 5 }), 6.8, m),
    ).toBe('Enter a valid value. The nearest is 5.');
    expect(validateField(five, 15, getMessages('ja'))).toBeUndefined();
  });

  it('rejects every answer to a choice field without options', () => {
    expect(validateField(field({ name: 's', type: 'select' }), 'anything', m)).toBe(
      m.invalidOption,
    );
    expect(validateField(field({ name: 'g', type: 'checkbox-group' }), ['x'], m)).toBe(
      m.invalidOption,
    );
  });

  it('localizes messages', () => {
    const zh = getMessages('zh-TW');
    expect(validateField(field({ name: 'a', type: 'text', required: true }), '', zh)).toBe(
      '此欄位為必填。',
    );
  });
});

const meetup: FormSchema = {
  id: 'meetup',
  pages: [
    { index: 0, when: [] },
    { index: 1, when: [] },
  ],
  fields: [
    field({ name: 'name', type: 'text', required: true }),
    field({ name: 'email', type: 'email', required: true }),
    field({
      name: 'role',
      type: 'select',
      page: 1,
      required: true,
      options: [
        { value: 'Student', label: 'Student' },
        { value: 'Engineer', label: 'Engineer' },
      ],
    }),
    field({
      name: 'school',
      type: 'text',
      page: 1,
      required: true,
      when: [{ field: 'role', equals: 'Student' }],
    }),
    field({
      name: 'major',
      type: 'text',
      page: 1,
      when: [{ field: 'school', filled: true }],
    }),
  ],
};

describe('resolveVisibleFields', () => {
  it('drops hidden fields transitively and unknown keys', () => {
    const { fields, values } = resolveVisibleFields(meetup, {
      name: 'Alex',
      role: 'Engineer',
      school: 'NTU',
      major: 'CS',
      injected: 'x',
    });
    expect(fields.map((f) => f.name)).toEqual(['name', 'email', 'role']);
    expect(values).toEqual({ name: 'Alex', role: 'Engineer' });
  });
});

const contact: FormSchema = {
  id: 'contact',
  pages: [{ index: 0, when: [] }],
  fields: [
    field({
      name: 'hasPhone',
      type: 'radio',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    }),
    field({ name: 'phone', type: 'tel', when: [{ field: 'hasPhone', equals: 'yes' }] }),
    field({
      name: 'email',
      type: 'email',
      required: true,
      when: [{ field: 'phone', empty: true }],
    }),
  ],
};

describe('resolveVisibleFields with negative conditions', () => {
  it('lets a field return once the field it waits on is hidden, keeping its answer', async () => {
    const answers = { hasPhone: 'no', phone: '0912345678', email: 'a@b.co' };
    expect(await validateSubmission(contact, answers)).toEqual({
      ok: true,
      values: { hasPhone: 'no', email: 'a@b.co' },
    });
    const missing = await validateSubmission(contact, { hasPhone: 'no', phone: '0912345678' });
    expect(!missing.ok && missing.errors).toEqual({ email: 'This field is required.' });
    expect(await validateSubmission(contact, { hasPhone: 'yes', phone: '0912345678' })).toEqual({
      ok: true,
      values: { hasPhone: 'yes', phone: '0912345678' },
    });
  });

  it('settles on circular conditions', () => {
    const circular: FormSchema = {
      id: 'c',
      pages: [{ index: 0, when: [] }],
      fields: [
        field({ name: 'a', type: 'text', when: [{ field: 'b', empty: true }] }),
        field({ name: 'b', type: 'text', when: [{ field: 'a', empty: true }] }),
        field({ name: 'c', type: 'text' }),
      ],
    };
    const { fields, values } = resolveVisibleFields(circular, { a: 'x', b: 'y', c: 'z' });
    expect(fields.map((f) => f.name)).toEqual(['c']);
    expect(values).toEqual({ c: 'z' });
  });

  it('reads answers coerced, as they are stored', () => {
    const schema: FormSchema = {
      id: 'k',
      pages: [{ index: 0, when: [] }],
      fields: [
        field({ name: 'code', type: 'text' }),
        field({ name: 'kids', type: 'number' }),
        field({ name: 'vip', type: 'text', when: [{ field: 'code', equals: 'VIP' }] }),
        field({ name: 'names', type: 'text', when: [{ field: 'kids', equals: 5 }] }),
      ],
    };
    const raw = { code: 'VIP ', kids: '05', vip: ' gold ', names: 'A, B' };
    expect(coerceValues(schema, raw)).toEqual({ code: 'VIP', kids: 5, vip: 'gold', names: 'A, B' });
    expect(
      resolveVisibleFields(schema, coerceValues(schema, raw)).fields.map((f) => f.name),
    ).toEqual(['code', 'kids', 'vip', 'names']);
    expect(submissionValues(schema, { ...raw, code: 'no' })).toEqual({
      code: 'no',
      kids: 5,
      names: 'A, B',
    });
  });
});

describe('validateSubmission', () => {
  it('requires conditional fields only when visible', async () => {
    const student = await validateSubmission(meetup, {
      name: 'Amy',
      email: 'amy@example.com',
      role: 'Student',
    });
    expect(student.ok).toBe(false);
    expect(!student.ok && student.errors).toEqual({ school: 'This field is required.' });

    const engineer = await validateSubmission(meetup, {
      name: ' Alex ',
      email: 'alex@example.com',
      role: 'Engineer',
      school: 'ignored',
    });
    expect(engineer).toEqual({
      ok: true,
      values: { name: 'Alex', email: 'alex@example.com', role: 'Engineer' },
    });
  });

  it('runs function and Standard Schema validators', async () => {
    const standard = {
      '~standard': {
        version: 1 as const,
        vendor: 'test',
        validate: (v: unknown) =>
          String(v).endsWith('.edu') ? { value: v } : { issues: [{ message: 'Use a .edu email' }] },
      },
    };
    const result = await validateSubmission(
      meetup,
      { name: 'Amy', email: 'amy@example.com', role: 'Engineer' },
      {
        validators: new Map<string, never>([
          ['email', standard as never],
          ['name', ((v: unknown) => (v === 'Amy' ? 'Taken' : undefined)) as never],
        ]),
      },
    );
    expect(!result.ok && result.errors).toEqual({ name: 'Taken', email: 'Use a .edu email' });
  });

  it('runs the validator of whichever same-named field is showing', async () => {
    const schema: FormSchema = {
      id: 'addr',
      pages: [{ index: 0, when: [] }],
      fields: [
        field({ name: 'country', type: 'text' }),
        field({ name: 'postal', type: 'text', when: [{ field: 'country', equals: 'US' }] }),
        field({ name: 'postal', type: 'text', when: [{ field: 'country', equals: 'CA' }] }),
      ],
    };
    const us = (v: unknown) => (/^\d{5}$/.test(String(v)) ? undefined : 'US zip');
    const ca = (v: unknown) =>
      /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(String(v)) ? undefined : 'CA postal';
    const postal = validatorForFields(
      schema.fields.slice(1).map((f, i) => ({ when: f.when, validator: [us, ca][i] })),
    );
    const validators = new Map([['postal', postal as NonNullable<typeof postal>]]);
    const check = (answers: Record<string, string>) =>
      validateSubmission(schema, answers, { validators });
    expect((await check({ country: 'CA', postal: 'K1A 0B1' })).ok).toBe(true);
    expect((await check({ country: 'US', postal: '10001' })).ok).toBe(true);
    const wrong = await check({ country: 'US', postal: 'K1A 0B1' });
    expect(!wrong.ok && wrong.errors).toEqual({ postal: 'US zip' });
  });

  it('stores false only where it is an answer', async () => {
    const schema: FormSchema = {
      id: 'f',
      pages: [{ index: 0, when: [] }],
      fields: [
        field({ name: 'age', type: 'number', min: 18 }),
        field({ name: 'news', type: 'checkbox' }),
        field({ name: 'toggle', type: 'custom' }),
      ],
    };
    expect(await validateSubmission(schema, { age: false, news: false, toggle: false })).toEqual({
      ok: true,
      values: { news: false, toggle: false },
    });
  });

  it('treats fields named like Object.prototype members as plain fields', async () => {
    const schema: FormSchema = {
      id: 'proto',
      pages: [{ index: 0, when: [] }],
      fields: [
        field({ name: 'constructor', type: 'text', required: true }),
        field({ name: 'valueOf', type: 'number' }),
        field({
          name: 'toString',
          type: 'text',
          when: [{ field: 'hasOwnProperty', filled: true }],
        }),
        field({ name: 'hasOwnProperty', type: 'text' }),
      ],
    };
    const empty = await validateSubmission(schema, {});
    expect(!empty.ok && empty.errors).toEqual({ constructor: 'This field is required.' });
    expect(
      await validateSubmission(schema, { constructor: 'Ada', valueOf: '3', toString: 'hidden' }),
    ).toEqual({ ok: true, values: { constructor: 'Ada', valueOf: 3 } });
    expect(evaluateCondition({ field: 'constructor', filled: true }, {})).toBe(false);
    expect(translate({ hello: 'hi' }, 'constructor')).toBe('constructor');
  });
});

describe('config helpers', () => {
  it('parses durations', () => {
    expect(parseDuration('2s')).toBe(2000);
    expect(parseDuration('10m')).toBe(600_000);
    expect(parseDuration(150)).toBe(150);
    expect(() => parseDuration('soon' as never)).toThrow();
  });

  it("accepts only 'read-only' for a public Studio", () => {
    expect(studioProblem(undefined)).toBeUndefined();
    expect(studioProblem({})).toBeUndefined();
    expect(studioProblem({ public: 'read-only' })).toBeUndefined();
    expect(studioProblem({ public: true })).toMatch(/studio\.public true/);
    expect(studioProblem('read-only')).toMatch(/object/);
  });

  it('merges protection layers over defaults', () => {
    expect(resolveProtection()).toEqual({
      honeypot: true,
      minimumCompletionTimeMs: 2000,
      rateLimit: { max: 10, windowMs: 600_000 },
    });
    expect(resolveProtection({ rateLimit: false }, { minimumCompletionTime: '5s' })).toEqual({
      honeypot: true,
      minimumCompletionTimeMs: 5000,
      rateLimit: null,
    });
  });

  it('treats date-only bounds as whole days in the form’s time zone', () => {
    const policy = { opensAt: '2026-10-01', closesAt: '2026-10-31' };
    const at = (iso: string, timeZone?: string) =>
      submissionWindow(policy, { now: Date.parse(iso), timeZone }).status;
    expect(at('2026-09-30T23:00:00Z')).toBe('not-open');
    expect(at('2026-10-31T23:59:00Z')).toBe('open');
    expect(at('2026-11-01T00:00:00Z')).toBe('closed');
    // Taipei is UTC+8: its 31 October ends at 15:59:59.999 UTC.
    expect(at('2026-09-30T16:00:00Z', 'Asia/Taipei')).toBe('open');
    expect(at('2026-10-31T15:59:59Z', 'Asia/Taipei')).toBe('open');
    expect(at('2026-10-31T16:00:00Z', 'Asia/Taipei')).toBe('closed');
  });

  it('reads wall-clock times in the zone and offsets as given', () => {
    const at = (closesAt: string) =>
      submissionWindow({ closesAt }, { timeZone: 'America/New_York' }).closesAt;
    expect(at('2026-07-01T18:30')).toBe(Date.parse('2026-07-01T22:30:00Z'));
    expect(at('2026-12-01T18:30')).toBe(Date.parse('2026-12-01T23:30:00Z'));
    expect(at('2026-07-01T18:30:00+08:00')).toBe(Date.parse('2026-07-01T10:30:00Z'));
    expect(at('2026-07-01T18:30:00Z')).toBe(Date.parse('2026-07-01T18:30:00Z'));
  });

  it('opens a day the clocks skip into at its first real instant', () => {
    const at = (zone: string, value: string, edge: 'start' | 'end' = 'start') =>
      new Date(policyInstant(value, zone, edge)).toISOString();
    // Santiago and Havana spring forward at midnight: the day starts at 01:00.
    expect(at('America/Santiago', '2026-09-06')).toBe('2026-09-06T04:00:00.000Z');
    expect(
      wallClock(Date.parse(at('America/Santiago', '2026-09-06')), 'America/Santiago'),
    ).toMatchObject({ day: 6, hour: 1, minute: 0 });
    expect(at('America/Santiago', '2026-09-05', 'end')).toBe('2026-09-06T03:59:59.999Z');
    expect(at('America/Havana', '2026-03-08')).toBe('2026-03-08T05:00:00.000Z');
    // 02:30 doesn't exist in New York on 8 March 2026: it means 03:30 EDT.
    expect(at('America/New_York', '2026-03-08T02:30')).toBe('2026-03-08T07:30:00.000Z');
    // 01:30 happens twice on 1 November 2026: the first, in EDT.
    expect(at('America/New_York', '2026-11-01T01:30')).toBe('2026-11-01T05:30:00.000Z');
    expect(at('America/Santiago', '2026-04-04', 'end')).toBe('2026-04-05T03:59:59.999Z');
  });

  it('rejects dates that are not dates', () => {
    for (const value of ['next friday', '2026-02-30', '2026-10-31T25:00', 'Oct 31 2026']) {
      expect(() => policyInstant(value, 'UTC', 'end')).toThrow(/Invalid date/);
    }
  });
});

describe('schedule overrides', () => {
  it('keeps only real changes and applies them over the code', () => {
    const code = { closesAt: '2026-10-31', maxResponses: 50, uniqueBy: 'email' };
    const next = parseSchedule(
      { closesAt: '2026-10-31T23:59:59.999', maxResponses: null, closed: true },
      'Asia/Taipei',
    );
    const changes = scheduleChanges(code, next, 'Asia/Taipei');
    expect(changes).toEqual({ maxResponses: null, closed: true });
    expect(applyOverrides(code, changes)).toEqual({
      closesAt: '2026-10-31',
      uniqueBy: 'email',
      closed: true,
    });
    expect(submissionWindow(applyOverrides(code, changes)).status).toBe('closed');
  });

  it("reads dates in Studio's zone, else the form's, else the project's", () => {
    const form = { timeZone: 'Asia/Tokyo' };
    expect(overriddenTimeZone(form, { timeZone: 'Asia/Taipei' }, 'UTC')).toBe('Asia/Taipei');
    expect(overriddenTimeZone(form, null, 'UTC')).toBe('Asia/Tokyo');
    expect(overriddenTimeZone({}, {}, 'Europe/Berlin')).toBe('Europe/Berlin');
    expect(overriddenTimeZone(undefined, null, undefined)).toBe('UTC');
  });
});

describe('time zones', () => {
  it('knows IANA zones', () => {
    expect(isTimeZone('Asia/Taipei')).toBe(true);
    expect(isTimeZone('UTC')).toBe(true);
    expect(isTimeZone('Taipei')).toBe(false);
    expect(timeZoneProblem('Asia/Tapei')).toMatch(/isn't an IANA time zone/);
  });

  it('splits policy dates into date and time in the zone', () => {
    expect(policyDateParts('2026-10-31', 'Asia/Taipei')).toEqual({
      date: '2026-10-31',
      time: null,
    });
    expect(policyDateParts('2026-10-31T09:05', 'Asia/Taipei')).toEqual({
      date: '2026-10-31',
      time: '09:05',
    });
    expect(policyDateParts('2026-10-31T20:00:00Z', 'Asia/Taipei')).toEqual({
      date: '2026-11-01',
      time: '04:00',
    });
  });

  it('labels offsets', () => {
    expect(timeZoneOffsetLabel('Asia/Taipei')).toBe('GMT+8');
    expect(timeZoneOffsetLabel('Asia/Kolkata')).toBe('GMT+5:30');
    expect(timeZoneOffsetLabel('UTC')).toBe('GMT');
    expect(timeZoneOffsetLabel('America/New_York', Date.parse('2026-01-15T12:00:00Z'))).toBe(
      'GMT-5',
    );
  });
});

describe('schemaVersion', () => {
  it('ignores key order and changes with content', () => {
    const a = schemaVersion({ id: 'x', pages: [], fields: [] });
    const b = schemaVersion({ fields: [], pages: [], id: 'x' } as FormSchema);
    const c = schemaVersion({ id: 'y', pages: [], fields: [] });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
    expect(a).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('themeToCss', () => {
  it('scopes tokens and emits a dark-mode block', () => {
    const css = themeToCss(
      { radius: '4px', colors: { primary: '#111' }, dark: { primary: '#eee' } },
      '[data-of-theme="x"]',
    );
    expect(css).toBe(
      '[data-of-theme="x"]{--of-radius:4px;--of-primary:#111}@media (prefers-color-scheme: dark){[data-of-theme="x"]{--of-primary:#eee}}',
    );
  });
});
