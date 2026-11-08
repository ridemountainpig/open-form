import chalk from 'chalk';
import { addGoogleFont } from '../editing/google-fonts.ts';
import { contrastReport, type OpenFormConfig, type Theme } from '../schema/index.ts';
import {
  findForms,
  formThemeFile,
  loadUserConfig,
  projectPaths,
  resolveThemes,
} from '../vite/project.ts';
import { withSsrServer } from './check.ts';
import { glyph, table } from './ui.ts';

/**
 * The theme file a command works on: `themes/<id>`, or with `--form` the form's
 * own look in `forms/<id>/theme/`.
 */
function themeFileFor(projectRoot: string, config: OpenFormConfig, id: string, form?: boolean) {
  const { themesRoot, formsRoot } = projectPaths(projectRoot, config);
  if (form) {
    if (!findForms(formsRoot).some((f) => f.id === id)) throw new Error(`No form "${id}".`);
    const file = formThemeFile(formsRoot, id);
    if (!file) {
      throw new Error(
        `forms/${id} has no theme/index.ts yet. Create it with \`export default defineTheme({})\` and pass it to <Form theme={theme}>, or use Adjust in Studio's preview.`,
      );
    }
    return file;
  }
  const entry = resolveThemes(themesRoot).find((t) => t.id === id);
  if (!entry) throw new Error(`No theme "${id}". It isn't in themes/.`);
  return entry.file;
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
    const mod = (await server.ssrLoadModule(file)) as {
      default?: Theme & { components?: { Layout?: unknown } };
    };
    if (!mod.default) throw new Error(`${file} has no default export (defineTheme(...)).`);
    const report = contrastReport(mod.default);
    // A custom Layout decides what sits on the page background; often no text does.
    const hint = (r: { pair: string; ok: boolean; ratio: number | null }) =>
      r.ratio !== null && !r.ok && r.pair === 'foreground/background';
    if (!mod.default.components?.Layout || !report.palettes.some((p) => p.rows.some(hint))) {
      return report;
    }
    const palettes = report.palettes.map((p) => ({
      ...p,
      rows: p.rows.map((r) => (hint(r) ? { ...r, advisory: true } : r)),
    }));
    const warnings = report.warnings.concat(
      'The theme has its own Layout, so "text on background" is only a hint: it matters if your Layout puts text straight on `background`.',
    );
    return { palettes, warnings };
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
            r.ok
              ? chalk.green(glyph.check)
              : 'advisory' in r
                ? chalk.yellow(glyph.warn)
                : chalk.red(glyph.cross),
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
  if (report.palettes.some((p) => p.rows.some((r) => !r.ok && !('advisory' in r)))) {
    process.exitCode = 1;
  }
}
