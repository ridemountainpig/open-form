import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import pg from 'pg';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { submit } from '../../test/storage-contract.ts';
import { createPostgresStorage } from '../postgres/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';
import { copyDatabase } from './db.ts';

const ENV = ['OPEN_FORM_DATABASE_URL', 'OPEN_FORM_DB'] as const;
const inherited = Object.fromEntries(ENV.map((key) => [key, process.env[key]]));
let root: string;

beforeEach(() => {
  for (const key of ENV) delete process.env[key];
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-db-'));
});
afterEach(() => {
  for (const key of ENV) {
    if (inherited[key] === undefined) delete process.env[key];
    else process.env[key] = inherited[key];
  }
  rmSync(root, { recursive: true, force: true });
});

async function seedSqlite(file = path.join(root, '.open-form', 'open-form.db')) {
  const storage = await createSqliteStorage({ path: file });
  await submit(storage, { name: 'Amy' });
  const ben = await submit(storage, { name: 'Ben' });
  await storage.deleteSubmission('f', ben.id);
  await submit(storage, { name: 'Cleo' }, 'other');
  await storage.setFormOverrides('f', { submissions: { closed: true } });
  await storage.close();
}

describe('open-form db copy', () => {
  it('needs a Postgres database to copy into', async () => {
    await seedSqlite();
    await expect(copyDatabase(root)).rejects.toThrow('OPEN_FORM_DATABASE_URL');
  });

  it('says so when there is no SQLite file', async () => {
    process.env.OPEN_FORM_DATABASE_URL = 'postgres://u:secret@localhost:1/db';
    await expect(copyDatabase(root)).rejects.toThrow('no SQLite database at .open-form');
  });

  it('only counts on a dry run, without connecting', async () => {
    await seedSqlite();
    process.env.OPEN_FORM_DATABASE_URL = 'postgres://u:secret@localhost:1/db';
    const result = await copyDatabase(root, { dryRun: true });
    expect(result).toEqual({
      from: path.join('.open-form', 'open-form.db'),
      to: 'postgres://u:***@localhost:1/db',
      responses: { f: 1, other: 1 },
      settings: ['f'],
      copied: false,
    });
  });

  const admin = process.env.OPEN_FORM_TEST_POSTGRES_URL;
  describe.skipIf(!admin)('into a real Postgres database', () => {
    const name = `open_form_copy_${process.pid}`;
    const url = () => {
      const parsed = new URL(admin as string);
      parsed.pathname = `/${name}`;
      return parsed.toString();
    };
    const run = async (sql: string) => {
      const client = new pg.Client({ connectionString: admin });
      await client.connect();
      try {
        await client.query(sql);
      } finally {
        await client.end();
      }
    };
    beforeEach(() => run(`CREATE DATABASE ${name}`));
    afterEach(() => run(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`));

    it('copies responses, numbering and Studio settings once', async () => {
      await seedSqlite(path.join(root, 'legacy.db'));
      process.env.OPEN_FORM_DATABASE_URL = url();
      const result = await copyDatabase(root, { from: 'legacy.db' });
      expect(result).toMatchObject({ copied: true, responses: { f: 1, other: 1 } });

      const storage = await createPostgresStorage({ url: url() });
      try {
        expect(await storage.countsByForm()).toEqual({ f: 1, other: 1 });
        expect(await storage.getFormOverrides('f')).toMatchObject({
          submissions: { closed: true },
        });
        expect((await submit(storage, { name: 'Dee' })).number).toBe(3);
      } finally {
        await storage.close();
      }
      await expect(copyDatabase(root, { from: 'legacy.db' })).rejects.toThrow(
        'already has responses',
      );
    });
  });
});
