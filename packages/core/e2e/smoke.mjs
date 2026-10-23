// End-to-end smoke test of the user journey, against the local build:
// create-open-form → install → create/list → build → start → submit → Studio API → CLI export.
// With E2E_POSTGRES_URL, the workspace stores its responses in that Postgres database instead.
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BIN = path.join(PKG, 'bin.js');
const CREATE = path.resolve(PKG, '../create-open-form/index.js');
// Outside the monorepo, or pnpm would install into this repo's workspace instead.
const SCRATCH = mkdtempSync(path.join(os.tmpdir(), 'open-form-e2e-'));
const WS = path.join(SCRATCH, 'workspace');
const PORT = 3900 + Math.floor(Math.random() * 90);
const BASE = `http://localhost:${PORT}`;
const ADMIN = 'e2e admin password 0123456789';
const POSTGRES = process.env.E2E_POSTGRES_URL;

function step(name) {
  process.stdout.write(`\n▸ ${name}\n`);
}

function cli(args, opts = {}) {
  return execFileSync(process.execPath, [BIN, ...args], {
    cwd: WS,
    encoding: 'utf8',
    env: { ...process.env, OPEN_FORM_SKIP_SKILLS_SYNC: '1', CI: '1' },
    ...opts,
  });
}

async function waitFor(url, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let server;

try {
  if (POSTGRES) {
    const { default: pg } = await import('pg');
    const admin = new pg.Client({ connectionString: POSTGRES });
    await admin.connect();
    await admin.query('DROP SCHEMA IF EXISTS open_form CASCADE');
    await admin.end();
  }

  step(`init (create-open-form${POSTGRES ? ', Postgres' : ''})`);
  execFileSync(
    process.execPath,
    [
      CREATE,
      WS,
      '--no-git',
      '--pm',
      'pnpm',
      '--open-form-version',
      `link:${PKG}`,
      ...(POSTGRES ? ['--database', 'postgres'] : []),
    ],
    {
      stdio: 'inherit',
      env: { ...process.env, CI: '1', OPEN_FORM_DATABASE_URL: POSTGRES ?? '' },
    },
  );
  for (const file of [
    'package.json',
    'AGENTS.md',
    'CLAUDE.md',
    'forms/contact/index.tsx',
    '.agents/skills/form-authoring/SKILL.md',
    '.agents/skills/create-theme/SKILL.md',
    '.agents/skills/apply-comments/SKILL.md',
    '.claude/skills/create-form/SKILL.md',
    'node_modules/@open-form-build/core/package.json',
  ]) {
    assert.ok(existsSync(path.join(WS, file)), `missing ${file}`);
  }
  assert.match(readFileSync(path.join(WS, '.gitignore'), 'utf8'), /\.open-form\//);
  if (POSTGRES) {
    assert.match(readFileSync(path.join(WS, '.env'), 'utf8'), /^OPEN_FORM_DATABASE_URL=/);
    assert.ok(existsSync(path.join(WS, 'node_modules/pg/package.json')), 'pg installed');
  }

  step('create + list');
  cli(['create', 'waitlist', '--title', 'Beta waitlist', '--theme', 'editorial']);
  assert.ok(existsSync(path.join(WS, 'forms/waitlist/index.tsx')));
  // A reference lends its tokens, never its CSS or components.
  const look = readFileSync(path.join(WS, 'forms/waitlist/theme/index.ts'), 'utf8');
  assert.match(look, /primary: '#/);
  assert.doesNotMatch(look, /\.css|components/);
  assert.deepEqual(readdirSync(path.join(WS, 'forms/waitlist/theme')), ['index.ts']);
  const list = cli(['list']);
  assert.match(list, /waitlist/);
  assert.match(list, /Beta waitlist/);

  step('theme add');
  // With a reference in themes/, `build` loads it in Vite SSR first; the production
  // build after that must still compile for production.
  cli(['theme', 'add', 'editorial']);
  assert.ok(existsSync(path.join(WS, 'themes/editorial/THEME.md')));

  step('build');
  cli(['build'], { stdio: 'inherit' });
  assert.ok(existsSync(path.join(WS, 'dist/client/index.html')));
  assert.ok(existsSync(path.join(WS, 'dist/server/entry.js')));

  step('start');
  server = spawn(process.execPath, [BIN, 'start', '--port', String(PORT), '--host', '127.0.0.1'], {
    cwd: WS,
    // As deployed: production React must still render a production build's forms.
    env: { ...process.env, NODE_ENV: 'production', OPEN_FORM_ADMIN_PASSWORD: ADMIN },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  server.stdout.on('data', (d) => {
    logs += d;
  });
  server.stderr.on('data', (d) => {
    logs += d;
  });
  await waitFor(`${BASE}/f/contact`);

  step('public pages');
  assert.equal((await fetch(`${BASE}/f/contact`)).status, 200);
  assert.equal((await fetch(`${BASE}/f/nope`)).status, 200, 'SPA shell renders its own 404');
  const studio = await fetch(`${BASE}/studio`);
  assert.equal(studio.status, 200, 'Studio shell; it signs in inside the page');
  assert.match(studio.headers.get('content-security-policy') ?? '', /frame-ancestors 'self'/);
  const themePreview = await fetch(`${BASE}/theme-preview/editorial`);
  assert.equal(themePreview.status, 200, "Studio's Themes pages frame it in production too");
  assert.match(themePreview.headers.get('content-security-policy') ?? '', /frame-ancestors 'self'/);
  assert.equal((await fetch(`${BASE}/api/forms`)).status, 401);

  step('studio sign-in');
  const signIn = (password) =>
    fetch(`${BASE}/api/studio/session`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ password }),
    });
  assert.equal((await signIn('not the password 0123456789')).status, 401);
  const signedIn = await signIn(ADMIN);
  assert.equal(signedIn.status, 200);
  const auth = { cookie: signedIn.headers.get('set-cookie').split(';')[0] };
  const session = await (await fetch(`${BASE}/api/studio/session`, { headers: auth })).json();
  assert.equal(session.signedIn, true);

  step('submit');
  const info = await (await fetch(`${BASE}/api/forms/contact`)).json();
  assert.equal(info.availability.state, 'open');
  const submit = (data, token = info.token) =>
    fetch(`${BASE}/api/forms/contact/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: BASE },
      body: JSON.stringify({ data, token }),
    });

  const early = await submit({
    name: 'Bot',
    email: 'bot@example.com',
    topic: 'Question',
    message: 'x',
  });
  assert.equal(early.status, 400, 'minimum completion time');
  await sleep(2100);

  const invalid = await submit({ name: 'Amy', email: 'nope', topic: 'Other', message: 'Hi' });
  assert.equal(invalid.status, 422);
  const invalidBody = await invalid.json();
  assert.ok(invalidBody.errors.email && invalidBody.errors.otherTopic);

  const ok = await submit({
    name: 'Amy',
    email: 'amy@example.com',
    topic: 'Feedback',
    otherTopic: 'dropped because hidden',
    message: '你好, "Open Form"',
  });
  assert.equal(ok.status, 201);
  const created = await ok.json();
  assert.equal(created.number, 1);

  step('studio api');
  const forms = await (await fetch(`${BASE}/api/forms`, { headers: auth })).json();
  const contact = forms.forms.find((f) => f.id === 'contact');
  assert.equal(contact.responses, 1);
  const detail = await (
    await fetch(`${BASE}/api/forms/contact/submissions/${created.id}`, { headers: auth })
  ).json();
  assert.deepEqual(detail.submission.data, {
    name: 'Amy',
    email: 'amy@example.com',
    topic: 'Feedback',
    message: '你好, "Open Form"',
  });
  const csv = await (await fetch(`${BASE}/api/forms/contact/export`, { headers: auth })).text();
  assert.match(csv, /"你好, ""Open Form"""/);
  const xlsx = await fetch(`${BASE}/api/forms/contact/export?format=xlsx`, { headers: auth });
  assert.equal(
    xlsx.headers.get('content-type'),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
  const xlsxBytes = Buffer.from(await xlsx.arrayBuffer());
  assert.equal(xlsxBytes.subarray(0, 2).toString(), 'PK');

  step('schedule override');
  const pause = await fetch(`${BASE}/api/forms/contact/overrides`, {
    method: 'PUT',
    headers: { ...auth, origin: BASE, 'content-type': 'application/json' },
    body: JSON.stringify({ submissions: { closed: true } }),
  });
  assert.equal(pause.status, 200);
  const paused = await (await fetch(`${BASE}/api/forms/contact`)).json();
  assert.equal(paused.availability.state, 'closed');
  const resume = await fetch(`${BASE}/api/forms/contact/overrides`, {
    method: 'DELETE',
    headers: { ...auth, origin: BASE },
  });
  assert.equal(resume.status, 200);
  const reopened = await (await fetch(`${BASE}/api/forms/contact`)).json();
  assert.equal(reopened.availability.state, 'open');

  step('db status');
  const status = JSON.parse(cli(['db', 'status', '--json']));
  assert.equal(status.ok, true);
  assert.equal(status.kind, POSTGRES ? 'postgres' : 'sqlite');
  assert.equal(status.responses.contact, 1);
  if (POSTGRES) {
    assert.equal(status.source, 'OPEN_FORM_DATABASE_URL');
    const { password } = new URL(POSTGRES);
    if (password) assert.ok(!JSON.stringify(status).includes(`:${password}@`), 'password hidden');
    assert.ok(!existsSync(path.join(WS, '.open-form/open-form.db')), 'nothing in SQLite');
  }

  step('cli export');
  const exported = cli(['responses', 'export', 'contact', '--format', 'json']);
  assert.equal(JSON.parse(exported)[0].data.email, 'amy@example.com');
  cli(['responses', 'export', 'contact', '-o', 'responses.xlsx']);
  assert.equal(readFileSync(path.join(WS, 'responses.xlsx')).subarray(0, 2).toString(), 'PK');

  step('delete');
  const del = await fetch(`${BASE}/api/forms/contact/submissions/${created.id}`, {
    method: 'DELETE',
    headers: { ...auth, origin: BASE },
  });
  assert.equal(del.status, 200);

  step('cli delete form');
  assert.throws(() => cli(['delete', 'waitlist'], { stdio: 'pipe' }), /--yes/);
  assert.ok(existsSync(path.join(WS, 'forms/waitlist')), 'kept without --yes');
  assert.match(cli(['delete', 'waitlist', '--yes']), /Deleted forms\/waitlist\/ and 0 responses/);
  assert.ok(!existsSync(path.join(WS, 'forms/waitlist')));
  assert.doesNotMatch(cli(['list']), /waitlist/);
  assert.throws(() => cli(['delete', 'waitlist', '--yes'], { stdio: 'pipe' }), /No form/);

  process.stdout.write('\n✔ e2e smoke passed\n');
  if (process.env.E2E_VERBOSE) process.stdout.write(logs);
} catch (err) {
  process.stderr.write(`\n✖ e2e smoke failed\n${err?.stack ?? err}\n`);
  process.exitCode = 1;
} finally {
  server?.kill();
  if (process.env.E2E_KEEP) process.stdout.write(`kept ${WS}\n`);
  else rmSync(SCRATCH, { recursive: true, force: true });
}
