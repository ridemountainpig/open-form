import { describe, expect, it } from 'vitest';
import type { FieldSchema, FormSchema } from '../schema/index.ts';
import { uniqueWarnings } from './check.ts';

const email = (extra: Partial<FieldSchema> = {}): FieldSchema => ({
  name: 'email',
  type: 'email',
  page: 0,
  when: [],
  ...extra,
});
const form = (field: FieldSchema, uniqueBy = 'email') => ({
  schema: { id: 'f', pages: [{ index: 0, when: [] }], fields: [field] } as FormSchema,
  config: { submissions: { uniqueBy } },
});

describe('uniqueWarnings', () => {
  it('flags a uniqueBy field that can be left blank or hidden', () => {
    expect(uniqueWarnings(form(email({ required: true })))).toEqual([]);
    expect(uniqueWarnings(form(email()))[0]).toMatch(/blank or hidden/);
    expect(
      uniqueWarnings(form(email({ required: true, when: [{ field: 'x', equals: 'y' }] })))[0],
    ).toMatch(/blank or hidden/);
    expect(uniqueWarnings(form(email(), 'phone'))[0]).toMatch(/isn't a field/);
    expect(uniqueWarnings(form(email(), 'device'))).toEqual([]);
  });
});
