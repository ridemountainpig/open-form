import path from 'node:path';
import chalk from 'chalk';
import { describeStorage, openStorage, resolveStorage, storageExists } from '../node/storage.ts';
import type { StorageInfo } from '../server/index.ts';
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
