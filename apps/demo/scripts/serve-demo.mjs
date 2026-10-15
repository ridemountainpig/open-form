// The public demo on Railway: `open-form start` on an empty database, wiped
// again every day at 04:00 Taipei time so strangers' answers never pile up.
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const bin = path.join(
  path.dirname(createRequire(import.meta.url).resolve('@open-form-build/core/package.json')),
  'bin.js',
);
const database = path.resolve(root, process.env.OPEN_FORM_DB ?? '.open-form/open-form.db');
// Taipei has no daylight saving: 04:00 there is always 20:00 UTC.
const RESET_UTC_HOUR = 20;

let server;
let resetting = false;

function wipe() {
  for (const suffix of ['', '-wal', '-shm', '-journal']) rmSync(database + suffix, { force: true });
}

function start() {
  wipe();
  server = spawn(process.execPath, [bin, 'start'], { cwd: root, stdio: 'inherit' });
  server.on('exit', (code) => {
    if (!resetting) process.exit(code ?? 1);
    resetting = false;
    console.log('[demo] Responses wiped for the day.');
    start();
  });
}

function scheduleReset() {
  const now = new Date();
  const next = new Date(now);
  next.setUTCHours(RESET_UTC_HOUR, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  setTimeout(() => {
    resetting = true;
    server.kill('SIGTERM');
    scheduleReset();
  }, next.getTime() - now.getTime());
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.kill(signal));

start();
scheduleReset();
