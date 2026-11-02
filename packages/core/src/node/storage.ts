import { existsSync } from 'node:fs';
import path from 'node:path';
import type { OpenFormConfig } from '../schema/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
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
