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
import { storageContract, submit } from '../../test/storage-contract.ts';
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

storageContract('sqlite', () => createSqliteStorage({ path: ':memory:' }));

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
