import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { createServer, mergeConfig, type ViteDevServer } from 'vite';
import { importsOwnTheme } from '../editing/form-theme.ts';
import { parseSource, walk } from '../editing/loc-tags.ts';
import { faceSubset, isKeptFace, parseFontFaces, readFontHeader } from '../editing/theme-fonts.ts';
import {
  describeCondition,
  type FieldSchema,
  type FormConfig,
  formLocales,
  formTimeZone,
  isWallClockDate,
  type OpenFormConfig,
  translationCoverage,
} from '../schema/index.ts';
import type { FormDefinition } from '../server/index.ts';
import { createDevRegistry } from '../vite/api-plugin.ts';
import { createViteConfig } from '../vite/config.ts';
import { sourceFiles } from '../vite/form-files.ts';
import {
  CONFIG_FILE,
  findForms,
  formThemeFile,
  loadUserConfig,
  PKG_ROOT,
  type ProjectPaths,
  projectPaths,
  THEME_DIR,
} from '../vite/project.ts';
import { glyph } from './ui.ts';

export type CheckResult =
  | {
      id: string;
      ok: true;
      definition: FormDefinition;
      timeZone: string;
      /** The form's own theme, `forms/<id>/theme/index.tsx`, project-relative. */
      theme: string | null;
      warnings: string[];
    }
  | { id: string; ok: false; error: string };

/** A Vite server that never listens — for loading forms and themes the way the app does. */
export async function withSsrServer<T>(
  userCwd: string,
  fn: (server: ViteDevServer, config: OpenFormConfig) => Promise<T>,
): Promise<T> {
  const config = await loadUserConfig(userCwd);
  const base = await createViteConfig({ userCwd, config });
  // Vite sets NODE_ENV=development when it's unset; left that way, an `open-form
  // build` later in this process (it checks themes this way) compiles JSX for development.
  const nodeEnv = process.env.NODE_ENV;
  const merged = mergeConfig(base, {
    logLevel: 'silent',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, watch: null },
  });
  const server = await createServer({
    ...merged,
    // A running `open-form dev` serves its pre-bundled deps from the default cache;
    // these different optimizeDeps would rewrite it underneath and blank its pages.
    cacheDir: path.join(PKG_ROOT, 'node_modules', '.vite-ssr'),
    // Nothing is served to a browser, and the optimizer would outlive `close()`,
    // leaving a deps_temp_* folder in the cache each run.
    optimizeDeps: { ...merged.optimizeDeps, noDiscovery: true, include: [] },
  });
  try {
    return await fn(server, config);
  } finally {
    await server.close();
    if (nodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = nodeEnv;
  }
}

/**
 * Load forms exactly as the server does (Vite SSR + render-to-collect) without
 * listening on a port, so agents can verify a form before anyone opens it.
 */
export async function checkForms(userCwd: string, only?: string): Promise<CheckResult[]> {
  return withSsrServer(userCwd, async (server, config) => {
    const paths = projectPaths(userCwd, config);
    const registry = createDevRegistry(server, paths);
    const ids = await registry.list();
    if (only && !ids.includes(only)) {
      throw new Error(`No form "${only}" in forms/. Found: ${ids.join(', ') || 'none'}.`);
    }
    const results: CheckResult[] = [];
    for (const id of only ? [only] : ids) {
      try {
        const definition = await registry.load(id);
        if (!definition) throw new Error(`forms/${id} has no index file.`);
        const theme = formThemeFile(paths.formsRoot, id);
        const shownTheme = theme ? path.relative(userCwd, theme).split(path.sep).join('/') : null;
        const entry = findForms(paths.formsRoot).find((f) => f.id === id);
        const applied = Boolean(entry && importsOwnTheme(readFileSync(entry.file, 'utf8')));
        results.push({
          id,
          ok: true,
          definition,
          timeZone: formTimeZone(definition.config, config.timeZone),
          theme: applied ? shownTheme : null,
          warnings: [
            ...importWarnings(path.join(paths.formsRoot, id), paths),
            ...deadFontWarnings(path.join(paths.formsRoot, id), userCwd),
            ...policyWarnings(definition.config, config),
            ...uniqueWarnings(definition),
            ...(theme && shownTheme && entry && !applied
              ? [unappliedThemeWarning(shownTheme, path.relative(userCwd, entry.file))]
              : []),
            ...(theme && shownTheme && applied
              ? unusedComponentWarnings(
                  shownTheme,
                  await themeComponents(server, theme),
                  definition.components,
                )
              : []),
          ],
        });
      } catch (err) {
        results.push({ id, ok: false, error: err instanceof Error ? err.message : String(err) });
      }
    }
    return results;
  });
}

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*)['"](\.{1,2}\/[^'"]+)['"]/g;

/**
 * A form stands on its own: importing from `themes/` or another form ties its look
 * or behavior to files that can change or disappear without it.
 */
export function importWarnings(
  formDir: string,
  paths: Pick<ProjectPaths, 'formsRoot' | 'themesRoot' | 'userCwd'>,
): string[] {
  const warnings = new Set<string>();
  const inside = (root: string, file: string) => {
    const rel = path.relative(root, file);
    return rel && !rel.startsWith('..') && !path.isAbsolute(rel) ? rel : null;
  };
  for (const file of sourceFiles(formDir)) {
    const shown = path.relative(paths.userCwd, file).split(path.sep).join('/');
    for (const match of readFileSync(file, 'utf8').matchAll(IMPORT_RE)) {
      const target = path.resolve(path.dirname(file), match[1] as string);
      const theme = inside(paths.themesRoot, target);
      if (theme) {
        const id = theme.split(path.sep)[0]?.replace(/\.[^.]+$/, '');
        warnings.add(
          `${shown} imports themes/${id} — themes are references: write what the form needs in its own theme/, reading themes/${id}, so the form keeps its look when the theme changes.`,
        );
        continue;
      }
      if (!inside(formDir, target) && inside(paths.formsRoot, target)) {
        warnings.add(
          `${shown} imports from another form (${match[1]}) — copy what it needs instead.`,
        );
      }
    }
  }
  return [...warnings];
}

const CSS_IMPORT_RE = /@import\s+(?:url\(\s*)?['"]?(\.{1,2}\/[^'")\s;]+)/g;
const CSS_URL_RE = /url\(\s*['"]?([^'")\s]+)/g;
const FONT_FILE_RE = /\.(woff2?|ttf|otf)$/i;
const SOURCE_FILE_RE = /\.(tsx|jsx|ts|js)$/;

function filesUnder(dir: string, test: (name: string) => boolean): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((name) => test(name) && !name.split(path.sep).includes('node_modules'))
    .map((name) => path.join(dir, name));
}

/** The file a relative import or `url()` names, without `?v=1` or `#iefix`. */
function localTarget(dir: string, spec: string): string {
  return path.resolve(dir, spec.replace(/[?#].*$/, ''));
}

/**
 * Font files a form carries but never loads: a `theme/fonts/<slug>.css` nothing
 * imports and its folder, files no stylesheet points at, and faces for scripts
 * outside Open Form's languages, which `theme font` no longer downloads.
 */
export function deadFontWarnings(formDir: string, userCwd: string): string[] {
  const fontsDir = path.join(formDir, THEME_DIR, 'fonts');
  if (!existsSync(fontsDir) || !statSync(fontsDir).isDirectory()) return [];
  const shown = (file: string) => path.relative(userCwd, file).split(path.sep).join('/');
  const inFonts = (file: string) => path.relative(fontsDir, file).split(path.sep).join('/');
  const styles = filesUnder(formDir, (name) => name.endsWith('.css'));
  const sources = filesUnder(
    formDir,
    (name) => SOURCE_FILE_RE.test(name) && !name.endsWith('.d.ts'),
  );
  const imported = new Set<string>();
  for (const file of [...sources, ...styles]) {
    const re = file.endsWith('.css') ? CSS_IMPORT_RE : IMPORT_RE;
    for (const match of readFileSync(file, 'utf8').matchAll(re)) {
      imported.add(localTarget(path.dirname(file), match[1] as string));
    }
  }
  const used = new Set<string>();
  for (const file of styles) {
    if (path.dirname(file) === fontsDir && !imported.has(file)) continue;
    for (const match of readFileSync(file, 'utf8').matchAll(CSS_URL_RE)) {
      const url = match[1] as string;
      if (!/^([a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) used.add(localTarget(path.dirname(file), url));
    }
  }

  const entries = readdirSync(fontsDir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const deadFolders = new Set<string>();
  const strayFiles = new Map<string, string[]>();
  for (const entry of entries.filter((e) => e.isDirectory())) {
    const files = filesUnder(path.join(fontsDir, entry.name), (name) => FONT_FILE_RE.test(name));
    const unused = files.filter((file) => !used.has(file));
    if (unused.length === 0) continue;
    if (unused.length === files.length) deadFolders.add(entry.name);
    else strayFiles.set(entry.name, unused);
  }

  const warnings: string[] = [];
  for (const entry of entries.filter((e) => e.isFile() && e.name.endsWith('.css'))) {
    const file = path.join(fontsDir, entry.name);
    const slug = entry.name.slice(0, -'.css'.length);
    const css = readFileSync(file, 'utf8');
    const header = readFontHeader(css);
    if (!imported.has(file)) {
      const folder = deadFolders.delete(slug);
      warnings.push(
        `${shown(file)} isn't imported, so the form never loads ${header?.family ?? 'it'}: delete it${folder ? ` and its ${slug}/ folder` : ''}.`,
      );
      continue;
    }
    const dropped = header ? parseFontFaces(css).filter((face) => !isKeptFace(face)) : [];
    if (!dropped.length) continue;
    const subsets = new Set(dropped.map(faceSubset));
    const files = new Set(dropped.map((face) => inFonts(localTarget(fontsDir, face.url))));
    warnings.push(
      `${shown(file)} has ${[...subsets].join(', ')} faces, for scripts none of Open Form's languages use: delete those @font-face rules and ${[...files].join(', ')}.`,
    );
  }
  for (const name of deadFolders) {
    warnings.push(`${shown(path.join(fontsDir, name))}/ isn't used by any stylesheet: delete it.`);
  }
  for (const [name, unused] of strayFiles) {
    const folder = path.join(fontsDir, name);
    const names = unused.map((file) => path.relative(folder, file).split(path.sep).join('/'));
    const them = unused.length === 1 ? 'it' : 'them';
    warnings.push(
      `${shown(folder)}/ holds ${names.join(', ')}, which no stylesheet points at: delete ${them}.`,
    );
  }
  return warnings;
}

async function themeComponents(
  server: ViteDevServer,
  file: string,
): Promise<Record<string, unknown> | undefined> {
  try {
    const mod = (await server.ssrLoadModule(file)) as {
      default?: { components?: Record<string, unknown> };
    };
    return mod.default?.components;
  } catch {
    // A theme file the form doesn't import can be broken without breaking the form.
    return undefined;
  }
}

export function unappliedThemeWarning(themeFile: string, formFile: string): string {
  const shown = formFile.split(path.sep).join('/');
  return `${themeFile} isn't applied: ${shown} doesn't import it. Import it and pass it to <Form theme={theme}>, or delete it.`;
}

/** Every form renders these around its fields, whatever the fields are. */
const CHROME_SLOTS = new Set([
  'Layout',
  'LanguageSwitch',
  'Header',
  'Progress',
  'Nav',
  'Button',
  'Success',
  'Notice',
  'Field',
]);

/**
 * A form's look holds only what it uses: a component for a field type the form
 * doesn't have is code nobody reads until it drifts from the rest of the look.
 */
export function unusedComponentWarnings(
  themeFile: string,
  components: Record<string, unknown> | undefined,
  rendered: readonly string[] | undefined,
): string[] {
  if (!components || !rendered) return [];
  const used = new Set(rendered);
  const unused = Object.keys(components).filter(
    (name) => components[name] && !CHROME_SLOTS.has(name) && !used.has(name),
  );
  if (!unused.length) return [];
  const them = unused.length === 1 ? 'it' : 'them';
  return [
    `${themeFile} defines ${unused.join(', ')}, but the form never uses ${them} — a form's look holds only what it uses, so remove ${them}.`,
  ];
}

function fieldLine(field: FieldSchema, pageWhen: number): string {
  const flags = [
    field.required ? 'required' : '',
    field.options ? `${field.options.length} options` : '',
    field.hasCustomValidator ? 'custom validator' : '',
  ].filter(Boolean);
  const own = field.when.slice(pageWhen);
  const condition = own.length
    ? chalk.cyan(`if ${own.map((c) => describeCondition(c)).join(' and ')}`)
    : '';
  return `      ${field.name.padEnd(18)} ${chalk.dim(field.type.padEnd(14))} ${[flags.join(', '), condition].filter(Boolean).join('  ')}`;
}

const dateText = (value: string | Date) => (value instanceof Date ? value.toISOString() : value);

function policyWarnings(config: FormConfig, project: OpenFormConfig): string[] {
  const { opensAt, closesAt } = config.submissions ?? {};
  const zoned = [opensAt, closesAt].some((v) => v !== undefined && isWallClockDate(v));
  if (!zoned || config.timeZone || project.timeZone) return [];
  return [
    "opensAt / closesAt are read in UTC. Set `timeZone` (e.g. 'Asia/Taipei') in open-form.config.ts.",
  ];
}

/** `uniqueBy` only holds for responses that answer the field. */
export function uniqueWarnings(definition: Pick<FormDefinition, 'schema' | 'config'>): string[] {
  const by = definition.config.submissions?.uniqueBy;
  if (!by || by === 'device') return [];
  const field = definition.schema.fields.find((f) => f.name === by);
  if (!field) return [`uniqueBy '${by}' isn't a field in this form, so it limits nothing.`];
  if (!field.required || field.when.length > 0) {
    return [
      `uniqueBy '${by}': responses that leave it blank or hidden aren't limited. Make the field required and always shown.`,
    ];
  }
  return [];
}

function policyLine(config: FormConfig, timeZone: string): string | undefined {
  const s = config.submissions;
  const dates = [
    s?.opensAt ? `opens ${dateText(s.opensAt)}` : '',
    s?.closesAt ? `closes ${dateText(s.closesAt)}` : '',
  ].filter(Boolean);
  const parts = [
    s?.maxResponses !== undefined ? `max ${s.maxResponses}` : '',
    s?.uniqueBy ? `one per ${s.uniqueBy}` : '',
    dates.length ? `${dates.join(', ')} (${timeZone})` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

function languagesOf(definition: FormDefinition) {
  return {
    available: formLocales(definition.config),
    coverage: translationCoverage(definition.texts ?? [], definition.config.translations),
  };
}

const SHOW_MISSING = 8;

/** Missing translations are listed in full in --json; here, enough to act on. */
export function languageLines(definition: FormDefinition): string[] {
  const { available, coverage } = languagesOf(definition);
  if (available.length < 2) return [];
  const lines = [
    `    ${chalk.dim('languages')} ${available.join(', ')} ${chalk.dim(`(written in ${available[0]})`)}`,
  ];
  for (const c of coverage) {
    const done = c.total - c.missing.length;
    const status = c.missing.length
      ? chalk.yellow(`${done}/${c.total} translated`)
      : chalk.green(`${done}/${c.total} translated`);
    lines.push(
      `      ${c.locale.padEnd(6)} ${status}${c.unused.length ? chalk.dim(` · ${c.unused.length} not seen`) : ''}`,
    );
    for (const text of c.missing.slice(0, SHOW_MISSING)) {
      lines.push(`        ${chalk.yellow('missing')} ${JSON.stringify(text)}`);
    }
    if (c.missing.length > SHOW_MISSING) {
      lines.push(chalk.dim(`        … ${c.missing.length - SHOW_MISSING} more (see --json)`));
    }
    // Text shown only for some answers, or returned by `validate`, isn't rendered
    // while checking — so "not seen" is a hint to look, not an error.
    for (const text of c.unused.slice(0, SHOW_MISSING)) {
      lines.push(`        ${chalk.dim('not seen')} ${chalk.dim(JSON.stringify(text))}`);
    }
    if (c.unused.length > SHOW_MISSING) {
      lines.push(chalk.dim(`        … ${c.unused.length - SHOW_MISSING} more (see --json)`));
    }
  }
  return lines;
}

const CREDENTIALS_RE =
  /[a-z][a-z0-9+.-]*:\/\/(?:[^/\s:@]*:[^/\s@]+@|[^\s?#]*\?(?:[^\s#]*&)?(?:password|pass|passwd)=[^&\s#])/i;

/**
 * `open-form.config.ts` is committed, so a connection string with its password
 * written into it ends up in git. Values read from `process.env` are fine.
 */
export function configSecretProblems(source: string): string[] {
  const problems: string[] = [];
  walk(parseSource(source).program, (node) => {
    const text =
      node.type === 'StringLiteral'
        ? (node.value as string)
        : node.type === 'TemplateElement'
          ? (node.value as { cooked?: string }).cooked
          : undefined;
    if (!text || !CREDENTIALS_RE.test(text)) return;
    problems.push(
      `${CONFIG_FILE}:${node.loc.start.line} holds a URL with a password, and this file is committed. ` +
        'Put it in .env (OPEN_FORM_DATABASE_URL=…, already in .gitignore) and read it with process.env.',
    );
  });
  return problems;
}

export async function checkCommand(id: string | undefined, flags: { json?: boolean }) {
  const configFile = path.join(process.cwd(), CONFIG_FILE);
  const secretProblems = existsSync(configFile)
    ? configSecretProblems(readFileSync(configFile, 'utf8'))
    : [];
  if (secretProblems.length > 0) process.exitCode = 1;
  for (const problem of secretProblems) {
    process.stderr.write(`\n  ${chalk.red(`${glyph.cross} ${problem}`)}\n`);
  }
  const results = await checkForms(process.cwd(), id);

  if (flags.json) {
    const out = results.map((r) =>
      r.ok
        ? {
            id: r.id,
            ok: true,
            version: r.definition.version,
            theme: r.theme,
            schema: r.definition.schema,
            submissions: r.definition.config.submissions ?? null,
            timeZone: r.timeZone,
            warnings: r.warnings,
            languages: languagesOf(r.definition),
          }
        : r,
    );
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
  } else {
    process.stdout.write('\n');
    for (const r of results) {
      if (!r.ok) {
        process.stdout.write(`  ${chalk.red(glyph.cross)} ${chalk.bold(r.id)}\n`);
        for (const line of r.error.split('\n')) process.stdout.write(`    ${chalk.red(line)}\n`);
        process.stdout.write('\n');
        continue;
      }
      const { schema, config, version } = r.definition;
      const meta = [r.theme ? 'own theme' : 'default look', `v${version}`];
      process.stdout.write(
        `  ${chalk.green(glyph.check)} ${chalk.bold(r.id)}  ${schema.title ?? ''}  ${chalk.dim(meta.join(' · '))}\n`,
      );
      for (const page of schema.pages) {
        const pageCondition = page.when.length
          ? chalk.cyan(` if ${page.when.map((c) => describeCondition(c)).join(' and ')}`)
          : '';
        process.stdout.write(
          `    ${chalk.dim(`step ${page.index + 1}`)} ${page.title ?? ''}${pageCondition}\n`,
        );
        for (const field of schema.fields.filter((f) => f.page === page.index)) {
          process.stdout.write(`${fieldLine(field, page.when.length)}\n`);
        }
      }
      const policy = policyLine(config, r.timeZone);
      if (policy) process.stdout.write(`    ${chalk.dim('policy')} ${policy}\n`);
      for (const warning of r.warnings) {
        process.stdout.write(`    ${chalk.yellow(`${glyph.warn} ${warning}`)}\n`);
      }
      for (const line of languageLines(r.definition)) process.stdout.write(`${line}\n`);
      process.stdout.write('\n');
    }
  }

  if (results.some((r) => !r.ok)) process.exitCode = 1;
}
