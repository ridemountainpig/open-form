import type { FormOverrides, FormSchema, FormValues } from '../schema/index.ts';
import type {
  CreateSubmissionResult,
  FormVersionRecord,
  StorageAdapter,
  StoredOverrides,
  StoredSubmission,
} from '../storage/index.ts';
import { pageSubmissions } from '../storage/list.ts';

type QueryResult = { rows: Record<string, unknown>[]; rowCount: number | null };

export type PostgresQueryable = {
  query(text: string, values?: unknown[]): Promise<QueryResult>;
};

/** What Open Form needs from a `pg` `Pool`; Neon's serverless `Pool` fits too. */
export type PostgresPool = PostgresQueryable & {
  connect(): Promise<PostgresQueryable & { release(err?: Error | boolean): void }>;
  end(): Promise<void>;
};

export type PostgresStorageOptions = {
  /** `postgres://user:password@host:5432/db`. Read it from the environment, never from source. */
  url?: string;
  /** Your own pool instead of `url`. Open Form leaves it open on `close()`. */
  pool?: PostgresPool;
  /** Where Open Form keeps its tables. Default `open_form`, apart from your own in `public`. */
  schema?: string;
};

const SCHEMA_RE = /^[a-z_][a-z0-9_]{0,62}$/;

const MIGRATIONS: Array<(s: string) => string[]> = [
  (s) => [
    `CREATE TABLE ${s}.form_versions (
       id TEXT PRIMARY KEY,
       form_id TEXT NOT NULL,
       version TEXT NOT NULL,
       schema JSON NOT NULL,
       created_at TEXT NOT NULL,
       UNIQUE (form_id, version)
     )`,
    // JSON, not JSONB: answers come back with their keys in the order they were given.
    `CREATE TABLE ${s}.submissions (
       id TEXT PRIMARY KEY,
       form_id TEXT NOT NULL,
       number INTEGER NOT NULL,
       form_version_id TEXT NOT NULL REFERENCES ${s}.form_versions (id),
       data JSON NOT NULL,
       visitor_hash TEXT,
       locale TEXT,
       unique_key TEXT,
       created_at TEXT NOT NULL,
       updated_at TEXT NOT NULL
     )`,
    `CREATE UNIQUE INDEX submissions_form_number ON ${s}.submissions (form_id, number)`,
    `CREATE INDEX submissions_form_visitor ON ${s}.submissions (form_id, visitor_hash)`,
    `CREATE UNIQUE INDEX submissions_form_unique ON ${s}.submissions (form_id, unique_key)
       WHERE unique_key IS NOT NULL`,
    `CREATE TABLE ${s}.submission_files (
       id TEXT PRIMARY KEY,
       submission_id TEXT NOT NULL REFERENCES ${s}.submissions (id) ON DELETE CASCADE,
       field_name TEXT NOT NULL,
       storage_key TEXT NOT NULL,
       filename TEXT NOT NULL,
       mime_type TEXT NOT NULL,
       size BIGINT NOT NULL,
       created_at TEXT NOT NULL
     )`,
    `CREATE TABLE ${s}.rate_limits (
       key_hash TEXT NOT NULL,
       window_start BIGINT NOT NULL,
       count INTEGER NOT NULL,
       expires_at BIGINT NOT NULL,
       PRIMARY KEY (key_hash, window_start)
     )`,
    `CREATE INDEX rate_limits_expires ON ${s}.rate_limits (expires_at)`,
    `CREATE TABLE ${s}.form_overrides (
       form_id TEXT PRIMARY KEY,
       data JSON NOT NULL,
       updated_at TEXT NOT NULL
     )`,
    `CREATE TABLE ${s}.form_counters (
       form_id TEXT PRIMARY KEY,
       last_number INTEGER NOT NULL
     )`,
    `CREATE TABLE ${s}.revoked_sessions (
       id TEXT PRIMARY KEY,
       expires_at BIGINT NOT NULL
     )`,
  ],
];

const LOCAL_HOSTS = new Set(['', 'localhost', '127.0.0.1', '[::1]', '::1']);

function isLocalHost(url: URL): boolean {
  const host = url.searchParams.get('host') ?? url.hostname;
  return LOCAL_HOSTS.has(host) || host.startsWith('/') || host.endsWith('.localhost');
}

/**
 * Remote connections verify the server's certificate unless the URL says otherwise:
 * a connection string without `sslmode` would otherwise send answers in the clear.
 */
export function connectionString(url: string): { url: string; warning?: string } {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Socket paths (`postgres://user@/db?host=/var/run/postgresql`) are pg's to parse.
    return { url };
  }
  if (isLocalHost(parsed)) return { url };
  const sslmode = parsed.searchParams.get('sslmode');
  if (sslmode === 'disable') {
    return {
      url,
      warning: `Postgres at ${parsed.hostname} has sslmode=disable: responses travel unencrypted.`,
    };
  }
  if (sslmode || parsed.searchParams.has('ssl')) return { url };
  parsed.searchParams.set('sslmode', 'verify-full');
  return { url: parsed.toString() };
}

async function createPool(url: string): Promise<PostgresPool> {
  let pg: typeof import('pg');
  try {
    pg = await import('pg');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error('Postgres storage needs the `pg` package. Add it with `pnpm add pg`.');
    }
    throw err;
  }
  const { url: connection, warning } = connectionString(url);
  if (warning) console.warn(`[open-form] ${warning}`);
  const Pool = pg.Pool ?? (pg as unknown as { default: typeof pg }).default.Pool;
  const pool = new Pool({ connectionString: connection, connectionTimeoutMillis: 10_000 });
  // An idle client losing its connection would otherwise crash the server.
  pool.on('error', (err) => console.error(`[open-form] Postgres: ${err.message}`));
  return pool as unknown as PostgresPool;
}

function connectError(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  const hint = /certificate/i.test(message)
    ? " The server's TLS certificate didn't verify: add your provider's CA with `sslrootcert=` (https://open-form.build/docs/deploy/postgres)."
    : '';
  return new Error(`Couldn't connect to Postgres: ${message}.${hint}`, { cause: err });
}

const errorCode = (err: unknown) => (err as { code?: unknown } | null)?.code;

function json<T>(value: unknown): T {
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

function toSubmission(row: Record<string, unknown>): StoredSubmission {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    number: Number(row.number),
    formVersionId: row.form_version_id as string,
    data: json<FormValues>(row.data),
    visitorHash: (row.visitor_hash as string | null) ?? null,
    locale: (row.locale as string | null) ?? null,
    createdAt: row.created_at as string,
  };
}

function toVersion(row: Record<string, unknown>): FormVersionRecord {
  return {
    id: row.id as string,
    formId: row.form_id as string,
    version: row.version as string,
    schema: json<FormSchema>(row.schema),
    createdAt: row.created_at as string,
  };
}

function toOverrides(row: Record<string, unknown>): StoredOverrides {
  return { ...json<FormOverrides>(row.data), updatedAt: row.updated_at as string };
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Postgres storage: Supabase, Neon, RDS, Railway or your own server. Needs the `pg` package. */
export async function createPostgresStorage(opts: PostgresStorageOptions): Promise<StorageAdapter> {
  const schemaName = opts.schema ?? 'open_form';
  if (!SCHEMA_RE.test(schemaName)) {
    throw new Error(
      `Invalid Postgres schema "${schemaName}": use lowercase letters, digits and _.`,
    );
  }
  if (!opts.pool && !opts.url) throw new Error('Postgres storage needs a `url` or a `pool`.');
  const pool = opts.pool ?? (await createPool(opts.url as string));
  const ownsPool = !opts.pool;
  const s = `"${schemaName}"`;
  const t = (table: string) => `${s}.${table}`;

  const transaction = async <T>(fn: (tx: PostgresQueryable) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      client.release();
      return result;
    } catch (err) {
      try {
        await client.query('ROLLBACK');
        client.release();
      } catch (rollbackError) {
        client.release(rollbackError as Error);
      }
      throw err;
    }
  };

  const schemaVersion = async (db: PostgresQueryable): Promise<number> => {
    try {
      const { rows } = await db.query(
        `SELECT value FROM ${t('meta')} WHERE key = 'schema_version'`,
      );
      return rows[0] ? Number(rows[0].value) : 0;
    } catch (err) {
      if (errorCode(err) === '42P01' || errorCode(err) === '3F000') return 0;
      throw err;
    }
  };

  try {
    // Every cold start of a serverless function lands here, so skip the lock once up to date.
    if ((await schemaVersion(pool)) < MIGRATIONS.length) {
      await transaction(async (tx) => {
        await tx.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`open_form:${schemaName}`]);
        const { rows } = await tx.query('SELECT 1 FROM pg_namespace WHERE nspname = $1', [
          schemaName,
        ]);
        if (rows.length === 0) await tx.query(`CREATE SCHEMA ${s}`);
        await tx.query(
          `CREATE TABLE IF NOT EXISTS ${t('meta')} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
        );
        let applied = await schemaVersion(tx);
        while (applied < MIGRATIONS.length) {
          for (const statement of (MIGRATIONS[applied] as (s: string) => string[])(s)) {
            await tx.query(statement);
          }
          applied++;
          await tx.query(
            `INSERT INTO ${t('meta')} (key, value) VALUES ('schema_version', $1)
             ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
            [String(applied)],
          );
        }
      });
    }
  } catch (err) {
    if (ownsPool) await pool.end().catch(() => {});
    throw errorCode(err) ? err : connectError(err);
  }

  let hits = 0;

  return {
    async ensureFormVersion(formId, version, schema) {
      const id = crypto.randomUUID();
      const { rows } = await pool.query(
        `INSERT INTO ${t('form_versions')} (id, form_id, version, schema, created_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (form_id, version) DO NOTHING
         RETURNING *`,
        [id, formId, version, JSON.stringify(schema), new Date().toISOString()],
      );
      if (rows[0]) return toVersion(rows[0]);
      const existing = await pool.query(
        `SELECT * FROM ${t('form_versions')} WHERE form_id = $1 AND version = $2`,
        [formId, version],
      );
      return toVersion(existing.rows[0] as Record<string, unknown>);
    },

    async getFormVersion(id) {
      const { rows } = await pool.query(`SELECT * FROM ${t('form_versions')} WHERE id = $1`, [id]);
      return rows[0] ? toVersion(rows[0]) : null;
    },

    async listFormVersions(formId) {
      const { rows } = await pool.query(
        `SELECT * FROM ${t('form_versions')} WHERE form_id = $1 ORDER BY created_at, id`,
        [formId],
      );
      return rows.map(toVersion);
    },

    async createSubmission(input, constraints = {}): Promise<CreateSubmissionResult> {
      try {
        return await transaction(async (tx) => {
          // The form's counter row is the lock: responses to one form go in one at a
          // time, so maxResponses and the unique key are checked against committed rows.
          await tx.query(
            `INSERT INTO ${t('form_counters')} (form_id, last_number) VALUES ($1, 0)
             ON CONFLICT (form_id) DO NOTHING`,
            [input.formId],
          );
          const counter = await tx.query(
            `SELECT last_number FROM ${t('form_counters')} WHERE form_id = $1 FOR UPDATE`,
            [input.formId],
          );
          if (constraints.maxResponses !== undefined) {
            const { rows } = await tx.query(
              `SELECT COUNT(*) AS n FROM ${t('submissions')} WHERE form_id = $1`,
              [input.formId],
            );
            if (Number(rows[0]?.n) >= constraints.maxResponses)
              return { ok: false, reason: 'full' };
          }
          if (input.uniqueKey) {
            const { rows } = await tx.query(
              `SELECT 1 FROM ${t('submissions')} WHERE form_id = $1 AND unique_key = $2`,
              [input.formId, input.uniqueKey],
            );
            if (rows.length > 0) return { ok: false, reason: 'duplicate' };
          }
          const number = Number(counter.rows[0]?.last_number ?? 0) + 1;
          await tx.query(`UPDATE ${t('form_counters')} SET last_number = $2 WHERE form_id = $1`, [
            input.formId,
            number,
          ]);
          const now = new Date().toISOString();
          const submission: StoredSubmission = {
            id: crypto.randomUUID(),
            formId: input.formId,
            number,
            formVersionId: input.formVersionId,
            data: input.data,
            visitorHash: input.visitorHash ?? null,
            locale: input.locale ?? null,
            createdAt: now,
          };
          await tx.query(
            `INSERT INTO ${t('submissions')}
               (id, form_id, number, form_version_id, data, visitor_hash, locale, unique_key, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)`,
            [
              submission.id,
              submission.formId,
              submission.number,
              submission.formVersionId,
              JSON.stringify(submission.data),
              submission.visitorHash,
              submission.locale,
              input.uniqueKey ?? null,
              now,
            ],
          );
          return { ok: true, submission };
        });
      } catch (err) {
        if (errorCode(err) === '23505' && input.uniqueKey)
          return { ok: false, reason: 'duplicate' };
        throw err;
      }
    },

    async getSubmission(formId, id) {
      const { rows } = await pool.query(
        `SELECT * FROM ${t('submissions')} WHERE form_id = $1 AND id = $2`,
        [formId, id],
      );
      return rows[0] ? toSubmission(rows[0]) : null;
    },

    async listSubmissions(formId, opts = {}) {
      const where = ['form_id = $1'];
      const params: unknown[] = [formId];
      if (opts.search?.trim()) {
        params.push(`%${escapeLike(opts.search.trim())}%`);
        // Answers only: field names are keys, never strings or numbers in the tree.
        where.push(
          `EXISTS (
             SELECT 1 FROM jsonb_path_query(data::jsonb, 'strict $.**') AS answer (value)
             WHERE jsonb_typeof(answer.value) IN ('string', 'number')
               AND answer.value #>> '{}' ILIKE $${params.length} ESCAPE '\\'
           )`,
        );
      }
      const clause = where.join(' AND ');
      // Filters and column sorts run the same JavaScript as every other adapter.
      if (opts.filter || opts.sort?.field !== undefined) {
        const { rows } = await pool.query(
          `SELECT * FROM ${t('submissions')} WHERE ${clause} ORDER BY number DESC`,
          params,
        );
        return pageSubmissions(rows.map(toSubmission), opts);
      }
      const order = (opts.sort?.direction ?? opts.order) === 'asc' ? 'ASC' : 'DESC';
      const [count, page] = await Promise.all([
        pool.query(`SELECT COUNT(*) AS n FROM ${t('submissions')} WHERE ${clause}`, params),
        pool.query(
          `SELECT * FROM ${t('submissions')} WHERE ${clause}
           ORDER BY number ${order} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, opts.limit ?? null, opts.offset ?? 0],
        ),
      ]);
      return { items: page.rows.map(toSubmission), total: Number(count.rows[0]?.n ?? 0) };
    },

    async countSubmissions(formId) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS n FROM ${t('submissions')} WHERE form_id = $1`,
        [formId],
      );
      return Number(rows[0]?.n ?? 0);
    },

    async countsByForm() {
      const { rows } = await pool.query(
        `SELECT form_id, COUNT(*) AS n FROM ${t('submissions')} GROUP BY form_id`,
      );
      return Object.fromEntries(rows.map((row) => [row.form_id as string, Number(row.n)]));
    },

    async latestByForm() {
      const { rows } = await pool.query(
        `SELECT form_id, MAX(created_at) AS at FROM ${t('submissions')} GROUP BY form_id`,
      );
      return Object.fromEntries(rows.map((row) => [row.form_id as string, row.at as string]));
    },

    async deleteSubmission(formId, id) {
      const { rowCount } = await pool.query(
        `DELETE FROM ${t('submissions')} WHERE form_id = $1 AND id = $2`,
        [formId, id],
      );
      return Number(rowCount) > 0;
    },

    async deleteForm(formId) {
      return transaction(async (tx) => {
        const { rowCount } = await tx.query(`DELETE FROM ${t('submissions')} WHERE form_id = $1`, [
          formId,
        ]);
        for (const table of ['form_versions', 'form_overrides', 'form_counters']) {
          await tx.query(`DELETE FROM ${t(table)} WHERE form_id = $1`, [formId]);
        }
        return Number(rowCount);
      });
    },

    async hasUniqueKey(formId, uniqueKey) {
      const { rows } = await pool.query(
        `SELECT 1 FROM ${t('submissions')} WHERE form_id = $1 AND unique_key = $2`,
        [formId, uniqueKey],
      );
      return rows.length > 0;
    },

    async getFormOverrides(formId) {
      const { rows } = await pool.query(`SELECT * FROM ${t('form_overrides')} WHERE form_id = $1`, [
        formId,
      ]);
      return rows[0] ? toOverrides(rows[0]) : null;
    },

    async setFormOverrides(formId, overrides) {
      if (overrides) {
        await pool.query(
          `INSERT INTO ${t('form_overrides')} (form_id, data, updated_at) VALUES ($1, $2, $3)
           ON CONFLICT (form_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
          [formId, JSON.stringify(overrides), new Date().toISOString()],
        );
      } else {
        await pool.query(`DELETE FROM ${t('form_overrides')} WHERE form_id = $1`, [formId]);
      }
    },

    async listFormOverrides() {
      const { rows } = await pool.query(`SELECT * FROM ${t('form_overrides')}`);
      return Object.fromEntries(rows.map((row) => [row.form_id as string, toOverrides(row)]));
    },

    async hitRateLimit(key, windowMs, now = Date.now()) {
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const { rows } = await pool.query(
        `INSERT INTO ${t('rate_limits')} (key_hash, window_start, count, expires_at)
         VALUES ($1, $2, 1, $3)
         ON CONFLICT (key_hash, window_start) DO UPDATE SET count = ${t('rate_limits')}.count + 1
         RETURNING count`,
        [key, windowStart, windowStart + windowMs],
      );
      if (++hits % 200 === 0) {
        await pool.query(`DELETE FROM ${t('rate_limits')} WHERE expires_at < $1`, [now]);
      }
      return Number(rows[0]?.count);
    },

    async revokeSession(id, expiresAt, now = Date.now()) {
      await pool.query(`DELETE FROM ${t('revoked_sessions')} WHERE expires_at <= $1`, [now]);
      await pool.query(
        `INSERT INTO ${t('revoked_sessions')} (id, expires_at) VALUES ($1, $2)
         ON CONFLICT (id) DO NOTHING`,
        [id, expiresAt],
      );
    },

    async isSessionRevoked(id) {
      const { rows } = await pool.query(`SELECT 1 FROM ${t('revoked_sessions')} WHERE id = $1`, [
        id,
      ]);
      return rows.length > 0;
    },

    async info() {
      const { rows } = await pool.query('SHOW server_version');
      return {
        engine: `PostgreSQL ${String(rows[0]?.server_version ?? '').split(' ')[0]}`,
        location: `schema ${schemaName}`,
        schemaVersion: await schemaVersion(pool),
      };
    },

    async close() {
      if (ownsPool) await pool.end();
    },
  };
}
