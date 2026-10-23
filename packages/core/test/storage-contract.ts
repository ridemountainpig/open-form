import { describe, expect, it } from 'vitest';
import type { FormValues } from '../src/schema/index.ts';
import type { StorageAdapter } from '../src/storage/index.ts';

export async function submit(storage: StorageAdapter, data: FormValues, formId = 'f') {
  const version = await storage.ensureFormVersion(formId, 'v1', {
    id: formId,
    pages: [],
    fields: [],
  });
  const created = await storage.createSubmission({ formId, formVersionId: version.id, data });
  if (!created.ok) throw new Error('not created');
  return created.submission;
}

/** What every `StorageAdapter` must do the same way. `open` returns a fresh, empty store. */
export function storageContract(name: string, open: () => Promise<StorageAdapter>): void {
  describe(`${name} storage`, () => {
    it('remembers revoked sessions until they expire', async () => {
      const storage = await open();
      await storage.revokeSession('old', 1_000, 0);
      await storage.revokeSession('current', 5_000, 0);
      expect(await storage.isSessionRevoked('old')).toBe(true);
      expect(await storage.isSessionRevoked('never')).toBe(false);

      await storage.revokeSession('current', 5_000, 2_000);
      expect(await storage.isSessionRevoked('old')).toBe(false);
      expect(await storage.isSessionRevoked('current')).toBe(true);
      await storage.close();
    });
    it('never hands a deleted response number to the next response', async () => {
      const storage = await open();
      await submit(storage, { name: 'Amy' });
      const second = await submit(storage, { name: 'Ben' });
      expect(second.number).toBe(2);
      await storage.deleteSubmission('f', second.id);
      expect((await submit(storage, { name: 'Cleo' })).number).toBe(3);
      expect((await submit(storage, { name: 'Dee' }, 'other')).number).toBe(1);
      await storage.close();
    });

    it('deletes everything a form stored, and only that form', async () => {
      const storage = await open();
      await submit(storage, { name: 'Amy' });
      await submit(storage, { name: 'Ben' });
      await submit(storage, { name: 'Cleo' }, 'other');
      await storage.setFormOverrides('f', { submissions: { closed: true } });

      expect(await storage.deleteForm('f')).toBe(2);
      expect(await storage.countSubmissions('f')).toBe(0);
      expect(await storage.listFormVersions('f')).toEqual([]);
      expect(await storage.getFormOverrides('f')).toBeNull();
      expect(await storage.countSubmissions('other')).toBe(1);
      // A new form with the same id starts over at #1.
      expect((await submit(storage, { name: 'Dee' })).number).toBe(1);
      expect(await storage.deleteForm('missing')).toBe(0);
      await storage.close();
    });

    it('searches the answers, not the field names', async () => {
      const storage = await open();
      await submit(storage, { name: 'Amy', email: 'amy@example.com', topics: ['Design', 'AI'] });
      await submit(storage, { name: 'Ben', email: 'ben@example.com', guests: 3 });
      const search = async (q: string) =>
        (await storage.listSubmissions('f', { search: q, order: 'asc' })).items.map(
          (s) => s.data.name,
        );
      expect(await search('email')).toEqual([]);
      expect(await search('NAME')).toEqual([]);
      expect(await search('example.com')).toEqual(['Amy', 'Ben']);
      expect(await search('design')).toEqual(['Amy']);
      expect(await search('3')).toEqual(['Ben']);
      expect(await search('%')).toEqual([]);
      await storage.close();
    });

    it('filters and pages with the filter applied, alongside search', async () => {
      const storage = await open();
      await submit(storage, { name: 'Amy', plan: 'pro', seats: 3 });
      await submit(storage, { name: 'Ben', plan: 'free', seats: 12 });
      await submit(storage, { name: 'Cleo', plan: 'pro', seats: 40 });
      await submit(storage, { name: 'Dee', plan: 'pro' });
      const filter = {
        rules: [
          { field: 'plan', op: 'anyOf' as const, values: ['pro'] },
          { field: 'seats', op: 'notEmpty' as const },
        ],
      };
      const page = await storage.listSubmissions('f', { filter, limit: 1, offset: 1 });
      expect(page.total).toBe(2);
      expect(page.items.map((s) => s.data.name)).toEqual(['Amy']);
      const both = await storage.listSubmissions('f', { filter, search: 'cle' });
      expect(both.items.map((s) => s.data.name)).toEqual(['Cleo']);
      const any = await storage.listSubmissions('f', {
        filter: { match: 'any', rules: [{ field: 'seats', op: 'gt' as const, value: 20 }] },
        order: 'asc',
      });
      expect(any.items.map((s) => s.data.name)).toEqual(['Cleo']);
      await storage.close();
    });

    it('sorts by an answer, empty answers last, pages after sorting', async () => {
      const storage = await open();
      await submit(storage, { name: 'amy', level: 'senior', seats: 3 });
      await submit(storage, { name: 'Ben', level: 'junior', seats: 12 });
      await submit(storage, { name: 'cleo', seats: 'x' });
      await submit(storage, { name: 'Dee', level: 'mid' });
      await submit(storage, { name: 'Eve', level: 'junior', seats: 12 });
      const names = async (sort: {
        field?: string;
        direction: 'asc' | 'desc';
        values?: string[];
      }) => (await storage.listSubmissions('f', { sort })).items.map((s) => s.data.name);
      expect(await names({ field: 'name', direction: 'asc' })).toEqual([
        'amy',
        'Ben',
        'cleo',
        'Dee',
        'Eve',
      ]);
      // Numbers before text, empty last; ties newest first.
      expect(await names({ field: 'seats', direction: 'desc' })).toEqual([
        'cleo',
        'Eve',
        'Ben',
        'amy',
        'Dee',
      ]);
      const values = ['junior', 'mid', 'senior'];
      expect(await names({ field: 'level', direction: 'asc', values })).toEqual([
        'Eve',
        'Ben',
        'Dee',
        'amy',
        'cleo',
      ]);
      expect(await names({ direction: 'asc' })).toEqual(['amy', 'Ben', 'cleo', 'Dee', 'Eve']);
      const page = await storage.listSubmissions('f', {
        sort: { field: 'name', direction: 'desc' },
        filter: { rules: [{ field: 'level', op: 'notEmpty' }] },
        limit: 2,
        offset: 1,
      });
      expect(page.total).toBe(4);
      expect(page.items.map((s) => s.data.name)).toEqual(['Dee', 'Ben']);
      await storage.close();
    });

    it('keeps one version per form and version string', async () => {
      const storage = await open();
      const schema = { id: 'f', pages: [], fields: [] };
      const [a, b] = await Promise.all([
        storage.ensureFormVersion('f', 'v1', schema),
        storage.ensureFormVersion('f', 'v1', schema),
      ]);
      expect(a.id).toBe(b.id);
      await storage.ensureFormVersion('f', 'v2', schema);
      await storage.ensureFormVersion('other', 'v1', schema);
      expect((await storage.listFormVersions('f')).map((v) => v.version)).toEqual(['v1', 'v2']);
      expect(await storage.getFormVersion(a.id)).toEqual(a);
      expect(await storage.getFormVersion('missing')).toBeNull();
      await storage.close();
    });

    it('returns a response as it was submitted', async () => {
      const storage = await open();
      const version = await storage.ensureFormVersion('f', 'v1', {
        id: 'f',
        pages: [],
        fields: [],
      });
      const data = { name: '林小美', guests: 2, topics: ['AI', 'Design'], agree: true, note: null };
      const created = await storage.createSubmission({
        formId: 'f',
        formVersionId: version.id,
        data,
        visitorHash: 'visitor',
        locale: 'zh-TW',
      });
      if (!created.ok) throw new Error('not created');
      const stored = await storage.getSubmission('f', created.submission.id);
      expect(stored).toEqual(created.submission);
      expect(Object.keys(stored?.data ?? {})).toEqual(Object.keys(data));
      expect(stored).toMatchObject({ number: 1, visitorHash: 'visitor', locale: 'zh-TW' });
      expect(await storage.getSubmission('other', created.submission.id)).toBeNull();
      await storage.close();
    });

    it('never takes more responses than maxResponses, even all at once', async () => {
      const storage = await open();
      const version = await storage.ensureFormVersion('f', 'v1', {
        id: 'f',
        pages: [],
        fields: [],
      });
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          storage.createSubmission(
            { formId: 'f', formVersionId: version.id, data: { i } },
            { maxResponses: 3 },
          ),
        ),
      );
      expect(results.filter((r) => r.ok)).toHaveLength(3);
      expect(results.filter((r) => !r.ok && r.reason === 'full')).toHaveLength(5);
      const numbers = (await storage.listSubmissions('f', { order: 'asc' })).items.map(
        (s) => s.number,
      );
      expect(numbers).toEqual([1, 2, 3]);
      await storage.close();
    });

    it('takes one response per unique key, even all at once', async () => {
      const storage = await open();
      const version = await storage.ensureFormVersion('f', 'v1', {
        id: 'f',
        pages: [],
        fields: [],
      });
      const input = { formId: 'f', formVersionId: version.id, data: {}, uniqueKey: 'email:a@b.co' };
      const results = await Promise.all([1, 2, 3].map(() => storage.createSubmission(input)));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      expect(results.filter((r) => !r.ok && r.reason === 'duplicate')).toHaveLength(2);
      expect(await storage.hasUniqueKey('f', 'email:a@b.co')).toBe(true);
      expect(await storage.hasUniqueKey('other', 'email:a@b.co')).toBe(false);
      expect((await storage.createSubmission({ ...input, formId: 'other' })).ok).toBe(true);
      await storage.close();
    });

    it('counts responses per form and knows the newest', async () => {
      const storage = await open();
      await submit(storage, { name: 'Amy' });
      const last = await submit(storage, { name: 'Ben' });
      const other = await submit(storage, { name: 'Cleo' }, 'other');
      expect(await storage.countSubmissions('f')).toBe(2);
      expect(await storage.countsByForm()).toEqual({ f: 2, other: 1 });
      expect(await storage.latestByForm?.()).toEqual({ f: last.createdAt, other: other.createdAt });
      expect(await storage.deleteSubmission('f', last.id)).toBe(true);
      expect(await storage.deleteSubmission('f', last.id)).toBe(false);
      expect(await storage.countSubmissions('f')).toBe(1);
      await storage.close();
    });

    it('stores Studio overrides per form', async () => {
      const storage = await open();
      expect(await storage.getFormOverrides('f')).toBeNull();
      await storage.setFormOverrides('f', {
        submissions: { maxResponses: 10 },
        timeZone: 'Asia/Taipei',
      });
      await storage.setFormOverrides('f', { submissions: { closed: true } });
      const stored = await storage.getFormOverrides('f');
      expect(stored).toMatchObject({ submissions: { closed: true } });
      expect(stored?.timeZone).toBeUndefined();
      expect(typeof stored?.updatedAt).toBe('string');
      expect(Object.keys(await storage.listFormOverrides())).toEqual(['f']);
      await storage.setFormOverrides('f', null);
      expect(await storage.getFormOverrides('f')).toBeNull();
      await storage.close();
    });

    it('counts rate limit hits per key and window', async () => {
      const storage = await open();
      expect(await storage.hitRateLimit('k', 1_000, 10)).toBe(1);
      expect(await storage.hitRateLimit('k', 1_000, 999)).toBe(2);
      expect(await storage.hitRateLimit('other', 1_000, 999)).toBe(1);
      expect(await storage.hitRateLimit('k', 1_000, 1_000)).toBe(1);
      await storage.close();
    });
  });
}
