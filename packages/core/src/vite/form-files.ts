import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import type { ProjectPaths } from './project.ts';
import { StudioError } from './studio-http.ts';

// Shared by the dev-only Studio endpoints that read and rewrite form sources.

const SOURCE_RE = /\.(tsx|jsx|ts|js)$/;

export function sourceFiles(dir: string, depth = 0): string[] {
  if (!existsSync(dir) || depth > 3) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory())
      return entry.name === 'node_modules' ? [] : sourceFiles(full, depth + 1);
    return SOURCE_RE.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });
}

/** Project-relative with `/`, as the dev server stamps it in `data-of-loc`. */
export function displayPath(paths: ProjectPaths, file: string): string {
  return path.relative(paths.userCwd, file).split(path.sep).join('/');
}

/** A source file inside `forms/`, from the project-relative path Studio was given. */
export function resolveFormSource(paths: ProjectPaths, value: unknown): string {
  if (typeof value !== 'string') throw new StudioError(400, 'Missing file.');
  const file = path.resolve(paths.userCwd, value);
  const rel = path.relative(paths.formsRoot, file);
  if (rel.startsWith('..') || path.isAbsolute(rel) || !SOURCE_RE.test(file) || !existsSync(file)) {
    throw new StudioError(404, `No form source "${value}".`);
  }
  return file;
}

/** `forms/<id>/index.tsx:12:7` → the file and position, checked to be a form source. */
export function resolveLoc(
  paths: ProjectPaths,
  loc: unknown,
): { file: string; line: number; column: number } {
  const match = typeof loc === 'string' ? /^(.+):(\d+):(\d+)$/.exec(loc) : null;
  if (!match) throw new StudioError(400, 'loc must look like "forms/<id>/index.tsx:12:7".');
  return {
    file: resolveFormSource(paths, match[1]),
    line: Number(match[2]),
    column: Number(match[3]),
  };
}

/** The form folder a source file belongs to: `forms/<id>`. */
export function formDirOf(paths: ProjectPaths, file: string): string {
  const [id] = path.relative(paths.formsRoot, file).split(path.sep);
  return path.join(paths.formsRoot, id ?? '');
}

let queue: Promise<unknown> = Promise.resolve();

/** Run form-source edits one at a time: each one reads the file it is about to replace. */
export function queueFormEdit<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn);
  queue = run.catch(() => {});
  return run;
}
