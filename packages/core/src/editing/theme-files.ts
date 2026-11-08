import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  THEME_COLOR_KEYS,
  THEME_TOKEN_KEYS,
  type ThemeColors,
  type ThemeTokens,
} from '../schema/index.ts';
import {
  findForms,
  formThemeFile,
  loadUserConfig,
  projectPaths,
  THEME_DIR,
} from '../vite/project.ts';
import { stringLiteral } from './source-object.ts';

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

/**
 * Write a form's own look file, `forms/<form>/theme/index.ts`, with the runtime's
 * default look for the agent or Studio's Adjust to build on.
 */
export async function writeFormTheme(projectRoot: string, formId: string): Promise<string> {
  const { formsRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  if (!findForms(formsRoot).some((f) => f.id === formId)) {
    throw new Error(`No form "${formId}" in ${path.relative(projectRoot, formsRoot) || '.'}/.`);
  }
  const existing = formThemeFile(formsRoot, formId);
  if (existing) throw new Error(`${path.relative(projectRoot, existing)} already exists.`);

  const dir = path.join(formsRoot, formId, THEME_DIR);
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'index.ts');
  await writeFile(file, formThemeSource());
  return file;
}
