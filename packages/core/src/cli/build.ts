import { existsSync, readdirSync } from 'node:fs';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import chalk from 'chalk';
import { mergeConfig, type Plugin, build as viteBuild } from 'vite';
import { createViteConfig } from '../vite/config.ts';
import { SERVER_ENTRY_VMOD } from '../vite/forms-plugin.ts';
import { APP_ROOT, findForms, loadUserConfig, projectPaths } from '../vite/project.ts';
import { printHeader, printRows } from './ui.ts';

export type BuildFlags = {
  outDir?: string;
  /** Only dist/server/entry.js — what `@open-form-build/core/next` needs. */
  serverOnly?: boolean;
  /** Rebuild the server entry when forms change (with `serverOnly`). */
  watch?: boolean;
};

/** Left in the output folder, so a later build knows it may empty `client/` and `server/` there. */
export const BUILD_MARKER = '.open-form-build';

/**
 * The build empties `client/` and `server/` under the output folder. Besides the
 * default `dist`, only do that where an earlier build left its marker: `--out-dir src`
 * in a Next.js app must not wipe `src/server/`.
 */
export function assertReplaceable(userCwd: string, outDir: string): void {
  if (outDir === path.resolve(userCwd, 'dist') || existsSync(path.join(outDir, BUILD_MARKER))) {
    return;
  }
  for (const sub of ['client', 'server']) {
    const dir = path.join(outDir, sub);
    if (existsSync(dir) && readdirSync(dir).length > 0) {
      throw new Error(
        `${dir} isn't from an Open Form build, so the build won't empty it. Pick another --out-dir.`,
      );
    }
  }
}

/** Client bundle → dist/client, server entry (forms + collector) → dist/server/entry.js. */
export async function build(flags: BuildFlags = {}): Promise<void> {
  if (flags.watch && !flags.serverOnly) {
    throw new Error('`--watch` rebuilds the server entry only; use it with `--server-only`.');
  }
  printHeader(flags.serverOnly ? 'building the server entry' : 'building for production');
  const userCwd = process.cwd();
  const config = await loadUserConfig(userCwd);
  const outDir = path.resolve(userCwd, flags.outDir ?? 'dist');
  assertReplaceable(userCwd, outDir);
  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, BUILD_MARKER),
    'Written by `open-form build`, which replaces client/ and server/ in this folder.\n',
  );
  const base = await createViteConfig({ userCwd, config });

  if (!flags.serverOnly) {
    await viteBuild(
      mergeConfig(base, {
        logLevel: 'warn',
        build: { outDir: path.join(outDir, 'client'), emptyOutDir: true },
      }),
    );
    // Other sites load it by URL, so it keeps its name (no hash) and isn't bundled.
    await copyFile(path.join(APP_ROOT, 'embed.js'), path.join(outDir, 'client', 'embed.js'));
  }

  await viteBuild(
    mergeConfig(base, {
      logLevel: 'warn',
      publicDir: false,
      plugins: [
        {
          // entry.js is ESM even when the workspace's package.json isn't "type": "module".
          name: 'open-form:server-module-type',
          generateBundle() {
            this.emitFile({
              type: 'asset',
              fileName: 'package.json',
              source: '{ "type": "module" }\n',
            });
          },
        } satisfies Plugin,
      ],
      // Bundle React and the runtime into the server entry so `open-form start`
      // never depends on how the workspace's node_modules are laid out.
      ssr: { noExternal: true },
      // Decided at build time: nothing sets NODE_ENV for `open-form start`, and
      // React would otherwise pick its development build at runtime.
      define: {
        'process.env.NODE_ENV': JSON.stringify(flags.watch ? 'development' : 'production'),
      },
      build: {
        ssr: true,
        outDir: path.join(outDir, 'server'),
        emptyOutDir: true,
        copyPublicDir: false,
        watch: flags.watch ? {} : null,
        rolldownOptions: {
          input: SERVER_ENTRY_VMOD,
          // One file: `@open-form-build/core/next` re-imports it with a cache-busting query
          // after a rebuild, and a split chunk would import the old copy (and its React).
          output: { entryFileNames: 'entry.js', format: 'esm', codeSplitting: false },
        },
      },
    }),
  );

  const forms = findForms(projectPaths(userCwd, config).formsRoot);
  printRows([
    ['Forms', String(forms.length)],
    ['Output', chalk.cyan(path.relative(userCwd, outDir) || '.')],
  ]);
  if (flags.watch) {
    process.stdout.write(
      `\n  ${chalk.dim('Watching forms and open-form.config.ts; restart to pick up new form folders.')}\n\n`,
    );
  } else if (flags.serverOnly) {
    process.stdout.write(
      `\n  ${chalk.dim('Ready for')} ${chalk.bold('@open-form-build/core/next')}${chalk.dim('.')}\n\n`,
    );
  } else {
    process.stdout.write(
      `\n  ${chalk.dim('Run')} ${chalk.bold('open-form start')} ${chalk.dim('to serve it.')}\n\n`,
    );
  }
}
