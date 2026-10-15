import chalk from 'chalk';
import { startServer } from '../node/server.ts';
import { printHeader, printRows, startupDuration } from './ui.ts';

export type StartFlags = {
  port?: number;
  host?: string;
  outDir?: string;
};

export async function start(flags: StartFlags = {}): Promise<void> {
  const started = await startServer({
    root: process.cwd(),
    port: flags.port,
    host: flags.host,
    outDir: flags.outDir,
  });
  printHeader(`production · ${startupDuration()}`);
  printRows([
    ...started.forms.map((id): [string, string] => ['Form', chalk.cyan(`${started.url}/f/${id}`)]),
    [
      'Studio',
      started.publicStudio
        ? `${chalk.cyan(`${started.url}/studio`)} ${chalk.yellow('read-only for everyone')}${
            started.adminEnabled
              ? chalk.dim(' · sign in to make changes')
              : chalk.dim(' · set OPEN_FORM_ADMIN_PASSWORD to make changes')
          }`
        : started.adminEnabled
          ? chalk.cyan(`${started.url}/studio`)
          : chalk.dim('disabled — set OPEN_FORM_ADMIN_PASSWORD to enable'),
    ],
  ]);
  process.stdout.write('\n');

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void started.close().finally(() => process.exit(0));
    });
  }
}
