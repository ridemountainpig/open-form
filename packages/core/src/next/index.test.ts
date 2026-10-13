import { mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryStorage } from '../server/index.ts';
import { createOpenFormRoute } from './index.ts';

const ORIGIN = 'https://app.example';
let root: string;

function writeEntry(title: string, mtime: number, max = 1) {
  const file = path.join(root, 'dist', 'server', 'entry.js');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `const schema = { id: 'rsvp', title: ${JSON.stringify(title)}, pages: [{ index: 0, when: [] }],
  fields: [{ name: 'email', type: 'email', required: true, page: 0, when: [] }] };
export const config = { protection: { minimumCompletionTime: false, rateLimit: { max: ${max}, window: '1m' } } };
export const formIds = ['rsvp'];
export async function loadFormDefinition(id) {
  return id === 'rsvp' ? { id, schema, version: ${JSON.stringify(title)}, config: {}, validators: new Map() } : null;
}
`,
  );
  utimesSync(file, mtime, mtime);
}

function route() {
  return createOpenFormRoute({
    root,
    storage: createMemoryStorage(),
    secret: 'test-secret-0123456789abcdef',
  });
}

const submit = (handler: (r: Request) => Promise<Response>, ip: string) =>
  handler(
    new Request(`${ORIGIN}/api/forms/rsvp/submissions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: ORIGIN,
        'x-forwarded-for': `6.6.6.6, ${ip}`,
      },
      body: JSON.stringify({ data: { email: 'amy@example.com' } }),
    }),
  );

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-next-'));
});
afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('createOpenFormRoute', () => {
  it('explains how to build the server bundle when it is missing', async () => {
    const { GET } = route();
    await expect(GET(new Request(`${ORIGIN}/api/forms/rsvp`))).rejects.toThrow(
      /open-form build --server-only/,
    );
  });

  it('serves forms and submissions, and no admin API without a token', async () => {
    writeEntry('RSVP', 1_000);
    const { GET, POST } = route();
    const info = (await (await GET(new Request(`${ORIGIN}/api/forms/rsvp`))).json()) as {
      title: string;
    };
    expect(info.title).toBe('RSVP');
    expect((await submit(POST, '203.0.113.7')).status).toBe(201);
    expect((await GET(new Request(`${ORIGIN}/api/forms`))).status).toBe(404);
  });

  it('rate limits by the address Next.js appended, not the one the client sent', async () => {
    writeEntry('RSVP', 1_000);
    const { POST } = route();
    expect((await submit(POST, '203.0.113.7')).status).toBe(201);
    expect((await submit(POST, '203.0.113.7')).status).toBe(429);
    expect((await submit(POST, '203.0.113.8')).status).toBe(201);
  });

  it('picks up a rebuilt bundle outside production', async () => {
    writeEntry('RSVP', 1_000);
    const { GET } = route();
    const title = async () =>
      ((await (await GET(new Request(`${ORIGIN}/api/forms/rsvp`))).json()) as { title: string })
        .title;
    expect(await title()).toBe('RSVP');
    writeEntry('RSVP v2', 2_000);
    expect(await title()).toBe('RSVP v2');
  });

  it('follows open-form.config.ts in a rebuilt bundle', async () => {
    writeEntry('RSVP', 1_000);
    const { POST } = route();
    expect((await submit(POST, '203.0.113.7')).status).toBe(201);
    expect((await submit(POST, '203.0.113.7')).status).toBe(429);
    writeEntry('RSVP', 2_000, 5);
    expect((await submit(POST, '203.0.113.7')).status).toBe(201);
  });

  it('asks for OPEN_FORM_SECRET where it cannot store one', async () => {
    writeEntry('RSVP', 1_000);
    writeFileSync(path.join(root, '.open-form'), '');
    vi.stubEnv('OPEN_FORM_SECRET', '');
    try {
      const { GET } = createOpenFormRoute({ root, storage: createMemoryStorage() });
      await expect(GET(new Request(`${ORIGIN}/api/forms/rsvp`))).rejects.toThrow(
        /Set OPEN_FORM_SECRET/,
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('points a missing bundle at outputFileTracingIncludes', async () => {
    const { GET } = route();
    await expect(GET(new Request(`${ORIGIN}/api/forms/rsvp`))).rejects.toThrow(
      "'./dist/server/**/*' to `outputFileTracingIncludes`",
    );
  });
});
