import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfigFromFile } from 'vite';
import {
  localeProblem,
  type OpenFormConfig,
  studioProblem,
  timeZoneProblem,
} from '../schema/index.ts';
import { FORM_ID_RE } from '../server/index.ts';

export const CONFIG_FILE = 'open-form.config.ts';
/** What workspaces install and forms import. */
export const PACKAGE_NAME = '@open-form-build/core';
const ENTRY_RE = /^index\.(tsx|jsx|ts|js)$/;
const THEME_FILE_RE = /^([A-Za-z0-9][\w-]*)\.(tsx|ts|jsx|js|mjs)$/;

function findPackageRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  while (dir !== path.dirname(dir)) {
    const pkg = path.join(dir, 'package.json');
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, 'utf8')).name === PACKAGE_NAME) return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`Could not locate the ${PACKAGE_NAME} package root from ${fromFile}`);
}

export const PKG_ROOT = findPackageRoot(fileURLToPath(import.meta.url));
export const SRC_ROOT = path.join(PKG_ROOT, 'src');
export const APP_ROOT = path.join(SRC_ROOT, 'app');
export const DEFINITION_MODULE = path.join(SRC_ROOT, 'react', 'definition.ts');
/** Starter themes shipped with the package, copied into a project's `themes/` on request. */
export const STARTER_THEMES_ROOT = path.join(PKG_ROOT, 'themes');

export function readPackageVersion(): string {
  try {
    return (
      JSON.parse(readFileSync(path.join(PKG_ROOT, 'package.json'), 'utf8')) as { version: string }
    ).version;
  } catch {
    return '0.0.0';
  }
}

export type FormEntry = { id: string; file: string };

export function findForms(formsRoot: string): FormEntry[] {
  if (!existsSync(formsRoot)) return [];
  const forms: FormEntry[] = [];
  for (const dirent of readdirSync(formsRoot, { withFileTypes: true })) {
    if (!dirent.isDirectory() || !FORM_ID_RE.test(dirent.name)) continue;
    const dir = path.join(formsRoot, dirent.name);
    const entry = readdirSync(dir).find((name) => ENTRY_RE.test(name));
    if (entry) forms.push({ id: dirent.name, file: path.join(dir, entry) });
  }
  return forms.sort((a, b) => a.id.localeCompare(b.id));
}

/** `themes/<id>.ts(x)` or, for themes with their own components and CSS, `themes/<id>/index.ts(x)`. */
export function findThemes(themesRoot: string): FormEntry[] {
  if (!existsSync(themesRoot) || !statSync(themesRoot).isDirectory()) return [];
  const themes = new Map<string, string>();
  for (const dirent of readdirSync(themesRoot, { withFileTypes: true })) {
    if (dirent.isDirectory()) {
      if (!FORM_ID_RE.test(dirent.name)) continue;
      const dir = path.join(themesRoot, dirent.name);
      const entry = readdirSync(dir).find((name) => ENTRY_RE.test(name));
      if (entry) themes.set(dirent.name, path.join(dir, entry));
      continue;
    }
    const match = THEME_FILE_RE.exec(dirent.name);
    if (match && !dirent.name.endsWith('.d.ts') && !themes.has(match[1] as string)) {
      themes.set(match[1] as string, path.join(themesRoot, dirent.name));
    }
  }
  return [...themes].map(([id, file]) => ({ id, file })).sort((a, b) => a.id.localeCompare(b.id));
}

export type ThemeEntry = FormEntry;

/** The project's themes: references agents read when writing a form's own look. */
export function resolveThemes(themesRoot: string): ThemeEntry[] {
  return findThemes(themesRoot);
}

/** The folder inside a form that holds its own look: `forms/<id>/theme/`. */
export const THEME_DIR = 'theme';

/** A form's own theme entry, `forms/<id>/theme/index.ts(x)`, if it has one. */
export function formThemeFile(formsRoot: string, formId: string): string | null {
  const dir = path.join(formsRoot, formId, THEME_DIR);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return null;
  const entry = readdirSync(dir).find((name) => ENTRY_RE.test(name));
  return entry ? path.join(dir, entry) : null;
}

export function findStarterThemes(): ThemeEntry[] {
  return findThemes(STARTER_THEMES_ROOT);
}

/** The theme id a file belongs to: `themes/<id>.ts` or anything under `themes/<id>/`. */
export function themeIdForFile(themesRoot: string, file: string): string | null {
  const rel = path.relative(themesRoot, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const [first, ...rest] = rel.split(path.sep);
  if (!first) return null;
  const id = rest.length ? first : first.replace(/\.[^.]+$/, '');
  return FORM_ID_RE.test(id) ? id : null;
}

/** The form id a file belongs to, if it lives under `forms/<id>/`. */
/** Newest mtime among a form folder's files (ISO), for "recently edited". */
export function formUpdatedAt(file: string): string | undefined {
  const dir = path.dirname(file);
  let newest = 0;
  const walk = (current: string, depth: number) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (depth < 2 && entry.name !== 'node_modules') walk(full, depth + 1);
      } else {
        newest = Math.max(newest, statSync(full).mtimeMs);
      }
    }
  };
  try {
    walk(dir, 0);
  } catch {
    return undefined;
  }
  return newest ? new Date(newest).toISOString() : undefined;
}

export function formIdForFile(formsRoot: string, file: string): string | null {
  const rel = path.relative(formsRoot, file);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) return null;
  const [id, ...rest] = rel.split(path.sep);
  if (!id || rest.length === 0 || !FORM_ID_RE.test(id)) return null;
  return id;
}

export async function loadUserConfig(userCwd: string): Promise<OpenFormConfig> {
  const file = path.join(userCwd, CONFIG_FILE);
  if (!existsSync(file)) return {};
  // The default 'bundle' loader compiles to CommonJS unless package.json says
  // "type": "module", and CommonJS can't load the ESM-only `@open-form-build/core` import.
  // The runner sets NODE_ENV=development when it's unset; left that way, a later
  // `open-form build` would compile JSX for development.
  const nodeEnv = process.env.NODE_ENV;
  let loaded: Awaited<ReturnType<typeof loadConfigFromFile>>;
  try {
    loaded = await loadConfigFromFile(
      { command: 'serve', mode: 'development' },
      file,
      userCwd,
      'silent',
      undefined,
      'runner',
    );
  } finally {
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
  const config = (loaded?.config ?? {}) as OpenFormConfig;
  const problem =
    localeProblem(config.locale) ??
    timeZoneProblem(config.timeZone) ??
    studioProblem(config.studio);
  if (problem) throw new Error(`${CONFIG_FILE}: ${problem}`);
  return config;
}

/** Has `open-form.config.ts`, or a package.json that depends on `@open-form-build/core`. */
export function isWorkspace(dir: string): boolean {
  if (existsSync(path.join(dir, CONFIG_FILE))) return true;
  try {
    const pkg = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return Boolean(pkg.dependencies?.[PACKAGE_NAME] ?? pkg.devDependencies?.[PACKAGE_NAME]);
  } catch {
    return false;
  }
}

/**
 * For commands that write into the current folder: run anywhere else (say, the
 * home folder), `dev` and `sync:skills` would put skills in `~/.claude/skills`,
 * which applies to every project, and a secret in `~/.open-form`.
 */
export function assertWorkspace(dir: string, command: string): void {
  if (isWorkspace(dir)) return;
  throw new Error(
    `${dir} isn't an Open Form workspace: there's no ${CONFIG_FILE}, and package.json doesn't depend on ${PACKAGE_NAME}.\n` +
      `    cd into your workspace and run \`open-form ${command}\` there, or create one with \`npm create open-form@latest\`.`,
  );
}

export type ProjectPaths = {
  userCwd: string;
  formsRoot: string;
  themesRoot: string;
};

export function projectPaths(userCwd: string, config: OpenFormConfig): ProjectPaths {
  return {
    userCwd,
    formsRoot: path.resolve(userCwd, config.formsDir ?? 'forms'),
    themesRoot: path.resolve(userCwd, config.themesDir ?? 'themes'),
  };
}
