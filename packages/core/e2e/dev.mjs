// End-to-end test of `open-form dev` as users run it: the package packed and
// installed into node_modules, where Vite treats it as a dependency (a `link:`
// install like smoke.mjs uses resolves to this repo's source and hides that).
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCRATCH = mkdtempSync(path.join(os.tmpdir(), 'open-form-e2e-dev-'));
const WS = path.join(SCRATCH, 'workspace');
const PORT = 3900 + Math.floor(Math.random() * 90);

function step(name) {
  process.stdout.write(`\n▸ ${name}\n`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(what, fn, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${what}`);
}

let server;
let logs = '';

try {
  step('pack');
  // `test:e2e` builds first, so skip the prepack rebuild.
  const packed = JSON.parse(
    execFileSync(
      'pnpm',
      ['pack', '--json', '--pack-destination', SCRATCH, '--config.ignore-scripts=true'],
      { cwd: PKG, encoding: 'utf8' },
    ),
  );
  const tarball = path.resolve(SCRATCH, packed.filename);
  assert.ok(existsSync(tarball), `missing ${tarball}`);

  step('init from the tarball');
  execFileSync(
    process.execPath,
    [
      path.join(PKG, 'bin.js'),
      'init',
      WS,
      '--no-git',
      '--pm',
      'pnpm',
      '--open-form-version',
      `file:${tarball}`,
    ],
    { stdio: 'inherit', env: { ...process.env, CI: '1' } },
  );
  const core = realpathSync(path.join(WS, 'node_modules/@open-form-build/core'));
  assert.ok(core.includes(`${path.sep}node_modules${path.sep}`), `not installed: ${core}`);
  const bin = path.join(core, 'bin.js');
  const cli = (args) =>
    execFileSync(process.execPath, [bin, ...args], {
      cwd: WS,
      encoding: 'utf8',
      env: { ...process.env, CI: '1' },
    });

  step('dev');
  server = spawn(process.execPath, [bin, 'dev', '--port', String(PORT)], {
    cwd: WS,
    env: { ...process.env, CI: '1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (d) => {
    logs += d;
  });
  server.stderr.on('data', (d) => {
    logs += d;
  });
  // `dev` moves to the next free port when the asked one is taken.
  const base = await until(
    'the dev server',
    () => logs.match(/(http:\/\/localhost:\d+)\/studio/)?.[1],
  );
  await until('/f/contact', async () => (await fetch(`${base}/f/contact`)).ok);
  // Requesting the entry waits for the dependency optimizer's first run, and its
  // imports carry the version the browser asks every pre-bundled dep for.
  const entry = await (await fetch(`${base}/main.tsx`)).text();
  const version = entry.match(/\.vite\/deps\/[^"?]+\?v=(\w+)/)?.[1];
  assert.ok(version, 'main.tsx imports pre-bundled deps');
  const optimized = await until('pre-bundled deps', () => {
    const metadata = path.join(core, 'node_modules/.vite/deps/_metadata.json');
    const deps = Object.values(JSON.parse(readFileSync(metadata, 'utf8')).optimized);
    return deps.length > 1 ? deps.map((dep) => dep.file) : null;
  });

  step('forms share the runtime with the app');
  const formModule = await (
    await fetch(`${base}/@fs${realpathSync(WS)}/forms/contact/index.tsx`)
  ).text();
  const coreImport = formModule.match(/from "([^"]+)"/g)?.find((s) => s.includes('open-form'));
  assert.ok(coreImport, 'the form imports @open-form-build/core');
  assert.doesNotMatch(coreImport, /\.vite\/deps\//, 'a second, pre-bundled copy of the runtime');
  assert.match(coreImport, /\/src\/index\.ts/);

  step('check leaves the dev server running');
  // `theme check` and `responses export` load forms the same way.
  cli(['check', 'contact']);
  // Files the page hasn't loaded yet are read from disk, so a rewritten cache shows here.
  for (const file of optimized) {
    const url = `${base}/@fs${core}/node_modules/.vite/deps/${file}?v=${version}`;
    assert.equal((await fetch(url)).status, 200, file);
  }

  process.stdout.write('\n✔ e2e dev passed\n');
  if (process.env.E2E_VERBOSE) process.stdout.write(logs);
} catch (err) {
  process.stderr.write(`\n✖ e2e dev failed\n${err?.stack ?? err}\n${logs}`);
  process.exitCode = 1;
} finally {
  server?.kill();
  if (process.env.E2E_KEEP) process.stdout.write(`kept ${WS}\n`);
  else rmSync(SCRATCH, { recursive: true, force: true });
}
