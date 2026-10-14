import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FormValues } from '../schema/index.ts';
import { createMemoryStorage, type StorageAdapter } from '../storage/index.ts';
import { createSqliteStorage } from './index.ts';

let root: string;
const posix = process.platform !== 'win32';
const mode = (file: string) => statSync(file).mode & 0o777;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-sqlite-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

async function storageWithResponse(file: string) {
  const storage = await createSqliteStorage({ path: file });
  const version = await storage.ensureFormVersion('f', 'v1', { id: 'f', pages: [], fields: [] });
  const created = await storage.createSubmission({
    formId: 'f',
    formVersionId: version.id,
    data: { email: 'erase-me-7c1d@example.com' },
    uniqueKey: 'email:erase-me-7c1d@example.com',
  });
  if (!created.ok) throw new Error('not created');
  return { storage, id: created.submission.id };
}

const copiesOnDisk = (file: string) =>
  [file, `${file}-wal`]
    .map((f) => {
      try {
        return readFileSync(f).toString('latin1').split('erase-me-7c1d').length - 1;
      } catch {
        return 0;
      }
    })
    .reduce((a, b) => a + b, 0);

async function submit(storage: StorageAdapter, data: FormValues, formId = 'f') {
  const version = await storage.ensureFormVersion(formId, 'v1', {
    id: formId,
    pages: [],
    fields: [],
  });
  const created = await storage.createSubmission({ formId, formVersionId: version.id, data });
  if (!created.ok) throw new Error('not created');
  return created.submission;
}

describe.each([
  ['sqlite', () => createSqliteStorage({ path: ':memory:' })],
  ['memory', async () => createMemoryStorage()],
])('%s storage', (_name, open) => {
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
    const names = async (sort: { field?: string; direction: 'asc' | 'desc'; values?: string[] }) =>
      (await storage.listSubmissions('f', { sort })).items.map((s) => s.data.name);
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
});

describe('sqlite search', () => {
  it('skips answers too deep for json_tree instead of failing the search', async () => {
    const storage = await createSqliteStorage({ path: ':memory:' });
    let deep: unknown = 'needle';
    for (let i = 0; i < 1500; i++) deep = [deep];
    await submit(storage, { name: deep as string });
    await submit(storage, { name: 'needle in a haystack' });
    const page = await storage.listSubmissions('f', { search: 'needle' });
    expect(page.items.map((s) => s.data.name)).toEqual(['needle in a haystack']);
    await storage.close();
  });
});

describe('sqlite storage on disk', () => {
  it('continues numbering from existing responses when it adds the counters', async () => {
    const file = path.join(root, 'open-form.db');
    const storage = await createSqliteStorage({ path: file });
    for (const name of ['Amy', 'Ben', 'Cleo']) await submit(storage, { name });
    await storage.close();

    // Roll the file back to before the counters existed.
    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec(`DROP TABLE form_counters; DROP TABLE revoked_sessions;
             UPDATE meta SET value = '3' WHERE key = 'schema_version';`);
    db.close();

    const upgraded = await createSqliteStorage({ path: file });
    expect((await submit(upgraded, { name: 'Dee' })).number).toBe(4);
    await upgraded.close();
  });

  it('never repeats a number when an older version wrote past the counter', async () => {
    const file = path.join(root, 'open-form.db');
    const storage = await createSqliteStorage({ path: file });
    await submit(storage, { name: 'Amy' });
    await storage.close();

    const { DatabaseSync } = await import('node:sqlite');
    const db = new DatabaseSync(file);
    db.exec(`INSERT INTO submissions (id, form_id, number, form_version_id, data, created_at, updated_at)
             SELECT 'old', form_id, 2, form_version_id, '{}', created_at, updated_at FROM submissions`);
    db.close();

    const reopened = await createSqliteStorage({ path: file });
    expect((await submit(reopened, { name: 'Ben' })).number).toBe(3);
    await reopened.close();
  });

  it('keeps revoked sessions across restarts', async () => {
    const file = path.join(root, '.open-form', 'open-form.db');
    const storage = await createSqliteStorage({ path: file });
    await storage.revokeSession('signed-out', Date.now() + 60_000);
    await storage.close();
    const reopened = await createSqliteStorage({ path: file });
    expect(await reopened.isSessionRevoked('signed-out')).toBe(true);
    await reopened.close();
  });

  it('erases a deleted response from the database and its WAL', async () => {
    const file = path.join(root, '.open-form', 'open-form.db');
    const { storage, id } = await storageWithResponse(file);
    expect(copiesOnDisk(file)).toBeGreaterThan(0);
    expect(await storage.deleteSubmission('f', id)).toBe(true);
    expect(copiesOnDisk(file)).toBe(0);
    await storage.close();
    expect(copiesOnDisk(file)).toBe(0);
  });

  it('erases the responses of a deleted form from the database and its WAL', async () => {
    const file = path.join(root, '.open-form', 'open-form.db');
    const { storage } = await storageWithResponse(file);
    expect(await storage.deleteForm('f')).toBe(1);
    expect(copiesOnDisk(file)).toBe(0);
    await storage.close();
  });

  it.runIf(posix)('keeps the data folder and files private to their owner', async () => {
    const file = path.join(root, '.open-form', 'open-form.db');
    const { storage } = await storageWithResponse(file);
    expect(mode(path.dirname(file))).toBe(0o700);
    expect(mode(file)).toBe(0o600);
    expect(mode(`${file}-wal`)).toBe(0o600);
    expect(mode(`${file}-shm`)).toBe(0o600);
    await storage.close();
  });

  it.runIf(posix)('tightens a database that was readable by everyone', async () => {
    const dir = path.join(root, '.open-form');
    const file = path.join(dir, 'open-form.db');
    mkdirSync(dir, { mode: 0o755 });
    chmodSync(dir, 0o755);
    writeFileSync(file, '');
    chmodSync(file, 0o644);
    const storage = await createSqliteStorage({ path: file });
    expect(mode(dir)).toBe(0o700);
    expect(mode(file)).toBe(0o600);
    await storage.close();
  });
});
