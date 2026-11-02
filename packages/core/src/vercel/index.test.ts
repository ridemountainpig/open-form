import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../server/index.ts';
import { createOpenFormApp, resolveVercelStorage } from './index.ts';

const ORIGIN = 'https://forms.example';
let root: string;

function writeBuild(config = '{}') {
  mkdirSync(path.join(root, 'dist', 'server'), { recursive: true });
  mkdirSync(path.join(root, 'dist', 'client'), { recursive: true });
  writeFileSync(
    path.join(root, 'dist', 'server', 'entry.js'),
    `const schema = { id: 'rsvp', title: 'RSVP', pages: [{ index: 0, when: [] }],
  fields: [{ name: 'email', type: 'email', required: true, page: 0, when: [] }] };
export const config = ${config};
export const formIds = ['rsvp'];
export async function loadFormDefinition(id) {
  return id === 'rsvp' ? { id, schema, version: '1', config: { protection: { minimumCompletionTime: false } }, validators: new Map() } : null;
}
`,
  );
  writeFileSync(
    path.join(root, 'dist', 'client', 'index.html'),
    '<!doctype html><script>1</script><div id="root"></div>',
  );
}

const app = () =>
  createOpenFormApp({
    root,
    storage: createMemoryStorage(),
    secret: 'test-secret-0123456789abcdef',
  });

const get = (path: string) => app().fetch(new Request(`${ORIGIN}${path}`));

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-vercel-'));
  vi.stubEnv('OPEN_FORM_ADMIN_PASSWORD', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe('createOpenFormApp', () => {
  it('explains the build command and includeFiles when the build is missing', async () => {
    await expect(get('/f/rsvp')).rejects.toThrow(/open-form build.*includeFiles/);
  });

  it('serves the form shell with its headers, and 404 for other paths', async () => {
    writeBuild();
    const page = await get('/f/rsvp');
    expect(page.status).toBe(200);
    expect(page.headers.get('content-type')).toMatch(/text\/html/);
    expect(page.headers.get('content-security-policy')).toBe("frame-ancestors 'self'");
    expect(page.headers.get('strict-transport-security')).toBe('max-age=31536000');
    expect(await page.text()).toContain('id="root"');
    expect((await get('/elsewhere')).status).toBe(404);
  });

  it('hides Studio without an admin password or a public Studio', async () => {
    writeBuild();
    expect((await get('/studio')).status).toBe(404);
    expect((await get('/')).status).toBe(404);
  });

  it('serves Studio with its own CSP once an admin password is set', async () => {
    vi.stubEnv('OPEN_FORM_ADMIN_PASSWORD', 'purple elephant dances quietly');
    writeBuild();
    const home = await get('/');
    expect(home.status).toBe(302);
    expect(home.headers.get('location')).toBe('/studio');
    const studio = await get('/studio/forms/rsvp');
    expect(studio.status).toBe(200);
    expect(studio.headers.get('content-security-policy')).toMatch(/script-src 'self' 'sha256-/);
  });

  it('answers the API, and no admin API without a password', async () => {
    writeBuild();
    const { fetch } = app();
    const info = (await (await fetch(new Request(`${ORIGIN}/api/forms/rsvp`))).json()) as {
      title: string;
      token: string;
    };
    expect(info.title).toBe('RSVP');
    const submit = (ip: string) =>
      fetch(
        new Request(`${ORIGIN}/api/forms/rsvp/submissions`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: ORIGIN,
            'x-forwarded-for': `6.6.6.6, ${ip}`,
          },
          body: JSON.stringify({ data: { email: 'amy@example.com' }, token: info.token }),
        }),
      );
    expect((await submit('203.0.113.7')).status).toBe(201);
    expect((await fetch(new Request(`${ORIGIN}/api/forms`))).status).toBe(404);
  });

  it('refuses page requests that are not GET or HEAD', async () => {
    writeBuild();
    const res = await app().fetch(new Request(`${ORIGIN}/f/rsvp`, { method: 'POST' }));
    expect(res.status).toBe(405);
  });

  it('rejects an admin password that breaks the rules', async () => {
    vi.stubEnv('OPEN_FORM_ADMIN_PASSWORD', 'short');
    writeBuild();
    await expect(get('/f/rsvp')).rejects.toThrow(/OPEN_FORM_ADMIN_PASSWORD/);
  });
});

describe('resolveVercelStorage', () => {
  const neon = 'postgres://neon@ep-x-pooler.neon.tech/neondb?sslmode=require';

  beforeEach(() => {
    for (const name of ['OPEN_FORM_DATABASE_URL', 'OPEN_FORM_DB', 'POSTGRES_URL', 'DATABASE_URL']) {
      vi.stubEnv(name, '');
    }
  });

  it('falls back to the Marketplace variables, POSTGRES_URL first', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://other@db/app');
    vi.stubEnv('POSTGRES_URL', neon);
    expect(resolveVercelStorage(root)).toEqual({
      kind: 'postgres',
      url: neon,
      source: 'POSTGRES_URL',
    });
    vi.stubEnv('POSTGRES_URL', '');
    expect(resolveVercelStorage(root)).toMatchObject({ source: 'DATABASE_URL' });
  });

  it('lets OPEN_FORM_DATABASE_URL and the config win', () => {
    vi.stubEnv('POSTGRES_URL', neon);
    vi.stubEnv('OPEN_FORM_DATABASE_URL', 'postgres://mine@db/forms');
    expect(resolveVercelStorage(root)).toMatchObject({ source: 'OPEN_FORM_DATABASE_URL' });
    vi.stubEnv('OPEN_FORM_DATABASE_URL', '');
    expect(resolveVercelStorage(root, { storage: { path: 'data.db' } })).toMatchObject({
      kind: 'sqlite',
      source: 'storage.path',
    });
  });

  it('ignores a DATABASE_URL that is not Postgres', () => {
    vi.stubEnv('DATABASE_URL', 'mysql://app@db/app');
    expect(resolveVercelStorage(root)).toMatchObject({ kind: 'sqlite', source: 'default' });
  });
});
