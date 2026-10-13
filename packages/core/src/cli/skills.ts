import { createHash } from 'node:crypto';
import { existsSync, watch } from 'node:fs';
import { cp, lstat, mkdir, readdir, readFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { PKG_ROOT } from '../vite/project.ts';

export const BUILTIN_SKILLS_DIR = path.join(PKG_ROOT, 'skills');
const IS_WINDOWS = process.platform === 'win32';

export type SkillStatus = 'added' | 'updated' | 'unchanged';
export type SkillDrift = { name: string; status: SkillStatus };

async function hashDir(dir: string): Promise<string> {
  const hash = createHash('sha256');
  const walk = async (current: string) => {
    const entries = (await readdir(current, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      hash.update(path.relative(dir, full));
      if (entry.isDirectory()) await walk(full);
      else hash.update(await readFile(full));
    }
  };
  await walk(dir);
  return hash.digest('hex');
}

async function builtinSkills(): Promise<string[]> {
  if (!existsSync(BUILTIN_SKILLS_DIR)) return [];
  return (await readdir(BUILTIN_SKILLS_DIR, { withFileTypes: true }))
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

async function skillsDrift(projectRoot: string): Promise<SkillDrift[]> {
  const results: SkillDrift[] = [];
  for (const name of await builtinSkills()) {
    const dst = path.join(projectRoot, '.agents', 'skills', name);
    const status: SkillStatus = !existsSync(dst)
      ? 'added'
      : (await hashDir(dst)) === (await hashDir(path.join(BUILTIN_SKILLS_DIR, name)))
        ? 'unchanged'
        : 'updated';
    results.push({ name, status });
  }
  return results;
}

async function linkSkill(projectRoot: string, name: string): Promise<void> {
  const linkDir = path.join(projectRoot, '.claude', 'skills');
  const link = path.join(linkDir, name);
  await mkdir(linkDir, { recursive: true });
  if (IS_WINDOWS) {
    await rm(link, { recursive: true, force: true });
    await cp(path.join(projectRoot, '.agents', 'skills', name), link, { recursive: true });
    return;
  }
  try {
    if ((await lstat(link)).isSymbolicLink()) return;
    await rm(link, { recursive: true, force: true });
  } catch {}
  await symlink(path.join('..', '..', '.agents', 'skills', name), link);
}

/**
 * Copy the built-in skills into `.agents/skills/` and expose each one to Claude
 * Code through a `.claude/skills/<name>` symlink.
 */
export async function syncSkills(
  projectRoot: string,
  opts: { dryRun?: boolean; quiet?: boolean } = {},
): Promise<SkillDrift[]> {
  const drift = await skillsDrift(projectRoot);
  for (const { name, status } of drift) {
    if (!opts.dryRun && status !== 'unchanged') {
      const dst = path.join(projectRoot, '.agents', 'skills', name);
      await rm(dst, { recursive: true, force: true });
      await mkdir(path.dirname(dst), { recursive: true });
      await cp(path.join(BUILTIN_SKILLS_DIR, name), dst, { recursive: true });
    }
    if (!opts.dryRun) await linkSkill(projectRoot, name);
    if (!opts.quiet) {
      const mark =
        status === 'unchanged'
          ? chalk.dim('·')
          : status === 'added'
            ? chalk.green('+')
            : chalk.yellow('~');
      process.stdout.write(`  ${mark} ${name} ${chalk.dim(status)}\n`);
    }
  }
  return drift;
}

export async function updateSkills(projectRoot: string): Promise<string[]> {
  return (await syncSkills(projectRoot, { quiet: true }))
    .filter((d) => d.status !== 'unchanged')
    .map((d) => d.name);
}

/** Re-sync whenever the built-in skills change on disk (e.g. open-form linked from source). */
export function watchSkills(projectRoot: string, onUpdate: (names: string[]) => void): void {
  if (!existsSync(BUILTIN_SKILLS_DIR)) return;
  let timer: NodeJS.Timeout | undefined;
  let queue = Promise.resolve();
  const watcher = watch(BUILTIN_SKILLS_DIR, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      queue = queue
        .then(() => updateSkills(projectRoot))
        .then((names) => {
          if (names.length > 0) onUpdate(names);
        })
        .catch(() => {});
    }, 150);
  });
  watcher.on('error', () => watcher.close());
  watcher.unref();
}
