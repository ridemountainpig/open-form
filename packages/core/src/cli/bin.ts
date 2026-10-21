#!/usr/bin/env node
import { run } from './run.ts';
import { formatError } from './ui.ts';

// Piped into a reader that stops early (`| head`): stop quietly, like other CLIs.
process.stdout.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EPIPE') process.exit(0);
  throw err;
});

run(process.argv.slice(2)).catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(formatError(message));
  process.exit(1);
});
