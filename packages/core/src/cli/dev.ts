import path from 'node:path';
import chalk from 'chalk';
import { createServer, mergeConfig, type Plugin, type ViteDevServer } from 'vite';
import type { OpenFormConfig } from '../schema/index.ts';
import { createViteConfig } from '../vite/config.ts';
import {
  assertWorkspace,
  CONFIG_FILE,
  findForms,
  loadUserConfig,
  projectPaths,
} from '../vite/project.ts';
import { updateSkills, watchSkills } from './skills.ts';
import { glyph, printHeader, printRows, startupDuration } from './ui.ts';

export type ServerFlags = {
  port?: number;
  host?: string | boolean;
  open?: boolean;
};

const SKIP_SKILLS = process.env.OPEN_FORM_SKIP_SKILLS_SYNC === '1';

async function startupSkills(userCwd: string): Promise<[string, string] | undefined> {
  if (SKIP_SKILLS) return;
  try {
    const names = await updateSkills(userCwd);
    if (names.length > 0) return ['Skills', `updated ${chalk.bold(names.join(', '))}`];
  } catch {
    return ['Skills', chalk.yellow('out of date — run `open-form sync:skills`')];
  }
}

/** Calls `onChange` when the config file is saved, created or removed. */
function watchConfigFile(file: string, onChange: () => void): Plugin {
  return {
    name: 'open-form:config-file',
    apply: 'serve',
    configureServer(server) {
      server.watcher.add(file);
      const changed = (changedFile: string) => {
        if (path.resolve(changedFile) === file) onChange();
      };
      server.watcher.on('change', changed);
      server.watcher.on('add', changed);
      server.watcher.on('unlink', changed);
    },
  };
}

function printError(err: unknown, note: string): void {
  const message = err instanceof Error ? err.message : String(err);
  process.stdout.write(
    `  ${chalk.red(glyph.cross)} ${message.split('\n').join('\n    ')}\n    ${chalk.dim(note)}\n`,
  );
}

function listeningPort(server: ViteDevServer): number | undefined {
  const address = server.httpServer?.address();
  return address && typeof address === 'object' ? address.port : undefined;
}

export async function dev(flags: ServerFlags = {}): Promise<void> {
  const userCwd = process.cwd();
  assertWorkspace(userCwd, 'dev');
  const skillsRow = await startupSkills(userCwd);
  const configFile = path.join(userCwd, CONFIG_FILE);
  const shortcuts = Boolean(process.stdin.isTTY && !process.env.CI);

  const createDevServer = async (config: OpenFormConfig, port?: number, open?: boolean) =>
    createServer(
      mergeConfig(await createViteConfig({ userCwd, config }), {
        logLevel: 'warn',
        plugins: [watchConfigFile(configFile, () => scheduleRestart())],
        server: {
          ...(port !== undefined ? { port } : {}),
          ...(flags.host !== undefined ? { host: flags.host } : {}),
          ...(open ? { open: '/studio' } : {}),
        },
      }),
    );
  const bindShortcuts = (target: ViteDevServer) => {
    if (!shortcuts) return;
    target.bindCLIShortcuts({
      print: false,
      // Vite's own restart would keep the config the server started with.
      customShortcuts: [
        { key: 'r', description: 'restart the server', action: () => scheduleRestart(0) },
      ],
    });
  };

  let config = await loadUserConfig(userCwd);
  let server = await createDevServer(config, flags.port, flags.open);

  // The config shapes the plugins, the API handler and the server options, so
  // a changed file gets a whole new server (the browser reloads when it's back).
  let queue = Promise.resolve();
  let timer: NodeJS.Timeout | undefined;
  const restart = async () => {
    let next: { config: OpenFormConfig; server: ViteDevServer };
    try {
      const nextConfig = await loadUserConfig(userCwd);
      const port =
        flags.port ?? (nextConfig.port !== config.port ? nextConfig.port : listeningPort(server));
      next = { config: nextConfig, server: await createDevServer(nextConfig, port) };
    } catch (err) {
      printError(err, 'Still running with the previous config.');
      return;
    }
    const previousUrl = server.resolvedUrls?.local[0];
    await server.close();
    ({ config, server } = next);
    await server.listen();
    bindShortcuts(server);
    const url = server.resolvedUrls?.local[0];
    process.stdout.write(
      `  ${chalk.green(glyph.check)} ${chalk.dim('Restarted with the new')} ${CONFIG_FILE}${
        url && url !== previousUrl ? ` ${chalk.cyan(`${url.replace(/\/$/, '')}/studio`)}` : ''
      }\n`,
    );
  };
  const scheduleRestart = (delay = 100) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      queue = queue.then(restart).catch((err) => printError(err, 'Restart failed.'));
    }, delay);
  };

  await server.listen();

  const local = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? 'http://localhost:3000';
  const forms = findForms(projectPaths(userCwd, config).formsRoot);
  printHeader(startupDuration());
  printRows([
    ['Studio', chalk.cyan(`${local}/studio`)],
    ...forms
      .slice(0, 6)
      .map((f): [string, string] => ['Form', `${chalk.cyan(`${local}/f/${f.id}`)}`]),
    ...(forms.length > 6
      ? [['', chalk.dim(`… ${forms.length - 6} more`)] as [string, string]]
      : []),
    ...(server.resolvedUrls?.network.length
      ? [['Network', chalk.cyan(server.resolvedUrls.network[0] as string)] as [string, string]]
      : []),
    ...(skillsRow ? [skillsRow] : []),
  ]);
  if (forms.length === 0) {
    process.stdout.write(
      `\n  ${chalk.dim('No forms yet. Ask your agent, or run')} ${chalk.bold('open-form create <id>')}\n`,
    );
  }
  process.stdout.write('\n');
  if (!SKIP_SKILLS) {
    watchSkills(userCwd, (names) => {
      process.stdout.write(
        `  ${chalk.green(glyph.check)} ${chalk.dim('Updated agent skills:')} ${names.join(', ')}\n`,
      );
    });
  }
  bindShortcuts(server);
}
