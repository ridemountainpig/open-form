import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  type FilterableResponse,
  type FormOverrides,
  type FormSchema,
  type FormValues,
  type ResponseSortKey,
  responseFilterTest,
  responseSortKey,
} from '../schema/index.ts';
import type {
  CreateSubmissionResult,
  FormVersionRecord,
  StorageAdapter,
  StoredOverrides,
  StoredSubmission,
} from '../storage/index.ts';

export type SqliteStorageOptions = {
  /** Database file, or `':memory:'`. */
  path: string;
};

const MIGRATIONS: string[] = [
  `CREATE TABLE form_versions (
     id TEXT PRIMARY KEY,
     form_id TEXT NOT NULL,
     version TEXT NOT NULL,
     schema TEXT NOT NULL,
     created_at TEXT NOT NULL,
     UNIQUE (form_id, version)
   );
   CREATE TABLE submissions (
     id TEXT PRIMARY KEY,
     form_id TEXT NOT NULL,
     number INTEGER NOT NULL,
     form_version_id TEXT NOT NULL REFERENCES form_versions (id),
     data TEXT NOT NULL,
     visitor_hash TEXT,
     unique_key TEXT,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );
   CREATE INDEX submissions_form_number ON submissions (form_id, number);
   CREATE INDEX submissions_form_visitor ON submissions (form_id, visitor_hash);
   CREATE UNIQUE INDEX submissions_form_unique ON submissions (form_id, unique_key)
     WHERE unique_key IS NOT NULL;
   CREATE TABLE submission_files (
     id TEXT PRIMARY KEY,
     submission_id TEXT NOT NULL REFERENCES submissions (id) ON DELETE CASCADE,
     field_name TEXT NOT NULL,
     storage_key TEXT NOT NULL,
     filename TEXT NOT NULL,
     mime_type TEXT NOT NULL,
     size INTEGER NOT NULL,
     created_at TEXT NOT NULL
   );
   CREATE TABLE rate_limits (
     key_hash TEXT NOT NULL,
     window_start INTEGER NOT NULL,
     count INTEGER NOT NULL,
     expires_at INTEGER NOT NULL,
     PRIMARY KEY (key_hash, window_start)
   );
   CREATE INDEX rate_limits_expires ON rate_limits (expires_at);`,
  'ALTER TABLE submissions ADD COLUMN locale TEXT;',
  `CREATE TABLE form_overrides (
     form_id TEXT PRIMARY KEY,
     data TEXT NOT NULL,
     updated_at TEXT NOT NULL
   );`,
  `CREATE TABLE form_counters (
     form_id TEXT PRIMARY KEY,
     last_number INTEGER NOT NULL
   );`,
  `CREATE TABLE revoked_sessions (
     id TEXT PRIMARY KEY,
     expires_at INTEGER NOT NULL
   );`,
];

// node:sqlite still prints an ExperimentalWarning on Node 22. It is the whole
// point of "zero infrastructure", so keep that one warning out of the CLI.
async function loadSqlite(): Promise<typeof import('node:sqlite')> {
  const emitWarning = process.emitWarning;
  process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
    if (String(warning).includes('SQLite')) return;
    return (emitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
  }) as typeof process.emitWarning;
  try {
    return await import('node:sqlite');
  } finally {
    process.emitWarning = emitWarning;
  }
}

function migrate(db: DatabaseSync): void {
  db.exec('CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
    | { value: string }
    | undefined;
  let applied = row ? Number(row.value) : 0;
  while (applied < MIGRATIONS.length) {
    db.exec('BEGIN');
    try {
      db.exec(MIGRATIONS[applied] as string);
      applied++;
      db.prepare(
        `INSERT INTO meta (key, value) VALUES ('schema_version', ?)
         ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
      ).run(String(applied));
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

type SubmissionRow = {
  id: string;
  form_id: string;
  number: number;
  form_version_id: string;
  data: string;
  visitor_hash: string | null;
  locale: string | null;
  created_at: string;
};

type VersionRow = {
  id: string;
  form_id: string;
  version: string;
  schema: string;
  created_at: string;
};

function toSubmission(row: SubmissionRow): StoredSubmission {
  return {
    id: row.id,
    formId: row.form_id,
    number: Number(row.number),
    formVersionId: row.form_version_id,
    data: JSON.parse(row.data) as FormValues,
    visitorHash: row.visitor_hash,
    locale: row.locale ?? null,
    createdAt: row.created_at,
  };
}

type OverridesRow = { form_id: string; data: string; updated_at: string };

function toOverrides(row: OverridesRow): StoredOverrides {
  return { ...(JSON.parse(row.data) as FormOverrides), updatedAt: row.updated_at };
}

function toVersion(row: VersionRow): FormVersionRecord {
  return {
    id: row.id,
    formId: row.form_id,
    version: row.version,
    schema: JSON.parse(row.schema) as FormSchema,
    createdAt: row.created_at,
  };
}

function restrictToOwner(file: string): void {
  for (const target of [file, `${file}-wal`, `${file}-shm`]) {
    try {
      chmodSync(target, 0o600);
    } catch {}
  }
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** SQLite storage on Node's built-in `node:sqlite` — no native addons, no server. */
export async function createSqliteStorage(opts: SqliteStorageOptions): Promise<StorageAdapter> {
  const { DatabaseSync } = await loadSqlite();
  const file = opts.path === ':memory:' ? null : path.resolve(opts.path);
  if (file) {
    const dir = path.dirname(file);
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    // Open Form's own data folder: only its owner may list it.
    if (path.basename(dir) === '.open-form') chmodSync(dir, 0o700);
  }
  // Responses are personal data: create the file owner-only rather than tightening
  // it after SQLite has made it under the umask. SQLite gives -wal and -shm the
  // database's mode; existing files are tightened too.
  if (file) closeSync(openSync(file, 'a', 0o600));
  const db = new DatabaseSync(opts.path);
  if (file) restrictToOwner(file);
  // Deleted responses are overwritten instead of lingering in free pages.
  db.exec('PRAGMA secure_delete = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  migrate(db);

  // Filters run the same JavaScript as every other adapter, so COUNT, LIMIT and
  // OFFSET still happen in SQL. Queries are synchronous: one filter at a time.
  let filtering: ((response: FilterableResponse) => boolean) | null = null;
  db.function('open_form_filter', { directOnly: true }, (data, createdAt) => {
    if (!filtering) return 1;
    try {
      const parsed = JSON.parse(String(data)) as FilterableResponse['data'];
      return filtering({ data: parsed, createdAt: String(createdAt) }) ? 1 : 0;
    } catch {
      return 0;
    }
  });
  let sorting: ((data: FilterableResponse['data']) => ResponseSortKey) | null = null;
  db.function('open_form_sort_key', { directOnly: true }, (data) => {
    if (!sorting) return null;
    try {
      return sorting(JSON.parse(String(data)) as FilterableResponse['data']);
    } catch {
      return null;
    }
  });

  const stmt = {
    findVersion: db.prepare('SELECT * FROM form_versions WHERE form_id = ? AND version = ?'),
    getVersion: db.prepare('SELECT * FROM form_versions WHERE id = ?'),
    listVersions: db.prepare('SELECT * FROM form_versions WHERE form_id = ? ORDER BY created_at'),
    insertVersion: db.prepare(
      `INSERT INTO form_versions (id, form_id, version, schema, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (form_id, version) DO NOTHING`,
    ),
    count: db.prepare('SELECT COUNT(*) AS n FROM submissions WHERE form_id = ?'),
    counts: db.prepare('SELECT form_id, COUNT(*) AS n FROM submissions GROUP BY form_id'),
    latest: db.prepare('SELECT form_id, MAX(created_at) AS at FROM submissions GROUP BY form_id'),
    hasKey: db.prepare('SELECT 1 AS hit FROM submissions WHERE form_id = ? AND unique_key = ?'),
    // A counter, not MAX(number) + 1: deleting the newest response must not
    // hand its number to the next one (webhook receivers have already seen it).
    // MAX(number) still bounds it from below, in case an older version kept
    // writing to this file without the counter.
    nextNumber: db.prepare(
      `INSERT INTO form_counters (form_id, last_number)
         SELECT ?, COALESCE(MAX(number), 0) + 1 FROM submissions WHERE form_id = ?
       ON CONFLICT (form_id) DO UPDATE SET last_number = MAX(last_number + 1, excluded.last_number)
       RETURNING last_number AS n`,
    ),
    insert: db.prepare(
      `INSERT INTO submissions
         (id, form_id, number, form_version_id, data, visitor_hash, locale, unique_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ),
    get: db.prepare('SELECT * FROM submissions WHERE form_id = ? AND id = ?'),
    delete: db.prepare('DELETE FROM submissions WHERE form_id = ? AND id = ?'),
    hit: db.prepare(
      `INSERT INTO rate_limits (key_hash, window_start, count, expires_at) VALUES (?, ?, 1, ?)
       ON CONFLICT (key_hash, window_start) DO UPDATE SET count = count + 1
       RETURNING count`,
    ),
    purgeRate: db.prepare('DELETE FROM rate_limits WHERE expires_at < ?'),
    revoke: db.prepare(
      `INSERT INTO revoked_sessions (id, expires_at) VALUES (?, ?)
       ON CONFLICT (id) DO NOTHING`,
    ),
    isRevoked: db.prepare('SELECT 1 AS hit FROM revoked_sessions WHERE id = ?'),
    purgeRevoked: db.prepare('DELETE FROM revoked_sessions WHERE expires_at <= ?'),
    getOverrides: db.prepare('SELECT * FROM form_overrides WHERE form_id = ?'),
    listOverrides: db.prepare('SELECT * FROM form_overrides'),
    setOverrides: db.prepare(
      `INSERT INTO form_overrides (form_id, data, updated_at) VALUES (?, ?, ?)
       ON CONFLICT (form_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
    ),
    deleteOverrides: db.prepare('DELETE FROM form_overrides WHERE form_id = ?'),
    // Responses first: they reference the form's versions (their files cascade).
    eraseForm: [
      db.prepare('DELETE FROM submissions WHERE form_id = ?'),
      db.prepare('DELETE FROM form_versions WHERE form_id = ?'),
      db.prepare('DELETE FROM form_overrides WHERE form_id = ?'),
      db.prepare('DELETE FROM form_counters WHERE form_id = ?'),
    ],
  };

  let hits = 0;

  return {
    async ensureFormVersion(formId, version, schema) {
      const existing = stmt.findVersion.get(formId, version) as VersionRow | undefined;
      if (existing) return toVersion(existing);
      // Another process on the same file (`open-form dev` and `start`) may have just added it.
      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const { changes } = stmt.insertVersion.run(
        id,
        formId,
        version,
        JSON.stringify(schema),
        createdAt,
      );
      if (Number(changes) > 0) return { id, formId, version, schema, createdAt };
      return toVersion(stmt.findVersion.get(formId, version) as VersionRow);
    },

    async getFormVersion(id) {
      const row = stmt.getVersion.get(id) as VersionRow | undefined;
      return row ? toVersion(row) : null;
    },

    async listFormVersions(formId) {
      return (stmt.listVersions.all(formId) as VersionRow[]).map(toVersion);
    },

    async createSubmission(input, constraints = {}): Promise<CreateSubmissionResult> {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (constraints.maxResponses !== undefined) {
          const { n } = stmt.count.get(input.formId) as { n: number };
          if (Number(n) >= constraints.maxResponses) {
            db.exec('ROLLBACK');
            return { ok: false, reason: 'full' };
          }
        }
        if (input.uniqueKey && stmt.hasKey.get(input.formId, input.uniqueKey)) {
          db.exec('ROLLBACK');
          return { ok: false, reason: 'duplicate' };
        }
        const { n: number } = stmt.nextNumber.get(input.formId, input.formId) as { n: number };
        const now = new Date().toISOString();
        const submission: StoredSubmission = {
          id: crypto.randomUUID(),
          formId: input.formId,
          number: Number(number),
          formVersionId: input.formVersionId,
          data: input.data,
          visitorHash: input.visitorHash ?? null,
          locale: input.locale ?? null,
          createdAt: now,
        };
        stmt.insert.run(
          submission.id,
          submission.formId,
          submission.number,
          submission.formVersionId,
          JSON.stringify(submission.data),
          submission.visitorHash,
          submission.locale ?? null,
          input.uniqueKey ?? null,
          now,
          now,
        );
        db.exec('COMMIT');
        return { ok: true, submission };
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },

    async getSubmission(formId, id) {
      const row = stmt.get.get(formId, id) as SubmissionRow | undefined;
      return row ? toSubmission(row) : null;
    },

    async listSubmissions(formId, opts = {}) {
      const where = ['form_id = ?'];
      const params: Array<string | number> = [formId];
      if (opts.search?.trim()) {
        // Answers only: the JSON text also holds field names, which every row matches.
        // json_tree throws on JSON it can't walk (too deep), which would fail the
        // whole search, so such rows are skipped instead.
        where.push(
          `CASE WHEN json_valid(submissions.data) THEN EXISTS (
             SELECT 1 FROM json_tree(submissions.data)
             WHERE type IN ('text', 'integer', 'real') AND atom LIKE ? ESCAPE '\\'
           ) ELSE 0 END`,
        );
        params.push(`%${escapeLike(opts.search.trim())}%`);
      }
      const test = opts.filter ? responseFilterTest(opts.filter, opts.now) : null;
      if (test) where.push('open_form_filter(data, created_at)');
      const clause = where.join(' AND ');
      const order = (opts.sort?.direction ?? opts.order) === 'asc' ? 'ASC' : 'DESC';
      const key = opts.sort?.field !== undefined ? responseSortKey(opts.sort) : null;
      // Empty answers last either way; ties newest first, like the default order.
      const query = key
        ? `SELECT * FROM (SELECT *, open_form_sort_key(data) AS sort_key FROM submissions WHERE ${clause})
           ORDER BY sort_key IS NULL, sort_key ${order}, number DESC LIMIT ? OFFSET ?`
        : `SELECT * FROM submissions WHERE ${clause} ORDER BY number ${order} LIMIT ? OFFSET ?`;
      filtering = test;
      sorting = key;
      try {
        const { n: total } = db
          .prepare(`SELECT COUNT(*) AS n FROM submissions WHERE ${clause}`)
          .get(...params) as { n: number };
        const rows = db
          .prepare(query)
          .all(...params, opts.limit ?? -1, opts.offset ?? 0) as SubmissionRow[];
        return { items: rows.map(toSubmission), total: Number(total) };
      } finally {
        filtering = null;
        sorting = null;
      }
    },

    async countSubmissions(formId) {
      const { n } = stmt.count.get(formId) as { n: number };
      return Number(n);
    },

    async countsByForm() {
      const counts: Record<string, number> = {};
      for (const row of stmt.counts.all() as Array<{ form_id: string; n: number }>) {
        counts[row.form_id] = Number(row.n);
      }
      return counts;
    },

    async latestByForm() {
      const latest: Record<string, string> = {};
      for (const row of stmt.latest.all() as Array<{ form_id: string; at: string }>) {
        latest[row.form_id] = row.at;
      }
      return latest;
    },

    async deleteSubmission(formId, id) {
      const result = stmt.delete.run(formId, id);
      // The WAL still holds the response as it was written; fold it into the
      // (overwritten) database and empty it, so the delete is a real erase.
      if (file) db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      return Number(result.changes) > 0;
    },

    async deleteForm(formId) {
      let responses = 0;
      db.exec('BEGIN IMMEDIATE');
      try {
        for (const [index, statement] of stmt.eraseForm.entries()) {
          const { changes } = statement.run(formId);
          if (index === 0) responses = Number(changes);
        }
        db.exec('COMMIT');
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
      if (file) db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      return responses;
    },

    async hasUniqueKey(formId, uniqueKey) {
      return Boolean(stmt.hasKey.get(formId, uniqueKey));
    },

    async getFormOverrides(formId) {
      const row = stmt.getOverrides.get(formId) as OverridesRow | undefined;
      return row ? toOverrides(row) : null;
    },

    async setFormOverrides(formId, overrides) {
      if (overrides) {
        stmt.setOverrides.run(formId, JSON.stringify(overrides), new Date().toISOString());
      } else {
        stmt.deleteOverrides.run(formId);
      }
    },

    async listFormOverrides() {
      const all: Record<string, StoredOverrides> = {};
      for (const row of stmt.listOverrides.all() as OverridesRow[]) {
        all[row.form_id] = toOverrides(row);
      }
      return all;
    },

    async hitRateLimit(key, windowMs, now = Date.now()) {
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const row = stmt.hit.get(key, windowStart, windowStart + windowMs) as { count: number };
      if (++hits % 200 === 0) stmt.purgeRate.run(now);
      return Number(row.count);
    },

    async revokeSession(id, expiresAt, now = Date.now()) {
      stmt.purgeRevoked.run(now);
      stmt.revoke.run(id, expiresAt);
    },

    async isSessionRevoked(id) {
      return Boolean(stmt.isRevoked.get(id));
    },

    async info() {
      const { version } = db.prepare('SELECT sqlite_version() AS version').get() as {
        version: string;
      };
      const row = db.prepare(`SELECT value FROM meta WHERE key = 'schema_version'`).get() as
        | { value: string }
        | undefined;
      return { engine: `SQLite ${version}`, schemaVersion: Number(row?.value ?? 0) };
    },

    async close() {
      db.close();
    },
  };
}
