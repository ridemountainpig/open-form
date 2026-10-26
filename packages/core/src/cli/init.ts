import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import {
  chmod,
  cp,
  lstat,
  mkdir,
  readdir,
  readFile,
  stat,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { connectionStringProblem } from '../postgres/index.ts';
import { isTimeZone } from '../schema/index.ts';
import { PACKAGE_NAME, PKG_ROOT, readPackageVersion } from '../vite/project.ts';
import { EXEC, PACKAGE_MANAGERS, type PackageManager, RUN } from './package-managers.ts';
import { syncSkills } from './skills.ts';

const TEMPLATE_DIR = path.join(PKG_ROOT, 'template');
const IS_WINDOWS = process.platform === 'win32';
// Runtime data or local files that may sit in a checkout's template are never copied.
const TEMPLATE_SKIP = /^(?:\.open-form|node_modules|dist|\.env.*|.*\.db(?:-.*)?)$/;
// npm strips dotfiles named .gitignore from published packages, so it's written here.
const GITIGNORE = [
  'node_modules',
  'dist',
  '.DS_Store',
  '*.log',
  '',
  '# Runtime data: responses, uploads, secrets',
  '.open-form/',
  '',
  '# Secrets and exported responses',
  '.env',
  '.env.*',
  '!.env.example',
  '/responses*.csv',
  '/responses*.xlsx',
  '/responses*.json',
];

export type InitFlags = {
  force?: boolean;
  name?: string;
  pm?: PackageManager;
  install?: boolean;
  git?: boolean;
  /** Dependency spec for `@open-form-build/core` (e.g. `link:../core`). Defaults to `^<version>`. */
  openFormVersion?: string;
  /** Written to `open-form.config.ts`. Defaults to this computer's time zone. */
  timeZone?: string;
  /** Where responses go. `postgres` adds `pg` and an `OPEN_FORM_DATABASE_URL` line to `.env`. */
  database?: Database;
  /** Written to `.env`, never to a file that is committed. */
  databaseUrl?: string;
};

export const DATABASES = ['sqlite', 'postgres'] as const;
export type Database = (typeof DATABASES)[number];

const DATABASE_URL_EXAMPLE = 'postgres://user:password@host:5432/dbname';

function pgVersion(): string {
  try {
    const pkg = JSON.parse(
      readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8'),
    ) as PackageJson & { peerDependencies?: Record<string, string> };
    return pkg.peerDependencies?.pg ?? '^8.11.0';
  } catch {
    return '^8.11.0';
  }
}

/** Sets `key` in a dotenv file unless it is already there. */
async function setEnv(
  file: string,
  key: string,
  value: string,
  opts: { secret?: boolean } = {},
): Promise<boolean> {
  const existing = existsSync(file) ? await readFile(file, 'utf8') : '';
  if (new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=`, 'm').test(existing)) return false;
  const separator = existing && !existing.endsWith('\n') ? '\n' : '';
  // Unquoted, a `#` in the password would start a comment.
  const quote = ["'", '"', '`'].find((q) => !value.includes(q));
  if (!quote) throw new Error(`${key} has every quote character, so .env can't hold it.`);
  const quoted = `${quote}${value}${quote}`;
  await writeFile(file, `${existing}${separator}${key}=${quoted}\n`, {
    mode: opts.secret ? 0o600 : 0o644,
  });
  if (opts.secret) await chmod(file, 0o600);
  return true;
}

export function databaseUrlProblem(value: string): string | undefined {
  const url = value.trim();
  if (!url) return undefined;
  if (!/^postgres(?:ql)?:\/\/\S+$/i.test(url)) {
    return `Use a Postgres connection string, e.g. ${DATABASE_URL_EXAMPLE}`;
  }
  return connectionStringProblem(url);
}

function localTimeZone(): string | undefined {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return isTimeZone(zone) ? zone : undefined;
}

export function detectPackageManager(): PackageManager {
  const agent = process.env.npm_config_user_agent ?? '';
  for (const pm of PACKAGE_MANAGERS) if (agent.startsWith(pm)) return pm;
  return 'pnpm';
}

export function sanitizeName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^[-.]+|-+$/g, '') || 'my-forms'
  );
}

/** Unlike `existsSync`, counts a dangling symlink too. */
function pathExists(file: string): Promise<boolean> {
  return lstat(file).then(
    () => true,
    () => false,
  );
}

async function isNonEmpty(dir: string): Promise<boolean> {
  if (!existsSync(dir)) return false;
  return (await readdir(dir)).some((entry) => entry !== '.git' && entry !== '.DS_Store');
}

/** Adds what's missing to an existing .gitignore instead of replacing it. */
async function writeGitignore(target: string): Promise<void> {
  const file = path.join(target, '.gitignore');
  const existing = existsSync(file) ? await readFile(file, 'utf8') : '';
  if (!existing) {
    await writeFile(file, `${GITIGNORE.join('\n')}\n`);
    return;
  }
  const have = new Set(existing.split(/\r?\n/).map((line) => line.trim()));
  const missing = GITIGNORE.filter((line) => line && !line.startsWith('#') && !have.has(line));
  if (missing.length === 0) return;
  const separator = existing.endsWith('\n') ? '' : '\n';
  await writeFile(file, `${existing}${separator}\n# Open Form\n${missing.join('\n')}\n`);
}

export type PackageJson = {
  name?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type ScaffoldResult = {
  /** Template files left alone because the target already had them. */
  kept: string[];
  pkg: PackageJson;
  /** Whether the connection string was written to `.env`, or one already there was kept. */
  databaseUrl?: 'saved' | 'kept';
};

function withMissing(
  base: Record<string, string> = {},
  add: Record<string, string> = {},
  has: (key: string) => boolean = (key) => Object.hasOwn(base, key),
): Record<string, string> {
  return { ...base, ...Object.fromEntries(Object.entries(add).filter(([key]) => !has(key))) };
}

/** Adds the template's scripts and dependencies an existing package.json lacks, keeping its own. */
function mergePackageJson(existing: PackageJson, template: PackageJson): PackageJson {
  const has = (name: string) =>
    Object.hasOwn(existing.dependencies ?? {}, name) ||
    Object.hasOwn(existing.devDependencies ?? {}, name);
  return {
    ...existing,
    scripts: withMissing(existing.scripts, template.scripts),
    dependencies: withMissing(existing.dependencies, template.dependencies, has),
    devDependencies: withMissing(existing.devDependencies, template.devDependencies, has),
  };
}

async function readPackageJson(file: string): Promise<PackageJson | undefined> {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(await readFile(file, 'utf8')) as PackageJson;
  } catch (err) {
    throw new Error(`Can't read ${file}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Writes the template into `target`, never replacing a file that's already there. */
export async function scaffold(target: string, flags: InitFlags = {}): Promise<ScaffoldResult> {
  if (!existsSync(TEMPLATE_DIR)) throw new Error(`Template missing at ${TEMPLATE_DIR}.`);
  const pkgPath = path.join(target, 'package.json');
  const existing = await readPackageJson(pkgPath);
  const template = (await readPackageJson(path.join(TEMPLATE_DIR, 'package.json'))) ?? {};

  const kept: string[] = [];
  await mkdir(target, { recursive: true });
  await cp(TEMPLATE_DIR, target, {
    recursive: true,
    filter: async (source, destination) => {
      if (TEMPLATE_SKIP.test(path.basename(source))) return false;
      if ((await stat(source)).isDirectory()) return true;
      if (source === path.join(TEMPLATE_DIR, 'package.json')) return false;
      if (!(await pathExists(destination))) return true;
      kept.push(path.relative(TEMPLATE_DIR, source).split(path.sep).join('/'));
      return false;
    },
  });

  const pkg = existing ? mergePackageJson(existing, template) : { ...template };
  if (flags.database === 'postgres') {
    pkg.dependencies = withMissing(pkg.dependencies, { pg: pgVersion() }, (name) =>
      Boolean(pkg.dependencies?.[name] ?? pkg.devDependencies?.[name]),
    );
  }
  if (flags.name || !existing?.name) pkg.name = sanitizeName(flags.name ?? path.basename(target));
  const keepOpenForm =
    !flags.openFormVersion &&
    (Object.hasOwn(existing?.dependencies ?? {}, PACKAGE_NAME) ||
      Object.hasOwn(existing?.devDependencies ?? {}, PACKAGE_NAME));
  if (!keepOpenForm) {
    pkg.dependencies = {
      ...pkg.dependencies,
      [PACKAGE_NAME]: flags.openFormVersion ?? `^${readPackageVersion()}`,
    };
  }
  await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

  const zone = flags.timeZone ?? localTimeZone();
  if (zone && !kept.includes('open-form.config.ts')) {
    const configPath = path.join(target, 'open-form.config.ts');
    const source = await readFile(configPath, 'utf8');
    await writeFile(configPath, source.replace("timeZone: 'UTC'", `timeZone: '${zone}'`));
  }

  await writeGitignore(target);
  let databaseUrl: ScaffoldResult['databaseUrl'];
  if (flags.database === 'postgres') {
    await setEnv(path.join(target, '.env.example'), 'OPEN_FORM_DATABASE_URL', DATABASE_URL_EXAMPLE);
    if (flags.databaseUrl?.trim()) {
      databaseUrl = (await setEnv(
        path.join(target, '.env'),
        'OPEN_FORM_DATABASE_URL',
        flags.databaseUrl.trim(),
        { secret: true },
      ))
        ? 'saved'
        : 'kept';
    }
  }

  const pm = flags.pm ?? 'pnpm';
  for (const guide of ['AGENTS.md', 'README.md', 'themes/README.md']) {
    if (pm === 'pnpm' || kept.includes(guide)) continue;
    const file = path.join(target, guide);
    await writeFile(file, forPackageManager(await readFile(file, 'utf8'), pm));
  }

  const claudeMd = path.join(target, 'CLAUDE.md');
  if (await pathExists(claudeMd)) kept.push('CLAUDE.md');
  else if (IS_WINDOWS) await cp(path.join(target, 'AGENTS.md'), claudeMd);
  else await symlink('AGENTS.md', claudeMd);

  await syncSkills(target, { quiet: true });
  return { kept: kept.sort(), pkg, databaseUrl };
}

function run(cmd: string, args: string[], cwd: string): Promise<{ ok: boolean; output: string }> {
  return new Promise((resolve) => {
    let output = '';
    const child = spawn(cmd, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], shell: IS_WINDOWS });
    child.stdout?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      output += chunk.toString();
    });
    child.on('error', (err) => resolve({ ok: false, output: err.message }));
    child.on('close', (code) => resolve({ ok: code === 0, output }));
  });
}

function lastLines(output: string): string {
  return output.trim().split('\n').slice(-12).join('\n');
}

export type GitInitResult =
  | { status: 'inside-repo' | 'failed' | 'committed' }
  | { status: 'uncommitted'; output: string };

export async function gitInit(cwd: string): Promise<GitInitResult> {
  // A workspace inside an existing repository (e.g. a monorepo package) belongs to that repository.
  const inside = await run('git', ['rev-parse', '--is-inside-work-tree'], cwd);
  if (inside.ok && inside.output.trim() === 'true') return { status: 'inside-repo' };
  if (!(await run('git', ['init', '-q'], cwd)).ok) return { status: 'failed' };
  await run('git', ['add', '-A'], cwd);
  const commit = await run(
    'git',
    ['commit', '-q', '-m', 'Initial commit from open-form init'],
    cwd,
  );
  return commit.ok ? { status: 'committed' } : { status: 'uncommitted', output: commit.output };
}

/** The template's guides say `pnpm`; a workspace gets its own package manager's commands. */
export function forPackageManager(text: string, pm: PackageManager): string {
  if (pm === 'pnpm') return text;
  const lines = text.split('\n');
  // A commands block lines its comments up in one column; longer commands overflow it.
  const COMMENTED = /^(\S.*?) {2,}(# .*)$/;
  const columns = new Map<number, number>();
  for (const line of lines) {
    const match = COMMENTED.exec(line);
    if (match) {
      const at = line.length - (match[2] as string).length;
      columns.set(at, (columns.get(at) ?? 0) + 1);
    }
  }
  const column = [...columns].sort((a, b) => b[1] - a[1])[0]?.[0];
  return lines
    .map((line) => {
      const next = line
        .replaceAll('pnpm exec ', `${EXEC[pm]} `)
        .replace(/\bpnpm (dev|build|start|typecheck|sync:skills)\b/g, `${RUN[pm]} $1`);
      const before = COMMENTED.exec(line);
      const after = COMMENTED.exec(next);
      if (next === line || !before || !after || column === undefined) return next;
      if (line.length - (before[2] as string).length !== column) return next;
      const command = after[1] as string;
      return `${command}${' '.repeat(Math.max(2, column - command.length))}${after[2]}`;
    })
    .join('\n');
}

/** Quotes a path for the user to paste into their shell, only when it needs it. */
export function shellQuote(value: string, windows = IS_WINDOWS): string {
  // cmd and PowerShell both take double quotes; `"` can't be in a Windows path.
  if (windows) return /^[\w@+:,./\\-]+$/.test(value) ? value : `"${value}"`;
  return /^[\w@+:,./-]+$/.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;
}

function unwrap<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    p.cancel('Cancelled.');
    process.exit(130);
  }
  return value as T;
}

export async function init(dirArg: string | undefined, flags: InitFlags): Promise<void> {
  const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY);
  p.intro(
    `${chalk.bgHex('#4f46e5').white.bold(' open-form ')} ${chalk.dim(`v${readPackageVersion()}`)}`,
  );

  let dir = dirArg;
  if (dir === undefined && interactive) {
    dir = unwrap<string>(
      await p.text({
        message: 'Where should we create your forms workspace?',
        placeholder: 'my-forms',
        defaultValue: 'my-forms',
      }),
    );
  }
  dir ??= 'my-forms';
  const target = path.resolve(process.cwd(), dir);

  if (!flags.force && (await isNonEmpty(target))) {
    if (!interactive) throw new Error(`${target} is not empty. Pass --force to scaffold anyway.`);
    const ok = unwrap<boolean>(
      await p.confirm({
        message: `${chalk.yellow(dir)} is not empty. Add Open Form? Existing files are kept.`,
        initialValue: false,
      }),
    );
    if (!ok) {
      p.outro(chalk.dim('Nothing written.'));
      return;
    }
  }

  let database = flags.database;
  if (!database && interactive) {
    database = unwrap<Database>(
      await p.select({
        message: 'Where should responses be stored?',
        initialValue: 'sqlite' as Database,
        options: [
          { value: 'sqlite', label: 'SQLite', hint: 'a file in .open-form/, nothing to set up' },
          {
            value: 'postgres',
            label: 'Postgres',
            hint: 'Supabase, Neon, RDS… for serverless hosts',
          },
        ],
      }),
    );
  }
  let databaseUrl = flags.databaseUrl ?? process.env.OPEN_FORM_DATABASE_URL;
  if (database === 'postgres' && !databaseUrl && interactive) {
    databaseUrl = unwrap<string>(
      await p.password({
        message: `Postgres connection string ${chalk.dim('(saved to .env only; leave empty to add it later)')}`,
        validate: (value) => databaseUrlProblem(value ?? ''),
      }),
    );
  }
  const urlProblem = database === 'postgres' && databaseUrl && databaseUrlProblem(databaseUrl);
  if (urlProblem) throw new Error(`OPEN_FORM_DATABASE_URL: ${urlProblem}`);

  const pm = flags.pm ?? detectPackageManager();
  const {
    kept,
    pkg,
    databaseUrl: savedUrl,
  } = await scaffold(target, { ...flags, pm, database, databaseUrl });
  p.log.step(`Created workspace in ${chalk.dim(path.relative(process.cwd(), target) || '.')}`);
  if (kept.length > 0) p.log.info(`Kept your existing ${kept.join(', ')}`);
  if (database === 'postgres') {
    p.log.step(
      savedUrl === 'saved'
        ? `Saved the Postgres connection string to ${chalk.bold('.env')} ${chalk.dim('(git ignores it)')}`
        : savedUrl === 'kept'
          ? `Kept the OPEN_FORM_DATABASE_URL already in ${chalk.bold('.env')}`
          : `Add your Postgres connection string to ${chalk.bold('.env')} as OPEN_FORM_DATABASE_URL ${chalk.dim('(see .env.example)')}`,
    );
  }

  let installed = false;
  if (flags.install !== false) {
    const spinner = interactive ? p.spinner() : undefined;
    if (spinner) spinner.start(`Installing dependencies with ${pm}`);
    else p.log.step(`Installing dependencies with ${pm}`);
    const result = await run(pm, ['install'], target);
    installed = result.ok;
    if (result.ok) {
      if (spinner) spinner.stop(`Installed dependencies with ${pm}`);
      else p.log.step(`Installed dependencies with ${pm}`);
    } else {
      if (spinner) spinner.error('Dependency install failed');
      else p.log.error('Dependency install failed');
      p.log.message(chalk.dim(lastLines(result.output)));
    }
  }

  if (flags.git !== false) {
    const git = await gitInit(target);
    if (git.status === 'committed') p.log.step('Initialized git repository');
    if (git.status === 'uncommitted') {
      p.log.warn('Initialized git repository, but the initial commit failed');
      p.log.message(chalk.dim(lastLines(git.output)));
    }
  }

  const dev = pkg.scripts?.dev !== 'open-form dev' ? `${EXEC[pm]} open-form dev` : `${RUN[pm]} dev`;
  const next = [
    ...(target !== process.cwd() ? [`cd ${shellQuote(dir)}`] : []),
    ...(installed ? [] : [`${pm} install`]),
    dev,
  ];
  p.note(next.map((line) => chalk.cyan(line)).join('\n'), 'Next steps');
  p.outro(`Then ask your agent: ${chalk.italic('“Create a registration form for our meetup”')}`);
}
