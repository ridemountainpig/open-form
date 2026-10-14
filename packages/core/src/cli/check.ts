import { readFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { createServer, mergeConfig, type ViteDevServer } from 'vite';
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
  formThemeFile,
  loadUserConfig,
  PKG_ROOT,
  type ProjectPaths,
  projectPaths,
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
        results.push({
          id,
          ok: true,
          definition,
          timeZone: formTimeZone(definition.config, config.timeZone),
          theme: theme ? path.relative(userCwd, theme).split(path.sep).join('/') : null,
          warnings: [
            ...importWarnings(path.join(paths.formsRoot, id), paths),
            ...policyWarnings(definition.config, config),
            ...uniqueWarnings(definition),
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
          `${shown} imports themes/${id} — copy it into the form with \`open-form theme copy ${id} <form>\` so the form keeps its look when the theme changes.`,
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
function languageLines(definition: FormDefinition): string[] {
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
    for (const text of c.unused.slice(0, 3)) {
      lines.push(`        ${chalk.dim('not seen')} ${chalk.dim(JSON.stringify(text))}`);
    }
  }
  return lines;
}

export async function checkCommand(id: string | undefined, flags: { json?: boolean }) {
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
