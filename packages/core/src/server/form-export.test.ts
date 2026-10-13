import { describe, expect, it } from 'vitest';
import type { FormSchema } from '../schema/index.ts';
import { createMemoryStorage } from '../storage/index.ts';
import { exportFormResponses } from './form-export.ts';
import type { FormDefinition } from './handler.ts';

function schema(label: string): FormSchema {
  return {
    id: 'rsvp',
    pages: [],
    fields: [{ name: 'name', type: 'text', label, page: 0, when: [] }],
  };
}

async function storageWith(locales: Array<string | null>) {
  const storage = createMemoryStorage();
  const version = await storage.ensureFormVersion('rsvp', 'v1', schema('Old name'));
  for (const locale of locales) {
    await storage.createSubmission({
      formId: 'rsvp',
      formVersionId: version.id,
      data: { name: 'Amy' },
      locale,
    });
  }
  return storage;
}

function definition(translations?: FormDefinition['config']['translations']): FormDefinition {
  return {
    id: 'rsvp',
    schema: schema('Name'),
    config: { locale: 'zh-TW', translations },
  } as FormDefinition;
}

describe('exportFormResponses', () => {
  it("adds the Language column for translated forms and uses the code's current labels", async () => {
    const storage = await storageWith(['en', 'zh-TW']);
    const { body, count } = await exportFormResponses({
      storage,
      formId: 'rsvp',
      format: 'csv',
      definition: definition({ en: { 姓名: 'Name' } }),
    });
    expect(count).toBe(2);
    const csv = String(body);
    expect(csv).toContain('#,Submitted at,Language,Name\r\n');
    expect(csv).toContain(',en,Amy\r\n');
  });

  it('leaves the Language column out when the form no longer loads or has no translations', async () => {
    const storage = await storageWith(['en']);
    for (const def of [null, definition()]) {
      const { body } = await exportFormResponses({
        storage,
        formId: 'rsvp',
        format: 'csv',
        definition: def,
      });
      expect(String(body)).toContain(`#,Submitted at,${def ? 'Name' : 'Old name'}\r\n`);
    }
  });

  it('exports Excel and JSON', async () => {
    const storage = await storageWith(['en']);
    const xlsx = await exportFormResponses({
      storage,
      formId: 'rsvp',
      format: 'xlsx',
      definition: definition({ en: {} }),
    });
    expect([...(xlsx.body as Uint8Array).slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const json = await exportFormResponses({
      storage,
      formId: 'rsvp',
      format: 'json',
      definition: null,
    });
    expect(JSON.parse(String(json.body))).toEqual([
      expect.objectContaining({ number: 1, locale: 'en', data: { name: 'Amy' } }),
    ]);
  });
});
