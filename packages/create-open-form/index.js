#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const root = path.dirname(require.resolve('@open-form-build/core/package.json'));

// `init` reads which package manager ran `npm create`/`pnpm create`/`bunx` from
// the environment this process passes on.
const { status, signal } = spawnSync(
  process.execPath,
  [path.join(root, 'bin.js'), 'init', ...process.argv.slice(2)],
  { stdio: 'inherit' },
);
if (signal) process.kill(process.pid, signal);
process.exit(status ?? 1);
