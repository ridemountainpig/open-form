import { existsSync } from 'node:fs';
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { deleteForm } from '../editing/delete-form.ts';
import { findReferenceTheme, writeFormTheme } from '../editing/theme-files.ts';
import { resolveDatabasePath } from '../node/secret.ts';
import { isLocale, LOCALES, type Locale, pickTokens, type Theme } from '../schema/index.ts';
import type { FormDefinition } from '../server/index.ts';
import { exportFormResponses, FORM_ID_RE } from '../server/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';
import { createDevRegistry } from '../vite/api-plugin.ts';
import { findForms, loadUserConfig, projectPaths } from '../vite/project.ts';
import { withSsrServer } from './check.ts';
import { glyph, table } from './ui.ts';

/**
 * `contact` → `ContactForm`. The bare PascalCase id could be one of the starter's
 * imports (`form` → a `Form` that renders itself forever) or shadow a global the
 * form may use (`date` → `Date`), so the name always has `Form` plus something else.
 */
export function componentName(id: string): string {
  const words = id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1));
  if (words.at(-1) === 'Form') words.pop();
  const base = words.join('');
  if (!base) return 'MyForm';
  return /^\d/.test(base) ? `Form${base}` : `${base}Form`;
}

function titleCase(id: string): string {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

function singleQuoted(text: string): string {
  return `'${JSON.stringify(text).slice(1, -1).replaceAll('\\"', '"').replaceAll("'", "\\'")}'`;
}

export function starterForm(id: string, title: string, locale?: Locale): string {
  return `import { defineForm, Email, Form, Submit, Text, Textarea } from '@open-form-build/core';
import theme from './theme/index.ts';

export const config = defineForm({
  title: ${singleQuoted(title)},
  description: 'Tell us a little about yourself.',${locale ? `\n  locale: '${locale}',` : ''}
});

export default function ${componentName(id)}() {
  return (
    <Form theme={theme}>
      <Text name="name" label="Name" required autoComplete="name" />
      <Email name="email" label="Email" required />
      <Textarea name="message" label="Message" maxLength={2000} />
      <Submit>Send</Submit>
    </Form>
  );
}
`;
}

export async function createForm(
  id: string,
  opts: { title?: string; theme?: string; locale?: string } = {},
): Promise<string> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) {
    throw new Error(`Form ids are kebab-case (letters, digits, "-"): got "${id}".`);
  }
  const { locale } = opts;
  if (locale !== undefined && !isLocale(locale)) {
    throw new Error(`Unknown locale "${locale}". Use one of: ${LOCALES.join(', ')}.`);
  }
  const userCwd = process.cwd();
  const { formsRoot } = projectPaths(userCwd, await loadUserConfig(userCwd));
  const dir = path.join(formsRoot, id);
  if (existsSync(dir)) throw new Error(`forms/${id} already exists.`);
  const reference = opts.theme ? await findReferenceTheme(userCwd, opts.theme) : undefined;
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, 'index.tsx');
  let themeLines = '';
  try {
    await writeFile(file, starterForm(id, opts.title ?? titleCase(id), locale));
    if (reference) {
      const tokens = await withSsrServer(userCwd, async (server) => {
        const mod = (await server.ssrLoadModule(reference.file)) as { default?: Theme };
        if (!mod.default) throw new Error(`${reference.file} has no default export.`);
        return pickTokens(mod.default);
      });
      const result = await writeFormTheme(userCwd, id, { tokens, themeFile: reference.file });
      const from =
        reference.source === 'project' ? `themes/${opts.theme}` : `the ${opts.theme} starter`;
      const doc =
        reference.source === 'project'
          ? `themes/${opts.theme}/THEME.md`
          : `node_modules/@open-form-build/core/themes/${opts.theme}/THEME.md`;
      const fonts = result.fonts.length ? ` and ${result.fonts.join(', ')}` : '';
      const spare = result.spareFonts.length
        ? `    ${chalk.dim(`Also copied ${result.spareFonts.join(', ')} to theme/fonts/; import their .css if you use them`)}\n`
        : '';
      themeLines =
        `    ${chalk.dim(`Its look starts from ${from}'s tokens${fonts} in`)} ${path.relative(userCwd, result.file)}\n` +
        spare +
        `    ${chalk.dim('Write its styles and components for this form, reading')} ${doc}\n`;
    } else {
      await writeFormTheme(userCwd, id);
    }
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  }
  const rel = path.relative(userCwd, file);
  process.stdout.write(`\n  ${chalk.green(glyph.check)} Created ${chalk.bold(rel)}\n${themeLines}`);
  process.stdout.write(`    ${chalk.dim('Preview at')} ${chalk.cyan(`/f/${id}`)}\n\n`);
  return file;
}

export type DeleteFlags = { yes?: boolean };

/** `open-form delete <id>`: the form's folder and everything stored for it, after a typed confirmation. */
export async function deleteFormCommand(id: string, flags: DeleteFlags = {}): Promise<void> {
  if (!FORM_ID_RE.test(id)) throw new Error(`Invalid form id "${id}".`);
  const userCwd = process.cwd();
  const config = await loadUserConfig(userCwd);
  const { formsRoot } = projectPaths(userCwd, config);
  const dir = path.join(formsRoot, id);
  const dbPath = resolveDatabasePath(userCwd, config.storage?.path);
  const storage = existsSync(dbPath) ? await createSqliteStorage({ path: dbPath }) : undefined;
  try {
    const responses = storage ? await storage.countSubmissions(id) : 0;
    const stored = storage ? (await storage.listFormVersions(id)).length > 0 : false;
    const hasFolder = existsSync(dir);
    if (!hasFolder && !stored && responses === 0) {
      throw new Error(`No form "${id}" in ${path.relative(userCwd, formsRoot) || '.'}/.`);
    }
    const folder = `${path.relative(userCwd, dir)}/`;
    const counted = `${responses} ${responses === 1 ? 'response' : 'responses'}`;
    const what = hasFolder ? `${folder} and ${counted}` : `the ${counted} stored for "${id}"`;

    if (!flags.yes) {
      if (!process.stdin.isTTY || !process.stdout.isTTY) {
        throw new Error(`This deletes ${what} for good. Pass --yes to confirm.`);
      }
      const answer = await p.text({
        message: `Delete ${what}? This can't be undone. Type ${chalk.bold(id)} to confirm.`,
        validate: (value) => (value === id ? undefined : `Type ${id} exactly, or press Esc.`),
      });
      if (p.isCancel(answer)) {
        p.cancel('Nothing deleted.');
        return;
      }
    }

    await deleteForm({ formsRoot, id, storage });
    process.stdout.write(`\n  ${chalk.green(glyph.check)} Deleted ${what}\n\n`);
  } finally {
    await storage?.close();
  }
}

const TITLE_RE = /defineForm\(\s*\{[\s\S]*?\btitle\s*:\s*(['"`])((?:\\.|(?!\1).)*)\1/;

export async function listForms(): Promise<void> {
  const userCwd = process.cwd();
  const config = await loadUserConfig(userCwd);
  const forms = findForms(projectPaths(userCwd, config).formsRoot);
  if (forms.length === 0) {
    process.stdout.write(`\n  ${chalk.dim('No forms in forms/ yet.')}\n\n`);
    return;
  }
  let counts: Record<string, number> = {};
  const dbPath = resolveDatabasePath(userCwd, config.storage?.path);
  if (existsSync(dbPath)) {
    const storage = await createSqliteStorage({ path: dbPath });
    counts = await storage.countsByForm();
    await storage.close();
  }
  const rows = await Promise.all(
    forms.map(async (form) => {
      const source = await readFile(form.file, 'utf8');
      const title = TITLE_RE.exec(source)?.[2] ?? '';
      return [
        chalk.bold(form.id),
        title,
        String(counts[form.id] ?? 0),
        chalk.dim(path.relative(userCwd, form.file)),
      ];
    }),
  );
  process.stdout.write(`\n${table(['ID', 'TITLE', 'RESPONSES', 'SOURCE'], rows)}\n`);
}

export type ExportFlags = {
  format?: 'csv' | 'json' | 'xlsx';
  out?: string;
};

// C0 and C1 controls other than tab and line breaks; CSI and OSC sequences start with them.
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching them is the point
const CONTROL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;

export function withoutControls(text: string): string {
  return text.replace(CONTROL_RE, '\ufffd');
}

function exportFormat(flags: ExportFlags): NonNullable<ExportFlags['format']> {
  if (flags.format) return flags.format;
  const ext = flags.out ? path.extname(flags.out).toLowerCase() : '';
  return ext === '.json' ? 'json' : ext === '.xlsx' ? 'xlsx' : 'csv';
}

export async function exportResponses(formId: string, flags: ExportFlags): Promise<void> {
  if (!FORM_ID_RE.test(formId)) throw new Error(`Invalid form id "${formId}".`);
  const userCwd = process.cwd();
  const config = await loadUserConfig(userCwd);
  const dbPath = resolveDatabasePath(userCwd, config.storage?.path);
  if (!existsSync(dbPath)) throw new Error(`No database at ${path.relative(userCwd, dbPath)} yet.`);
  const format = exportFormat(flags);
  if (format === 'xlsx' && !flags.out && process.stdout.isTTY) {
    throw new Error('Excel files are binary. Write one with -o responses.xlsx.');
  }

  const definition = format === 'json' ? null : await loadDefinition(userCwd, formId);
  const storage = await createSqliteStorage({ path: dbPath });
  try {
    const { body, count } = await exportFormResponses({
      storage,
      formId,
      format,
      definition,
      projectTimeZone: config.timeZone,
    });
    const output = format === 'json' ? `${body}\n` : body;
    if (!flags.out) {
      // Answers are untrusted: escape sequences in them would drive the terminal.
      process.stdout.write(
        process.stdout.isTTY && typeof output === 'string' ? withoutControls(output) : output,
      );
      return;
    }
    const out = path.resolve(userCwd, flags.out);
    // Personal data: owner-only, like the database it came from.
    await writeFile(out, output, { mode: 0o600 });
    await chmod(out, 0o600);
    process.stderr.write(
      `\n  ${chalk.green(glyph.check)} Exported ${count} responses to ${chalk.bold(shownPath(userCwd, out))}\n\n`,
    );
  } finally {
    await storage.close();
  }
}

/** The form as the server loads it, so the file matches Studio's: current labels, languages, time zone. */
async function loadDefinition(userCwd: string, formId: string): Promise<FormDefinition | null> {
  try {
    return await withSsrServer(userCwd, (server, config) =>
      createDevRegistry(server, projectPaths(userCwd, config)).load(formId),
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message.split('\n')[0] : String(err);
    process.stderr.write(
      `\n  ${chalk.yellow(glyph.warn)} forms/${formId} didn't load (${reason}). Exporting with the columns stored with its responses.\n`,
    );
    return null;
  }
}

/** Relative to the project when the file is inside it, absolute otherwise. */
function shownPath(userCwd: string, file: string): string {
  const rel = path.relative(userCwd, file);
  return rel.startsWith('..') || path.isAbsolute(rel) ? file : rel;
}
