import { existsSync } from 'node:fs';
import { copyFile, cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  THEME_COLOR_KEYS,
  THEME_TOKEN_KEYS,
  type ThemeColors,
  type ThemeTokens,
} from '../schema/index.ts';
import {
  findForms,
  findStarterThemes,
  findThemes,
  formThemeFile,
  loadUserConfig,
  projectPaths,
  THEME_DIR,
  type ThemeEntry,
} from '../vite/project.ts';
import { stringLiteral } from './source-object.ts';
import { addCssImport, fontImports, readFontHeader, stackFamilies } from './theme-fonts.ts';

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
          .replace(/^description: (.*)$/m, `description: Started from the ${id} starter. $1`)
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

export type ReferenceTheme = ThemeEntry & { source: 'project' | 'starter' };

/** A theme in the project's `themes/`, else the starter of that name. */
export async function findReferenceTheme(
  projectRoot: string,
  themeId: string,
): Promise<ReferenceTheme> {
  const { themesRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  const own = findThemes(themesRoot).find((t) => t.id === themeId);
  if (own) return { ...own, source: 'project' };
  const starter = findStarterThemes().find((t) => t.id === themeId);
  if (starter) return { ...starter, source: 'starter' };
  const known = [...findThemes(themesRoot), ...findStarterThemes()].map((t) => t.id);
  throw new Error(
    `No theme "${themeId}" in themes/ or the starters. Available: ${[...new Set(known)].join(', ')}.`,
  );
}

const literal = (value: string) => stringLiteral(value, "'");

function colorLines(colors: ThemeColors, indent: string): string[] {
  return THEME_COLOR_KEYS.flatMap((key) =>
    colors[key] ? [`${indent}${key}: ${literal(colors[key])},`] : [],
  );
}

/**
 * `theme/index.ts` for a form: the given tokens, or the runtime's default look.
 * Laid out one value per line, which Studio's token writer keeps when it edits.
 */
export function formThemeSource(tokens: ThemeTokens = {}): string {
  const lines: string[] = [];
  for (const key of THEME_TOKEN_KEYS) {
    const value = tokens[key];
    if (value) lines.push(`  ${key}: ${literal(value)},`);
  }
  for (const group of ['colors', 'dark'] as const) {
    const value = tokens[group];
    if (value === false) lines.push(`  ${group}: false,`);
    else if (value && colorLines(value, '').length) {
      lines.push(`  ${group}: {`, ...colorLines(value, '    '), '  },');
    }
  }
  const body = lines.length ? `{\n${lines.join('\n')}\n}` : '{}';
  return `import { defineTheme } from '@open-form-build/core';\n\nexport default defineTheme(${body});\n`;
}

export type FormThemeResult = {
  file: string;
  /** Web fonts brought in with the tokens. */
  fonts: string[];
};

/**
 * Write a form's own look file, `forms/<form>/theme/index.ts`. From a reference it
 * takes the tokens and the web fonts they name, nothing else: the reference's CSS
 * and components are for the agent to read and borrow from while writing this
 * form's look, so the form never depends on the reference or carries what it
 * doesn't use.
 */
export async function writeFormTheme(
  projectRoot: string,
  formId: string,
  seed?: { tokens: ThemeTokens; themeFile: string },
): Promise<FormThemeResult> {
  const { formsRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  if (!findForms(formsRoot).some((f) => f.id === formId)) {
    throw new Error(`No form "${formId}" in ${path.relative(projectRoot, formsRoot) || '.'}/.`);
  }
  const existing = formThemeFile(formsRoot, formId);
  if (existing) throw new Error(`${path.relative(projectRoot, existing)} already exists.`);

  const dir = path.join(formsRoot, formId, THEME_DIR);
  await mkdir(dir, { recursive: true });
  let source = formThemeSource(seed?.tokens);
  const fonts: string[] = [];
  if (seed) {
    const named = new Set([
      ...stackFamilies(seed.tokens.font),
      ...stackFamilies(seed.tokens.headingFont),
    ]);
    const from = path.dirname(seed.themeFile);
    for (const spec of fontImports(await readFile(seed.themeFile, 'utf8'))) {
      const css = await readFile(path.join(from, spec), 'utf8').catch(() => null);
      const header = css && readFontHeader(css);
      if (!header || !named.has(header.family.toLowerCase())) continue;
      const slug = path.basename(spec, '.css');
      await mkdir(path.join(dir, 'fonts'), { recursive: true });
      await copyFile(path.join(from, spec), path.join(dir, 'fonts', `${slug}.css`));
      if (existsSync(path.join(from, 'fonts', slug))) {
        await cp(path.join(from, 'fonts', slug), path.join(dir, 'fonts', slug), {
          recursive: true,
        });
      }
      source = addCssImport(source, `./fonts/${slug}.css`);
      fonts.push(header.family);
    }
  }
  const file = path.join(dir, 'index.ts');
  await writeFile(file, source);
  return { file, fonts };
}
