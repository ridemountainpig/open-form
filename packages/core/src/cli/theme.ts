export { type AddThemeOptions, addStarterTheme } from '../editing/theme-files.ts';

import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { addGoogleFont } from '../editing/google-fonts.ts';
import {
  type AddThemeOptions,
  addStarterTheme,
  copyThemeToForm,
  readThemeDoc,
} from '../editing/theme-files.ts';
import { contrastReport, type OpenFormConfig, type Theme } from '../schema/index.ts';
import {
  findForms,
  findStarterThemes,
  formThemeFile,
  loadUserConfig,
  projectPaths,
  resolveThemes,
} from '../vite/project.ts';
import { withSsrServer } from './check.ts';
import { glyph, table } from './ui.ts';

export type ThemeRow = { id: string; description: string };

/** The project's themes: references under themes/ for new forms. */
export async function themeCatalog(projectRoot: string): Promise<ThemeRow[]> {
  const { themesRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  return Promise.all(
    resolveThemes(themesRoot).map(async (t) => ({
      id: t.id,
      description: (await readThemeDoc(t.file)).description,
    })),
  );
}

/**
 * The theme file a command works on: `themes/<id>`, or with `--form` the form's
 * own copy in `forms/<id>/theme/`.
 */
function themeFileFor(projectRoot: string, config: OpenFormConfig, id: string, form?: boolean) {
  const { themesRoot, formsRoot } = projectPaths(projectRoot, config);
  if (form) {
    if (!findForms(formsRoot).some((f) => f.id === id)) throw new Error(`No form "${id}".`);
    const file = formThemeFile(formsRoot, id);
    if (!file) {
      throw new Error(
        `forms/${id} has no theme of its own. Copy one in with \`open-form theme copy <theme> ${id}\`.`,
      );
    }
    return file;
  }
  const entry = resolveThemes(themesRoot).find((t) => t.id === id);
  if (!entry) throw new Error(`No theme "${id}". Run \`open-form theme list\`.`);
  return entry.file;
}

export async function starterCatalog(): Promise<Array<{ id: string; description: string }>> {
  return Promise.all(
    findStarterThemes().map(async (t) => ({
      id: t.id,
      description: (await readThemeDoc(t.file)).description,
    })),
  );
}

export async function listThemes(): Promise<void> {
  const [rows, starters] = await Promise.all([themeCatalog(process.cwd()), starterCatalog()]);
  const out: string[] = [''];
  if (rows.length === 0) {
    out.push(`  ${chalk.dim('No themes in themes/ yet.')}`);
  } else {
    out.push(
      table(
        ['THEME', 'DESCRIPTION'],
        rows.map((r) => [chalk.bold(r.id), r.description || chalk.dim('no THEME.md')]),
      ),
    );
  }
  out.push(
    `  ${chalk.dim('Themes are references: copy one into a form and the form keeps its own look.')}`,
    `  open-form theme copy <theme> <form>`,
  );
  out.push(
    '',
    `  ${chalk.bold('Starters')} ${chalk.dim('— copy into a form, or into themes/ to adapt:')}`,
  );
  out.push(
    table(
      ['STARTER', 'DESCRIPTION'],
      starters.map((s) => [s.id, chalk.dim(s.description)]),
    ),
  );
  out.push(`  open-form theme add <starter> ${chalk.dim('[--as <name>]')}`, '');
  process.stdout.write(`${out.join('\n')}\n`);
}

export async function addCommand(starter: string, opts: AddThemeOptions): Promise<void> {
  const { name, files } = await addStarterTheme(process.cwd(), starter, opts);
  process.stdout.write(
    `\n  ${chalk.green(glyph.check)} Added ${chalk.bold(`themes/${name}/`)} ${chalk.dim(`from the ${starter} starter`)}\n`,
  );
  for (const file of files) process.stdout.write(`    ${chalk.dim(file)}\n`);
  process.stdout.write(
    `\n  ${chalk.dim('It is yours — edit its tokens, components, CSS and THEME.md freely.')}\n` +
      `  ${chalk.dim('Use it for a form with')} open-form theme copy ${name} <form>\n\n`,
  );
}

/** The form's import of its own theme copy, if it has one. */
export function themeImport(source: string): string | undefined {
  return /from\s+['"](\.\/theme(?:\/index(?:\.tsx?)?)?)['"]/.exec(source)?.[1];
}

/** An import without an extension resolves to either file. */
export function importsCopy(spec: string, importPath: string): boolean {
  return !/\.tsx?$/.test(spec) || spec === importPath;
}

export async function copyCommand(
  themeId: string,
  formId: string,
  opts: { force?: boolean },
): Promise<void> {
  const projectRoot = process.cwd();
  const result = await copyThemeToForm(projectRoot, themeId, formId, opts);
  const from = result.source === 'project' ? `themes/${themeId}/` : `the ${themeId} starter`;
  const out = [
    '',
    `  ${chalk.green(glyph.check)} Copied ${chalk.bold(from)} into ${chalk.bold(`${path.relative(projectRoot, result.dir)}/`)}`,
    ...result.files.map((file) => `    ${chalk.dim(file)}`),
  ];
  for (const warning of result.warnings) out.push(`  ${chalk.yellow(glyph.warn)} ${warning}`);

  const { formsRoot } = projectPaths(projectRoot, await loadUserConfig(projectRoot));
  const entry = findForms(formsRoot).find((f) => f.id === formId);
  const source = entry && existsSync(entry.file) ? readFileSync(entry.file, 'utf8') : '';
  const current = themeImport(source);
  if (current && !importsCopy(current, result.importPath)) {
    out.push(
      `  ${chalk.yellow(glyph.warn)} ${entry ? path.relative(projectRoot, entry.file) : 'The form'} imports ${current}, but the copy is ${result.importPath}: update the import.`,
    );
  } else if (!current) {
    out.push(
      '',
      `  ${chalk.dim('Apply it in the form, importing it above the form’s own CSS:')}`,
      `    import theme from '${result.importPath}';`,
      `    <Form theme={theme}>`,
    );
  }
  out.push(
    '',
    `  ${chalk.dim('The form owns this copy: edit it freely. Changing themes/ won’t affect it.')}`,
    '',
  );
  process.stdout.write(`${out.join('\n')}\n`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export async function fontCommand(
  id: string,
  family: string,
  flags: { form?: boolean } = {},
): Promise<void> {
  const projectRoot = process.cwd();
  const themeFile = themeFileFor(projectRoot, await loadUserConfig(projectRoot), id, flags.form);
  const font = await addGoogleFont({ themeFile, projectRoot, family });
  process.stdout.write(
    `\n  ${chalk.green(glyph.check)} Added ${chalk.bold(font.family)} to ${chalk.bold(id)} ${chalk.dim(`— ${font.files} files, ${formatBytes(font.bytes)}, served by the form itself`)}\n` +
      `    ${chalk.dim(font.css)}\n\n` +
      `  ${chalk.dim('Use it in defineTheme({ … }) as')} font ${chalk.dim('or')} headingFont${chalk.dim(':')}\n` +
      `    font: '${font.stack}',\n\n`,
  );
}

export async function themeCheckCommand(
  id: string,
  flags: { json?: boolean; form?: boolean },
): Promise<void> {
  const projectRoot = process.cwd();
  const report = await withSsrServer(projectRoot, async (server, config) => {
    const file = themeFileFor(projectRoot, config, id, flags.form);
    const mod = (await server.ssrLoadModule(file)) as { default?: Theme };
    if (!mod.default) throw new Error(`${file} has no default export (defineTheme(...)).`);
    return contrastReport(mod.default);
  });

  if (flags.json) {
    process.stdout.write(`${JSON.stringify({ id, ...report }, null, 2)}\n`);
  } else {
    process.stdout.write(
      `\n  ${chalk.bold(id)} ${chalk.dim('— WCAG contrast of the colors forms actually use')}\n`,
    );
    for (const warning of report.warnings)
      process.stdout.write(`  ${chalk.yellow(glyph.warn)} ${warning}\n`);
    for (const palette of report.palettes) {
      process.stdout.write(`\n  ${chalk.dim(palette.scheme)}\n`);
      process.stdout.write(
        table(
          ['', 'PAIR', 'COLORS', 'RATIO', 'NEEDS'],
          palette.rows.map((r) => [
            r.ok ? chalk.green(glyph.check) : chalk.red(glyph.cross),
            r.label,
            chalk.dim(`${r.fg} on ${r.bg}`),
            r.ratio === null ? chalk.yellow('?') : r.ratio.toFixed(2),
            `${r.min}:1`,
          ]),
        ),
      );
    }
    process.stdout.write(
      `\n  ${chalk.dim('Fix a failure by adjusting that token (keep the hue, change the lightness). "?" = a value this check cannot resolve, e.g. var() or color-mix().')}\n\n`,
    );
  }
  if (report.palettes.some((p) => p.rows.some((r) => !r.ok))) process.exitCode = 1;
}
