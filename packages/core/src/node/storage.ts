import { existsSync } from 'node:fs';
import path from 'node:path';
import type { OpenFormConfig } from '../schema/index.ts';
import type { FileStore } from '../storage/files.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { createS3FileStore, parseS3Url } from '../storage/s3.ts';
import { createLocalFileStore } from './files.ts';
import { resolveDatabasePath } from './secret.ts';

export type StorageTarget =
  | {
      kind: 'sqlite';
      path: string;
      source: 'OPEN_FORM_DB' | 'storage.path' | 'default';
    }
  | {
      kind: 'postgres';
      url: string;
      source: 'OPEN_FORM_DATABASE_URL' | 'storage.url' | 'POSTGRES_URL' | 'DATABASE_URL';
    };

export const POSTGRES_RE = /^postgres(?:ql)?:\/\//i;

/**
 * Where responses live: `OPEN_FORM_DATABASE_URL`, else `storage.url`, else SQLite
 * at `OPEN_FORM_DB`, `storage.path` or `.open-form/open-form.db`.
 */
export function resolveStorage(projectRoot: string, config: OpenFormConfig = {}): StorageTarget {
  const fromEnv = process.env.OPEN_FORM_DATABASE_URL?.trim();
  const configured = config.storage?.url?.trim();
  const url = fromEnv || configured;
  if (url) {
    const source = fromEnv ? 'OPEN_FORM_DATABASE_URL' : 'storage.url';
    if (!POSTGRES_RE.test(url)) {
      throw new Error(
        `${source} must be a Postgres connection string (postgres://…); got ${redactUrl(url)}.`,
      );
    }
    return { kind: 'postgres', url, source };
  }
  return resolveSqlite(projectRoot, config);
}

/** The SQLite file this workspace uses when no Postgres URL is set. */
export function resolveSqlite(
  projectRoot: string,
  config: OpenFormConfig = {},
): Extract<StorageTarget, { kind: 'sqlite' }> {
  const source = process.env.OPEN_FORM_DB
    ? 'OPEN_FORM_DB'
    : config.storage?.path
      ? 'storage.path'
      : 'default';
  return { kind: 'sqlite', path: resolveDatabasePath(projectRoot, config.storage?.path), source };
}

/** Whether there can be anything stored yet, without creating a SQLite file to find out. */
export function storageExists(target: StorageTarget): boolean {
  return target.kind === 'postgres' || existsSync(target.path);
}

export async function openStorage(target: StorageTarget): Promise<StorageAdapter> {
  if (target.kind === 'postgres') {
    const { createPostgresStorage } = await import('../postgres/index.ts');
    return createPostgresStorage({ url: target.url });
  }
  const { createSqliteStorage } = await import('../sqlite/index.ts');
  return createSqliteStorage({ path: target.path });
}

/** For logs and terminals: the connection string without its password. */
export function describeStorage(target: StorageTarget, projectRoot?: string): string {
  if (target.kind === 'postgres') return `Postgres ${redactUrl(target.url)}`;
  const shown = projectRoot ? path.relative(projectRoot, target.path) || target.path : target.path;
  return `SQLite ${shown}`;
}

export function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '***';
    for (const key of [...parsed.searchParams.keys()]) {
      if (/pass|secret|token|key/i.test(key)) parsed.searchParams.set(key, '***');
    }
    return parsed.toString();
  } catch {
    return '[invalid connection string]';
  }
}

export type FileTarget =
  | { kind: 'local'; dir: string; source: 'OPEN_FORM_FILES_DIR' | 'files.path' | 'default' }
  | { kind: 's3'; url: string; source: 'OPEN_FORM_FILES_URL' | 'files.url' };

/**
 * Where uploaded files go: `OPEN_FORM_FILES_URL`, else `files.url` (an
 * S3-compatible bucket), else a folder on disk: `OPEN_FORM_FILES_DIR`,
 * `files.path` or `uploads/` next to the SQLite database (`.open-form/uploads`).
 */
export function resolveFiles(projectRoot: string, config: OpenFormConfig = {}): FileTarget {
  const fromEnv = process.env.OPEN_FORM_FILES_URL?.trim();
  const configured = config.files?.url?.trim();
  const url = fromEnv || configured;
  if (url) {
    const source = fromEnv ? 'OPEN_FORM_FILES_URL' : 'files.url';
    try {
      parseS3Url(url);
    } catch (err) {
      throw new Error(`${source}: ${(err as Error).message}`);
    }
    return { kind: 's3', url, source };
  }
  const dirEnv = process.env.OPEN_FORM_FILES_DIR?.trim();
  const source = dirEnv ? 'OPEN_FORM_FILES_DIR' : config.files?.path ? 'files.path' : 'default';
  // By default the files follow the database (and its secret), so one volume keeps all three.
  const beside = path.join(
    path.dirname(resolveDatabasePath(projectRoot, config.storage?.path)),
    'uploads',
  );
  const dir = path.resolve(projectRoot, dirEnv || config.files?.path || beside);
  return { kind: 'local', dir, source };
}

export function openFiles(target: FileTarget): FileStore {
  if (target.kind === 'local') return createLocalFileStore({ dir: target.dir });
  const accessKeyId = process.env.OPEN_FORM_FILES_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.OPEN_FORM_FILES_SECRET_ACCESS_KEY?.trim();
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `${target.source} points at a bucket, but OPEN_FORM_FILES_ACCESS_KEY_ID and OPEN_FORM_FILES_SECRET_ACCESS_KEY aren't both set.`,
    );
  }
  return createS3FileStore({ ...parseS3Url(target.url), accessKeyId, secretAccessKey });
}

/** For logs and terminals. */
export function describeFiles(target: FileTarget, projectRoot?: string): string {
  if (target.kind === 's3') {
    const { bucket, endpoint, prefix } = parseS3Url(target.url);
    return `S3 ${bucket}${prefix ? `/${prefix}` : ''}${endpoint ? ` (${new URL(endpoint).host})` : ''}`;
  }
  return `disk ${projectRoot ? path.relative(projectRoot, target.dir) || target.dir : target.dir}`;
}
