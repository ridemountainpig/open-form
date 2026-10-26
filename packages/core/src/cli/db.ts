import { existsSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import {
  describeStorage,
  openStorage,
  resolveSqlite,
  resolveStorage,
  storageExists,
} from '../node/storage.ts';
import type { StorageDump, StorageInfo } from '../server/index.ts';
import { findForms, loadUserConfig, projectPaths } from '../vite/project.ts';
import { glyph, printHeader, printRows } from './ui.ts';

export type DbStatus = {
  kind: 'sqlite' | 'postgres';
  /** Password hidden. */
  location: string;
  /** The setting it came from: `OPEN_FORM_DATABASE_URL`, `storage.url`, `OPEN_FORM_DB`, `storage.path` or `default`. */
  source: string;
  ok: boolean;
  /** No SQLite file yet: nothing has been submitted. */
  created: boolean;
  info?: StorageInfo;
  responses?: Record<string, number>;
  error?: string;
};

export async function readDbStatus(userCwd: string): Promise<DbStatus> {
  const config = await loadUserConfig(userCwd);
  const target = resolveStorage(userCwd, config);
  const location =
    target.kind === 'sqlite'
      ? path.relative(userCwd, target.path) || target.path
      : describeStorage(target).replace(/^Postgres /, '');
  const status = { kind: target.kind, location, source: target.source };
  if (!storageExists(target)) return { ...status, ok: true, created: false };
  try {
    const storage = await openStorage(target);
    try {
      const [info, counts] = await Promise.all([storage.info?.(), storage.countsByForm()]);
      const forms = findForms(projectPaths(userCwd, config).formsRoot).map((form) => form.id);
      const responses = Object.fromEntries(
        [...new Set([...forms, ...Object.keys(counts)])].sort().map((id) => [id, counts[id] ?? 0]),
      );
      return { ...status, ok: true, created: true, info, responses };
    } finally {
      await storage.close();
    }
  } catch (err) {
    return {
      ...status,
      ok: false,
      created: true,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** `open-form db status`: which database, from which setting, and whether it answers. */
export async function dbStatus(flags: { json?: boolean } = {}): Promise<void> {
  const status = await readDbStatus(process.cwd());
  if (!status.ok) process.exitCode = 1;
  if (flags.json) {
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }
  const from = status.source === 'default' ? 'default' : `from ${status.source}`;
  printHeader();
  const rows: Array<[string, string]> = [
    ['Storage', `${status.kind === 'postgres' ? 'Postgres' : 'SQLite'} ${chalk.dim(`(${from})`)}`],
    ['Database', status.location],
  ];
  if (!status.created) {
    rows.push(['Status', chalk.dim('not created yet: the first response creates it')]);
  } else if (!status.ok) {
    rows.push(['Status', chalk.red(`${glyph.cross} ${status.error}`)]);
  } else {
    const engine = status.info
      ? `${status.info.engine}${status.info.location ? ` · ${status.info.location}` : ''} · migration ${status.info.schemaVersion}`
      : '';
    rows.push(['Status', `${chalk.green(`${glyph.check} connected`)} ${chalk.dim(engine)}`]);
    const responses = Object.entries(status.responses ?? {});
    rows.push([
      'Responses',
      responses.length
        ? responses.map(([id, n]) => `${id} ${chalk.bold(String(n))}`).join(chalk.dim(' · '))
        : chalk.dim('no forms yet'),
    ]);
  }
  printRows(rows);
  process.stdout.write('\n');
}

export type DbCopyResult = {
  /** The SQLite file, relative to the workspace. */
  from: string;
  /** The Postgres connection string, password hidden. */
  to: string;
  responses: Record<string, number>;
  /** Forms with settings changed in Studio. */
  settings: string[];
  copied: boolean;
};

/**
 * `open-form db copy`: everything in the workspace's SQLite file into the Postgres
 * database it's configured for, in one transaction. The SQLite file keeps its responses.
 */
export async function copyDatabase(
  userCwd: string,
  flags: { from?: string; dryRun?: boolean } = {},
): Promise<DbCopyResult> {
  const config = await loadUserConfig(userCwd);
  const target = resolveStorage(userCwd, config);
  if (target.kind !== 'postgres') {
    throw new Error(
      'Set OPEN_FORM_DATABASE_URL (or storage.url) to the Postgres database to copy into.',
    );
  }
  const file = flags.from ? path.resolve(userCwd, flags.from) : resolveSqlite(userCwd, config).path;
  const from = path.relative(userCwd, file) || file;
  if (!existsSync(file)) throw new Error(`There's no SQLite database at ${from}: nothing to copy.`);

  const source = await openStorage({ kind: 'sqlite', path: file, source: 'default' });
  let dump: StorageDump;
  try {
    if (!source.dump) throw new Error('This storage cannot be copied.');
    dump = await source.dump();
  } finally {
    await source.close();
  }
  const responses: Record<string, number> = {};
  for (const { formId } of dump.submissions) responses[formId] = (responses[formId] ?? 0) + 1;
  const result = {
    from,
    to: describeStorage(target).replace(/^Postgres /, ''),
    responses,
    settings: Object.keys(dump.overrides).sort(),
    copied: false,
  };
  if (flags.dryRun) return result;

  const storage = await openStorage(target);
  try {
    if (!storage.restore) throw new Error('This storage cannot restore a copy.');
    await storage.restore(dump);
    const counts = await storage.countsByForm();
    for (const [formId, n] of Object.entries(responses)) {
      if (counts[formId] !== n) {
        throw new Error(`Copied ${counts[formId] ?? 0} of ${n} responses to ${formId}.`);
      }
    }
  } finally {
    await storage.close();
  }
  return { ...result, copied: true };
}

export async function dbCopy(flags: { from?: string; dryRun?: boolean } = {}): Promise<void> {
  const result = await copyDatabase(process.cwd(), flags);
  const responses = Object.entries(result.responses);
  const total = responses.reduce((sum, [, n]) => sum + n, 0);
  printHeader(result.copied ? undefined : 'dry run');
  printRows([
    ['From', `SQLite ${result.from}`],
    ['To', `Postgres ${result.to}`],
    [
      'Responses',
      responses.length
        ? `${chalk.bold(String(total))} ${chalk.dim(`(${responses.map(([id, n]) => `${id} ${n}`).join(' · ')})`)}`
        : chalk.dim('none'),
    ],
    [
      'Settings',
      result.settings.length
        ? `Studio settings of ${result.settings.join(', ')}`
        : chalk.dim('none changed in Studio'),
    ],
    [
      'Status',
      result.copied
        ? `${chalk.green(`${glyph.check} copied`)} ${chalk.dim('· the SQLite file keeps its own copy')}`
        : chalk.dim('nothing written: run without --dry-run to copy'),
    ],
  ]);
  process.stdout.write('\n');
}
