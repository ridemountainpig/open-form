import { existsSync } from 'node:fs';
import path from 'node:path';
import chalk from 'chalk';
import { Command, Option } from 'commander';
import { assertWorkspace, readPackageVersion } from '../vite/project.ts';

export function parsePort(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 65535) throw new Error(`Invalid port: ${value}`);
  return n;
}

/** Variables already in the environment win over the file. */
export function loadDotEnv(dir: string): void {
  const file = path.join(dir, '.env');
  if (existsSync(file)) process.loadEnvFile(file);
}

export async function run(argv: string[]): Promise<void> {
  const program = new Command();
  program
    .name('open-form')
    .description('The form framework built for agents.')
    .version(readPackageVersion(), '-v, --version', 'print version')
    .helpOption('-h, --help', 'show help')
    .showHelpAfterError(chalk.dim('(run `open-form --help` for usage)'))
    .hook('preAction', (_program, command) => {
      if (command.name() !== 'init') loadDotEnv(process.cwd());
    });

  program
    .command('init')
    .description('Create a new Open Form workspace')
    .argument('[dir]', 'target directory')
    .option('-f, --force', 'scaffold into a non-empty directory')
    .option('-n, --name <name>', 'package name (defaults to the folder name)')
    .addOption(new Option('--pm <pm>', 'package manager').choices(['pnpm', 'npm', 'yarn', 'bun']))
    .option('--no-install', 'skip installing dependencies')
    .option('--no-git', 'skip git init')
    .addOption(new Option('--open-form-version <spec>', 'dependency spec for open-form').hideHelp())
    .action(async (dir: string | undefined, flags) => {
      const { init } = await import('./init.ts');
      await init(dir, flags);
    });

  program
    .command('dev')
    .description('Start the dev server with Studio')
    .addOption(new Option('-p, --port <port>', 'port').argParser(parsePort))
    .option('--host [host]', 'expose on the network')
    .option('--open', 'open Studio in the browser')
    .action(async (flags) => {
      const { dev } = await import('./dev.ts');
      await dev(flags);
    });

  program
    .command('build')
    .description('Build for production')
    .option('--out-dir <dir>', 'output directory (default: dist)')
    .option('--server-only', 'only the server entry (for @open-form-build/core/next)')
    .option('--watch', 'rebuild the server entry on change (with --server-only)')
    .action(async (flags) => {
      const { build } = await import('./build.ts');
      await build(flags);
    });

  program
    .command('start')
    .description('Serve the production build (forms, API, SQLite)')
    .addOption(
      new Option('-p, --port <port>', 'port (default: $PORT, config port, or 3000)').argParser(
        parsePort,
      ),
    )
    .option('--host <host>', 'host to bind (default: $HOST or 0.0.0.0)')
    .option('--out-dir <dir>', 'build directory (default: dist)')
    .action(async (flags) => {
      const { start } = await import('./start.ts');
      await start(flags);
    });

  program
    .command('create')
    .description('Create a new form from the starter')
    .argument('<id>', 'kebab-case form id, e.g. event-registration')
    .option('-t, --title <title>', 'form title')
    .option('--theme <theme>', "start the form's look from a theme's tokens (themes/ or a starter)")
    .option('--locale <locale>', 'the language the form is written in, e.g. zh-TW')
    .action(async (id: string, flags) => {
      const { createForm } = await import('./commands.ts');
      await createForm(id, flags);
    });

  program
    .command('delete')
    .description('Delete a form: its folder in forms/ and every response it has')
    .argument('<id>', 'form id')
    .option('-y, --yes', 'skip the confirmation')
    .action(async (id: string, flags: { yes?: boolean }) => {
      const { deleteFormCommand } = await import('./commands.ts');
      await deleteFormCommand(id, flags);
    });

  program
    .command('check')
    .description('Load forms like the server does and print their schema, or the error')
    .argument('[id]', 'only this form')
    .option('--json', 'machine-readable output')
    .action(async (id: string | undefined, flags: { json?: boolean }) => {
      const { checkCommand } = await import('./check.ts');
      await checkCommand(id, flags);
    });

  program
    .command('comments')
    .description('List review comments left in Studio (@form-comment markers)')
    .argument('[id]', 'only this form')
    .option('--json', 'machine-readable output')
    .action(async (id: string | undefined, flags: { json?: boolean }) => {
      const { commentsCommand } = await import('./comments.ts');
      await commentsCommand(id, flags);
    });

  program
    .command('list')
    .description('List forms and their response counts')
    .action(async () => {
      const { listForms } = await import('./commands.ts');
      await listForms();
    });

  const responses = program.command('responses').description('Work with stored responses');
  responses
    .command('export')
    .description('Export responses as CSV, Excel (xlsx) or JSON')
    .argument('<formId>', 'form id')
    .addOption(new Option('--format <format>', 'output format').choices(['csv', 'xlsx', 'json']))
    .option('-o, --out <file>', 'write to a file instead of stdout')
    .action(async (formId: string, flags) => {
      const { exportResponses } = await import('./commands.ts');
      await exportResponses(formId, flags);
    });

  const theme = program
    .command('theme')
    .description('Browse the reference themes forms take their looks from');
  theme
    .command('list')
    .description("List the project's themes and the starters")
    .action(async () => {
      const { listThemes } = await import('./theme.ts');
      await listThemes();
    });
  theme
    .command('check')
    .description("Check a theme's color contrast (light and dark)")
    .argument('<id>', 'theme id (a form id with --form)')
    .option('--form', "check that form's own theme, in forms/<id>/theme/")
    .option('--json', 'machine-readable output')
    .action(async (id: string, flags: { json?: boolean; form?: boolean }) => {
      const { themeCheckCommand } = await import('./theme.ts');
      await themeCheckCommand(id, flags);
    });
  theme
    .command('add')
    .description('Copy a starter theme into themes/, to adapt as a reference for new forms')
    .argument('<starter>', 'starter theme, e.g. editorial (see `theme list`)')
    .option('--as <name>', 'save it under a new id, e.g. brand')
    .option('-f, --force', 'replace a theme with that id')
    .action(async (starter: string, flags: { as?: string; force?: boolean }) => {
      const { addCommand } = await import('./theme.ts');
      await addCommand(starter, flags);
    });
  theme
    .command('font')
    .description("Download a Google Fonts family into a theme's fonts/ folder")
    .argument('<id>', 'theme id (a form id with --form)')
    .argument('<family...>', 'family name, e.g. Inter or Noto Sans TC')
    .option('--form', "add it to that form's own theme, in forms/<id>/theme/")
    .action(async (id: string, family: string[], flags: { form?: boolean }) => {
      const { fontCommand } = await import('./theme.ts');
      await fontCommand(id, family.join(' '), flags);
    });

  program
    .command('sync:skills')
    .description('Update the agent skills in .agents/skills from this version of open-form')
    .option('--dry-run', 'show what would change')
    .action(async (flags: { dryRun?: boolean }) => {
      const { syncSkills } = await import('./skills.ts');
      assertWorkspace(process.cwd(), 'sync:skills');
      process.stdout.write('\n');
      await syncSkills(process.cwd(), flags);
      process.stdout.write('\n');
    });

  await program.parseAsync(argv, { from: 'user' });
}
