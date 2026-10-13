import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  findForms,
  findStarterThemes,
  findThemes,
  loadUserConfig,
  projectPaths,
  THEME_DIR,
  type ThemeEntry,
} from '../vite/project.ts';
import { fontImports } from './theme-fonts.ts';

const THEME_ID_RE = /^[a-z0-9][a-z0-9-]*$/;
const TEXT_FILE_RE = /\.(tsx?|jsx?|css|md)$/;

export function frontmatter(markdown: string): Record<string, string> {
  const match = /^---\n([\s\S]*?)\n---/.exec(markdown);
  const fields: Record<string, string> = {};
  for (const line of match?.[1]?.split('\n') ?? []) {
    const sep = line.indexOf(':');
    if (sep > 0) fields[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
  }
  return fields;
}

export type ThemeDoc = {
  name?: string;
  description: string;
  layout?: string;
  /** Full THEME.md, if the theme has one. */
  doc: string | null;
};

/** THEME.md next to a folder theme's index file. */
export async function readThemeDoc(themeFile: string): Promise<ThemeDoc> {
  const file = path.join(path.dirname(themeFile), 'THEME.md');
  if (!path.basename(themeFile).startsWith('index.') || !existsSync(file)) {
    return { description: '', doc: null };
  }
  const doc = await readFile(file, 'utf8');
  const fields = frontmatter(doc);
  return { name: fields.name, description: fields.description ?? '', layout: fields.layout, doc };
}

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else out.push(full);
  }
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Point `[data-of-theme="<from>"]` selectors (any quoting) at `<to>`. */
export function rescope(text: string, from: string, to: string): string {
  const id = escapeRegExp(from);
  return text.replace(
    new RegExp(`data-of-theme=(?:(["'])${id}\\1|${id}(?=\\]))`, 'g'),
    (_, quote?: string) => `data-of-theme=${quote ?? ''}${to}${quote ?? ''}`,
  );
}

/** Scopes other than `<scope>` still named in a file, e.g. left by a hand-renamed theme. */
export function otherScopes(text: string, scope: string): string[] {
  const found = new Set<string>();
  for (const match of text.matchAll(/data-of-theme=(?:(["'])([\w-]+)\1|([\w-]+)(?=\]))/g)) {
    const id = match[2] ?? match[3];
    if (id && id !== scope) found.add(id);
  }
  return [...found];
}

export type AddThemeOptions = { as?: string; force?: boolean };

/**
 * Copy a starter theme into `themes/<name>/`, the project's references for new
 * forms. Theme-scoped selectors are rewritten when the theme is renamed.
 */
export async function addStarterTheme(
  projectRoot: string,
  id: string,
  opts: AddThemeOptions = {},
): Promise<{ name: string; dir: string; files: string[] }> {
  const starters = findStarterThemes();
  const source = starters.find((t) => t.id === id);
  if (!source) {
    throw new Error(
      `No starter theme "${id}". Available: ${starters.map((t) => t.id).join(', ')}.`,
    );
  }
  const name = opts.as ?? id;
  if (!THEME_ID_RE.test(name)) {
    throw new Error(`Theme names are kebab-case (letters, digits, "-"): got "${name}".`);
  }

  const { themesRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  const dir = path.join(themesRoot, name);
  const clash = findThemes(themesRoot).find((t) => t.id === name);
  if (clash && !opts.force) {
    throw new Error(
      `${path.relative(projectRoot, clash.file)} already exists. Pass --force to replace it.`,
    );
  }
  if (clash)
    await rm((await stat(dir).catch(() => null))?.isDirectory() ? dir : clash.file, {
      recursive: true,
      force: true,
    });

  const srcDir = path.dirname(source.file);
  await cp(srcDir, dir, { recursive: true });

  const files = await walk(dir);
  if (name !== id) {
    const title = name
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
    for (const file of files) {
      if (!TEXT_FILE_RE.test(file)) continue;
      const text = await readFile(file, 'utf8');
      let renamed = rescope(text, id, name);
      if (path.basename(file) === 'THEME.md') {
        renamed = renamed
          .replace(/^name: .*$/m, `name: ${title}`)
          .replace(
            /^# .*$/m,
            `# ${title}\n\n> Started from the \`${id}\` starter theme — update this document as the theme diverges.`,
          );
      }
      if (renamed !== text) await writeFile(file, renamed);
    }
  }
  return { name, dir, files: files.map((f) => path.relative(projectRoot, f)) };
}

export type CopyThemeResult = {
  /** Where the theme came from: the project's `themes/` or a starter. */
  source: 'project' | 'starter';
  dir: string;
  files: string[];
  /** What the form imports: `./theme/index.tsx`. */
  importPath: string;
  warnings: string[];
};

/**
 * Copy a theme into a form, `forms/<form>/theme/`: from then on the form owns its
 * look, and changing or deleting the theme in `themes/` never touches it. The
 * theme's scoped selectors are rewritten to the form id, the scope the runtime
 * gives a form's own theme. THEME.md stays behind with the reference.
 */
export async function copyThemeToForm(
  projectRoot: string,
  themeId: string,
  formId: string,
  opts: { force?: boolean } = {},
): Promise<CopyThemeResult> {
  const { themesRoot, formsRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  const own = findThemes(themesRoot).find((t) => t.id === themeId);
  const starter = own ? undefined : findStarterThemes().find((t) => t.id === themeId);
  const theme: ThemeEntry | undefined = own ?? starter;
  if (!theme) {
    const known = [...findThemes(themesRoot), ...findStarterThemes()].map((t) => t.id);
    throw new Error(
      `No theme "${themeId}" in themes/ or the starters. Available: ${[...new Set(known)].join(', ')}.`,
    );
  }
  if (!findForms(formsRoot).some((f) => f.id === formId)) {
    throw new Error(`No form "${formId}" in ${path.relative(projectRoot, formsRoot) || '.'}/.`);
  }

  const dir = path.join(formsRoot, formId, THEME_DIR);
  if (existsSync(dir)) {
    if (!opts.force) {
      throw new Error(
        `${path.relative(projectRoot, dir)}/ already exists. Pass --force to replace it.`,
      );
    }
    await rm(dir, { recursive: true, force: true });
  }

  const ext = path.extname(theme.file);
  if (path.basename(theme.file).startsWith('index.')) {
    await cp(path.dirname(theme.file), dir, {
      recursive: true,
      filter: (src) => path.basename(src) !== 'THEME.md',
    });
  } else {
    await mkdir(dir, { recursive: true });
    await copyFile(theme.file, path.join(dir, `index${ext}`));
    // A single-file theme's fonts sit in the shared themes/fonts/; the form takes the ones it imports.
    const fonts = path.join(path.dirname(theme.file), 'fonts');
    for (const spec of fontImports(await readFile(theme.file, 'utf8'))) {
      const slug = path.basename(spec, '.css');
      if (!existsSync(path.join(fonts, `${slug}.css`))) continue;
      await mkdir(path.join(dir, 'fonts'), { recursive: true });
      await copyFile(path.join(fonts, `${slug}.css`), path.join(dir, 'fonts', `${slug}.css`));
      if (existsSync(path.join(fonts, slug))) {
        await cp(path.join(fonts, slug), path.join(dir, 'fonts', slug), { recursive: true });
      }
    }
  }

  const files = await walk(dir);
  const warnings: string[] = [];
  for (const file of files) {
    if (!TEXT_FILE_RE.test(file)) continue;
    const text = await readFile(file, 'utf8');
    const scoped = rescope(text, themeId, formId);
    if (scoped !== text) await writeFile(file, scoped);
    for (const scope of otherScopes(scoped, formId)) {
      warnings.push(
        `${path.relative(projectRoot, file)} still targets [data-of-theme="${scope}"]; change it to "${formId}" or it won't apply.`,
      );
    }
  }
  return {
    source: own ? 'project' : 'starter',
    dir,
    files: files.map((f) => path.relative(projectRoot, f)),
    importPath: `./${THEME_DIR}/index${ext}`,
    warnings,
  };
}
