import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pglitePool } from '../../test/pglite-pool.ts';
import { storageContract, submit } from '../../test/storage-contract.ts';
import { connectionString, createPostgresStorage } from './index.ts';

// One PGlite for the file (it takes seconds to start); each store gets its own schema.
let shared: Awaited<ReturnType<typeof pglitePool>>;
let stores = 0;
beforeAll(async () => {
  shared = await pglitePool();
}, 60_000);
afterAll(() => shared.end());

storageContract('postgres (PGlite)', () =>
  createPostgresStorage({ pool: shared, schema: `store_${stores++}` }),
);

// CI runs these against a real server too: OPEN_FORM_TEST_POSTGRES_URL=postgres://…
const url = process.env.OPEN_FORM_TEST_POSTGRES_URL;
if (url) {
  let n = 0;
  const admin = new pg.Pool({ connectionString: url });
  afterAll(() => admin.end());
  storageContract('postgres', async () => {
    const schema = `open_form_test_${process.pid}_${n++}`;
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    const storage = await createPostgresStorage({ url, schema });
    const close = storage.close;
    storage.close = async () => {
      await close();
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    };
    return storage;
  });

  describe('postgres server', () => {
    it('migrates once when many servers start together', async () => {
      const schema = `open_form_test_${process.pid}_start`;
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
      const all = await Promise.all(
        Array.from({ length: 4 }, () => createPostgresStorage({ url, schema })),
      );
      await submit(all[0] as (typeof all)[number], { name: 'Amy' });
      expect(await all[3]?.countSubmissions('f')).toBe(1);
      expect((await all[1]?.info?.())?.schemaVersion).toBe(1);
      await Promise.all(all.map((storage) => storage.close()));
      await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    });
  });
}

describe('postgres storage', () => {
  it('keeps its tables in their own schema', async () => {
    const pool = shared;
    const storage = await createPostgresStorage({ pool, schema: 'forms' });
    await submit(storage, { name: 'Amy' });
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'forms' ORDER BY 1`,
    );
    expect(rows.map((row) => row.table_name)).toContain('submissions');
    const reopened = await createPostgresStorage({ pool, schema: 'forms' });
    expect(await reopened.countSubmissions('f')).toBe(1);
    expect(await reopened.info?.()).toMatchObject({ schemaVersion: 1, location: 'schema forms' });
  });

  it('searches past an answer that jsonb cannot hold', async () => {
    const storage = await createPostgresStorage({ pool: shared, schema: 'nul' });
    await submit(storage, { name: 'nul \u0000 byte' });
    await submit(storage, { name: 'needle in a haystack' });
    const page = await storage.listSubmissions('f', { search: 'needle' });
    expect(page.items.map((s) => s.data.name)).toEqual(['needle in a haystack']);
    expect((await storage.listSubmissions('f', {})).total).toBe(2);
  });

  it('says what went wrong when it cannot connect, without the password', async () => {
    const error = await createPostgresStorage({
      url: 'postgres://app:hunter2@127.0.0.1:1/forms',
    }).catch((err: Error) => err);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/^Couldn't connect to Postgres: \S/);
    expect((error as Error).message).not.toContain('hunter2');
  });

  it('refuses a schema name it would have to quote', async () => {
    await expect(createPostgresStorage({ pool: shared, schema: 'x"; DROP' })).rejects.toThrow(
      'Invalid Postgres schema',
    );
  });

  it('leaves a pool it was given open', async () => {
    const storage = await createPostgresStorage({ pool: shared, schema: 'given' });
    await storage.close();
    expect((await shared.query('SELECT 1 AS one')).rows).toEqual([{ one: 1 }]);
  });
});

describe('connectionString', () => {
  it('verifies certificates on remote servers unless the URL says otherwise', () => {
    expect(connectionString('postgres://u:p@db.example.com/app').url).toBe(
      'postgres://u:p@db.example.com/app?sslmode=verify-full',
    );
    expect(connectionString('postgres://u:p@db.example.com/app?sslmode=no-verify').url).toBe(
      'postgres://u:p@db.example.com/app?sslmode=no-verify',
    );
    expect(connectionString('postgres://u:p@localhost:5432/app').url).toBe(
      'postgres://u:p@localhost:5432/app',
    );
    expect(connectionString('postgresql://u@/app?host=/var/run/postgresql').url).toBe(
      'postgresql://u@/app?host=/var/run/postgresql',
    );
  });

  it('refuses a # rather than connecting to the wrong host without TLS', () => {
    expect(() => connectionString('postgres://u:12#x@db.example.com/app')).toThrow('%23');
    expect(() => connectionString('postgres://u:12#x@db.example.com/app')).not.toThrow('12#x');
    expect(() => connectionString('postgres://u:p q@db example.com/app')).toThrow(
      "can't be parsed",
    );
  });

  it('warns about unencrypted remote connections', () => {
    expect(connectionString('postgres://u:p@db.example.com/app?sslmode=disable').warning).toMatch(
      'unencrypted',
    );
  });
});
