import { PGlite } from '@electric-sql/pglite';
import type { PostgresPool, PostgresQueryable } from '../src/postgres/index.ts';

/**
 * A `pg`-style pool over an in-process PGlite, so the Postgres adapter's tests
 * run without a server. PGlite has one connection: a checked-out client holds it.
 */
export async function pglitePool(): Promise<PostgresPool & { db: PGlite }> {
  const db = await PGlite.create();
  let queue: Promise<void> = Promise.resolve();
  const exclusive = () => {
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = queue;
    queue = queue.then(() => held);
    return ready.then(() => release);
  };
  const run: PostgresQueryable['query'] = async (text, values) => {
    const result = await db.query<Record<string, unknown>>(text, values);
    return { rows: result.rows, rowCount: result.affectedRows ?? result.rows.length };
  };
  return {
    db,
    async query(text, values) {
      const release = await exclusive();
      try {
        return await run(text, values);
      } finally {
        release();
      }
    },
    async connect() {
      const release = await exclusive();
      return { query: run, release };
    },
    async end() {
      await db.close();
    },
  };
}
