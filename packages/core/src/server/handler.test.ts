import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type FormConfig,
  type FormSchema,
  type ProtectionConfig,
  schemaVersion,
} from '../schema/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { createSigner } from './crypto.ts';
import { toCsv } from './export.ts';
import { createOpenFormHandler, type FormDefinition, type OpenFormHandler } from './handler.ts';
import { XLSX_CONTENT_TYPE } from './xlsx.ts';

const SECRET = 'test-secret-0123456789abcdef';
const ORIGIN = 'http://localhost:3000';

const schema: FormSchema = {
  id: 'meetup',
  title: 'Meetup',
  pages: [{ index: 0, when: [] }],
  fields: [
    { name: 'name', type: 'text', label: 'Name', required: true, page: 0, when: [] },
    { name: 'email', type: 'email', label: 'Email', required: true, page: 0, when: [] },
    {
      name: 'role',
      type: 'select',
      label: 'Role',
      page: 0,
      when: [],
      options: [
        { value: 'Student', label: 'Student' },
        { value: 'Engineer', label: 'Engineer' },
      ],
    },
    {
      name: 'school',
      type: 'text',
      label: 'School',
      required: true,
      page: 0,
      when: [{ field: 'role', equals: 'Student' }],
    },
  ],
};

let now = Date.UTC(2026, 9, 8, 12);
let storage: StorageAdapter;
let config: FormConfig;

function definition(): FormDefinition {
  return { id: 'meetup', schema, version: schemaVersion(schema), config, validators: new Map() };
}

let address = '203.0.113.7';

function makeHandler(protection?: ProtectionConfig): OpenFormHandler {
  return createOpenFormHandler({
    registry: {
      list: async () => ['meetup'],
      load: async (id) => (id === 'meetup' ? definition() : null),
    },
    storage,
    secret: SECRET,
    config: { protection: protection ?? { minimumCompletionTime: false, rateLimit: false } },
    now: () => now,
    clientAddress: () => address,
    adminAuth: { authorize: () => true },
  });
}

function post(data: unknown, extra: Record<string, unknown> = {}, headers: HeadersInit = {}) {
  return new Request(`${ORIGIN}/api/forms/meetup/submissions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
    body: JSON.stringify({ data, ...extra }),
  });
}

const alex = { name: 'Alex', email: 'alex@example.com', role: 'Engineer' };

beforeEach(async () => {
  storage = await createSqliteStorage({ path: ':memory:' });
  config = { title: 'Meetup' };
  now = Date.UTC(2026, 9, 8, 12);
  address = '203.0.113.7';
});

afterEach(async () => {
  await storage.close();
});

describe('submissions', () => {
  it('validates, strips hidden fields, stores and numbers responses', async () => {
    const handle = makeHandler();
    const res = await handle(post({ ...alex, school: 'NTU', injected: 1 }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; number: number };
    expect(body.number).toBe(1);
    expect(res.headers.get('set-cookie')).toMatch(/^of_vid=[\w-]+; Path=\/; .*HttpOnly/);

    const stored = await storage.getSubmission('meetup', body.id);
    expect(stored?.data).toEqual(alex);

    const second = await handle(post({ ...alex, email: 'b@example.com' }));
    expect(((await second.json()) as { number: number }).number).toBe(2);
  });

  it('survives malformed cookies and path escapes', async () => {
    const handle = makeHandler();
    expect((await handle(post(alex, {}, { cookie: 'of_vid=%E0%A4%A' }))).status).toBe(201);
    expect((await handle(new Request(`${ORIGIN}/api/forms/%E0%A4%A`))).status).toBe(404);
  });

  it("logs a failing validator's error without its message, which may quote answers", async () => {
    const handle = createOpenFormHandler({
      registry: {
        list: async () => ['meetup'],
        load: async () => ({
          ...definition(),
          validators: new Map([
            [
              'name',
              () => {
                throw new SyntaxError('Unexpected token in "Alex Secret"');
              },
            ],
          ]),
        }),
      },
      storage,
      secret: SECRET,
      config: { protection: { minimumCompletionTime: false, rateLimit: false } },
    });
    const logged: unknown[][] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
      logged.push(args);
    });
    try {
      const res = await handle(post(alex));
      expect(res.status).toBe(500);
      expect(await res.json()).toMatchObject({ message: 'Internal server error.' });
    } finally {
      spy.mockRestore();
    }
    expect(JSON.stringify(logged)).toContain('SyntaxError');
    expect(JSON.stringify(logged)).not.toContain('Alex');
  });

  it('returns field errors as 422', async () => {
    const res = await makeHandler()(post({ name: '', email: 'nope', role: 'Student' }));
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({
      error: 'invalid',
      errors: {
        name: 'This field is required.',
        email: 'Enter a valid email address.',
        school: 'This field is required.',
      },
    });
  });

  it('accepts its own https pages behind a proxy that ends TLS, and nothing looser', async () => {
    const handle = makeHandler();
    const at = (url: string, headers: Record<string, string>, email: string) =>
      handle(
        new Request(`${url}/api/forms/meetup/submissions`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify({ data: { ...alex, email } }),
        }),
      );
    const proxied = await at('http://forms.example', { origin: 'https://forms.example' }, '1@x.co');
    expect(proxied.status).toBe(201);
    expect(proxied.headers.get('set-cookie')).toMatch(/; Secure$/);
    const status = async (url: string, headers: Record<string, string>) =>
      (await at(url, headers, `${Math.random()}@x.co`)).status;
    expect(await status('https://forms.example', { origin: 'http://forms.example' })).toBe(403);
    expect(await status('http://forms.example', { origin: 'https://evil.example' })).toBe(403);
    expect(await status('http://forms.example', { origin: 'https://forms.example:8443' })).toBe(
      403,
    );
    expect(await status('http://forms.example', { origin: 'null' })).toBe(403);
    expect(
      await status('http://forms.example', {
        origin: 'https://forms.example',
        'sec-fetch-site': 'cross-site',
      }),
    ).toBe(403);
    const plain = await at('http://forms.example', { origin: 'http://forms.example' }, '2@x.co');
    expect(plain.status).toBe(201);
    expect(plain.headers.get('set-cookie')).not.toMatch(/Secure/);
  });

  it('blocks cross-origin and non-JSON requests', async () => {
    const handle = makeHandler();
    expect((await handle(post(alex, {}, { origin: 'https://evil.example' }))).status).toBe(403);
    const form = new Request(`${ORIGIN}/api/forms/meetup/submissions`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'name=x',
    });
    expect((await handle(form)).status).toBe(415);
  });

  it('caps chunked bodies that declare no length', async () => {
    const chunk = new TextEncoder().encode(`{"data":{"name":"${'x'.repeat(64 * 1024)}`);
    let sent = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent++;
        controller.enqueue(chunk);
      },
    });
    const res = await makeHandler()(
      new Request(`${ORIGIN}/api/forms/meetup/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body,
        duplex: 'half',
      } as RequestInit),
    );
    expect(res.status).toBe(413);
    expect(sent).toBeLessThan(10);
  });

  it('answers honeypot hits like real submissions without storing them', async () => {
    const handle = makeHandler();
    const real = await handle(post(alex));
    const fake = await handle(post({ ...alex, email: 'b@x.co' }, { hp: 'http://spam.example' }));
    expect(fake.status).toBe(201);
    expect(Object.keys(await fake.json()).sort()).toEqual(Object.keys(await real.json()).sort());
    expect(fake.headers.get('set-cookie')).toMatch(/^of_vid=/);
    expect(fake.headers.get('set-cookie')?.replace(/=[\w-]+;/, '')).toBe(
      real.headers.get('set-cookie')?.replace(/=[\w-]+;/, ''),
    );
    const again = await handle(post({ ...alex, email: 'c@x.co' }, { hp: 'spam' }));
    expect(((await again.json()) as { number: number }).number).toBe(3);
    expect(await storage.countSubmissions('meetup')).toBe(1);
    expect(await storage.listFormVersions('meetup')).toHaveLength(1);

    const invalid = await handle(post({ ...alex, email: 'nope' }, { hp: 'spam' }));
    expect(invalid.status).toBe(422);
  });

  it('checks the token and rate limit before the honeypot, so it can’t be told apart', async () => {
    const handle = makeHandler({
      minimumCompletionTime: '3s',
      rateLimit: { max: 1, window: '1m' },
    });
    for (const hp of ['', 'spam']) {
      const res = await handle(post(alex, { hp, token: 'garbage' }));
      expect(((await res.json()) as { error: string }).error).toBe('invalid_token');
    }
    const info = (await (await handle(new Request(`${ORIGIN}/api/forms/meetup`))).json()) as {
      token: string;
    };
    now += 5000;
    expect((await handle(post(alex, { hp: 'spam', token: info.token }))).status).toBe(201);
    expect((await handle(post(alex, { hp: 'spam', token: info.token }))).status).toBe(429);
    expect(await storage.countSubmissions('meetup')).toBe(0);
  });

  it('answers a full form the same with the honeypot filled', async () => {
    config = { submissions: { uniqueBy: 'email', maxResponses: 2 } };
    const handle = makeHandler();
    expect((await handle(post(alex))).status).toBe(201);
    expect((await handle(post({ ...alex, email: 'b@x.co' }))).status).toBe(201);
    expect((await handle(post({ ...alex, email: 'c@x.co' }, { hp: 'spam' }))).status).toBe(410);
  });

  it('never reveals through the honeypot who has already responded', async () => {
    config = { submissions: { uniqueBy: 'email' } };
    const handle = makeHandler();
    expect((await handle(post(alex))).status).toBe(201);
    expect((await handle(post(alex, { hp: 'spam' }))).status).toBe(201);
    expect((await handle(post(alex))).status).toBe(409);
    expect(await storage.countSubmissions('meetup')).toBe(1);
  });

  it('enforces the minimum completion time with a signed token', async () => {
    const handle = makeHandler({ minimumCompletionTime: '3s', rateLimit: false });
    const info = (await (await handle(new Request(`${ORIGIN}/api/forms/meetup`))).json()) as {
      token: string;
      availability: { state: string };
    };
    expect(info.availability.state).toBe('open');

    now += 1000;
    const early = await handle(post(alex, { token: info.token }));
    expect(early.status).toBe(400);
    expect(((await early.json()) as { error: string }).error).toBe('too_fast');

    const forged = await handle(post(alex, { token: `${now - 10_000}.forged` }));
    expect(((await forged.json()) as { error: string }).error).toBe('invalid_token');

    now += 5000;
    expect((await handle(post(alex, { token: info.token }))).status).toBe(201);

    now += 8 * 24 * 60 * 60 * 1000;
    const stale = await handle(post({ ...alex, email: 'b@x.co' }, { token: info.token }));
    expect(stale.status).toBe(400);
    expect(((await stale.json()) as { error: string }).error).toBe('expired_token');
  });

  it('rate limits per address and form', async () => {
    const handle = makeHandler({
      minimumCompletionTime: false,
      rateLimit: { max: 2, window: '1m' },
    });
    expect((await handle(post({ ...alex, email: '1@x.co' }))).status).toBe(201);
    expect((await handle(post({ ...alex, email: '2@x.co' }))).status).toBe(201);
    expect((await handle(post({ ...alex, email: '3@x.co' }))).status).toBe(429);
    now += 61_000;
    expect((await handle(post({ ...alex, email: '4@x.co' }))).status).toBe(201);
  });

  it('counts only valid submissions against the rate limit', async () => {
    const handle = makeHandler({
      minimumCompletionTime: false,
      rateLimit: { max: 1, window: '1m' },
    });
    for (let i = 0; i < 3; i++) {
      expect((await handle(post({ ...alex, email: 'nope' }))).status).toBe(422);
    }
    expect((await handle(post(alex))).status).toBe(201);
    expect((await handle(post({ ...alex, email: 'b@x.co' }))).status).toBe(429);
  });

  it('caps attempts, valid or not, at five times the rate limit', async () => {
    const handle = makeHandler({
      minimumCompletionTime: false,
      rateLimit: { max: 1, window: '1m' },
    });
    for (let i = 0; i < 5; i++) {
      expect((await handle(post({ ...alex, email: 'nope' }))).status).toBe(422);
    }
    expect((await handle(post({ ...alex, email: 'nope' }))).status).toBe(429);
    expect((await handle(post(alex))).status).toBe(429);
    now += 61_000;
    expect((await handle(post(alex))).status).toBe(201);
  });

  it('rate limits an IPv6 /64 as one visitor, and IPv4 addresses one by one', async () => {
    const handle = makeHandler({
      minimumCompletionTime: false,
      rateLimit: { max: 1, window: '1m' },
    });
    const from = async (ip: string, email: string) => {
      address = ip;
      return (await handle(post({ ...alex, email }))).status;
    };
    expect(await from('2001:db8:1:2::1', '1@x.co')).toBe(201);
    expect(await from('2001:db8:1:2:aaaa::2', '2@x.co')).toBe(429);
    expect(await from('2001:db8:1:3::1', '3@x.co')).toBe(201);
    expect(await from('::ffff:203.0.113.7', '4@x.co')).toBe(201);
    expect(await from('203.0.113.7', '5@x.co')).toBe(429);
    expect(await from('203.0.113.8', '6@x.co')).toBe(201);
  });

  it('keeps accepting responses after the form’s stored data is deleted', async () => {
    const handle = makeHandler();
    expect((await handle(post(alex))).status).toBe(201);
    await storage.deleteForm('meetup');
    const res = await handle(post(alex));
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const stored = await storage.getSubmission('meetup', id);
    expect(await storage.getFormVersion(stored?.formVersionId as string)).not.toBeNull();
  });

  it('enforces uniqueBy a field, case-insensitively', async () => {
    config = { submissions: { uniqueBy: 'email' } };
    const handle = makeHandler();
    expect((await handle(post(alex))).status).toBe(201);
    const dupe = await handle(post({ ...alex, email: 'ALEX@example.com ' }));
    expect(dupe.status).toBe(409);
    expect(((await dupe.json()) as { error: string }).error).toBe('duplicate');
  });

  it('enforces uniqueBy device via the visitor cookie', async () => {
    config = { submissions: { uniqueBy: 'device' } };
    const handle = makeHandler();
    const first = await handle(post(alex));
    const cookie = first.headers.get('set-cookie')?.split(';')[0] as string;
    const again = await handle(post({ ...alex, email: 'other@x.co' }, {}, { cookie }));
    expect(again.status).toBe(409);

    const info = await handle(new Request(`${ORIGIN}/api/forms/meetup`, { headers: { cookie } }));
    expect(((await info.json()) as { availability: { state: string } }).availability.state).toBe(
      'duplicate',
    );
  });

  it('closes at maxResponses and outside the submission window', async () => {
    config = { submissions: { maxResponses: 1 } };
    const handle = makeHandler();
    expect((await handle(post(alex))).status).toBe(201);
    const full = await handle(post({ ...alex, email: 'b@x.co' }));
    expect(full.status).toBe(410);
    expect(((await full.json()) as { error: string }).error).toBe('full');

    config = { submissions: { closesAt: '2026-10-01' } };
    const closed = await makeHandler()(post(alex));
    expect(((await closed.json()) as { error: string }).error).toBe('closed');
  });
});

describe('languages', () => {
  it('answers in the respondent’s language and records it', async () => {
    config = { title: 'Meetup', locale: 'en', translations: { ja: { Name: 'お名前' } } };
    const handler = makeHandler();
    const invalid = await handler(post({ email: 'alex@example.com' }, { locale: 'ja' }));
    expect(invalid.status).toBe(422);
    const body = (await invalid.json()) as { message: string; errors: Record<string, string> };
    expect(body.message).toBe('表示された項目を修正してください。');
    expect(body.errors.name).toBe('この項目は必須です。');

    expect((await handler(post(alex, { locale: 'ja' }))).status).toBe(201);
    // A language the form doesn't offer falls back to the one it's written in.
    expect(
      (await handler(post({ ...alex, email: 'b@example.com' }, { locale: 'fr' }))).status,
    ).toBe(201);
    const page = await storage.listSubmissions('meetup', { order: 'asc' });
    expect(page.items.map((s) => s.locale)).toEqual(['ja', 'en']);

    const csv = await (
      await handler(new Request(`${ORIGIN}/api/forms/meetup/export?format=csv`))
    ).text();
    expect(csv).toContain('#,Submitted at (UTC),Language,Name');
    expect(csv).toMatch(/\r\n1,\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},日本語,/);
  });
});

describe('admin endpoints', () => {
  it('lists, pages, searches, exports and deletes responses', async () => {
    const handle = makeHandler();
    await handle(post({ name: 'Amy', email: 'amy@example.com', role: 'Student', school: '台大' }));
    await handle(post({ name: '=HYPERLINK("x")', email: 'eve@example.com', role: 'Engineer' }));

    const forms = (await (await handle(new Request(`${ORIGIN}/api/forms`))).json()) as {
      forms: Array<{ id: string; responses: number; fields: number }>;
    };
    expect(forms.forms).toEqual([
      expect.objectContaining({ id: 'meetup', responses: 2, fields: 4, status: 'open' }),
    ]);

    const page = (await (
      await handle(new Request(`${ORIGIN}/api/forms/meetup/submissions?q=台大`))
    ).json()) as { items: Array<{ id: string; data: { name: string } }>; total: number };
    expect(page.total).toBe(1);
    expect(page.items[0]?.data.name).toBe('Amy');

    const filtered = async (filter: string) =>
      handle(
        new Request(`${ORIGIN}/api/forms/meetup/submissions?filter=${encodeURIComponent(filter)}`),
      );
    const byRole = (await (
      await filtered(JSON.stringify({ rules: [{ field: 'role', op: 'is', value: 'engineer' }] }))
    ).json()) as { items: Array<{ data: { email: string } }>; total: number };
    expect(byRole.total).toBe(1);
    expect(byRole.items[0]?.data.email).toBe('eve@example.com');
    const bad = await filtered(JSON.stringify({ rules: [{ field: 'role', op: 'like' }] }));
    expect(bad.status).toBe(400);
    expect(((await bad.json()) as { message: string }).message).toMatch(/unknown operator/);
    expect((await filtered('{')).status).toBe(400);

    const sortedBy = async (sort: string) =>
      handle(
        new Request(`${ORIGIN}/api/forms/meetup/submissions?sort=${encodeURIComponent(sort)}`),
      );
    const byEmail = (await (
      await sortedBy(JSON.stringify({ field: 'email', direction: 'desc' }))
    ).json()) as { items: Array<{ data: { email: string } }> };
    expect(byEmail.items.map((item) => item.data.email)).toEqual([
      'eve@example.com',
      'amy@example.com',
    ]);
    expect((await sortedBy(JSON.stringify({ field: 'email' }))).status).toBe(400);

    const bytes = new Uint8Array(
      await (await handle(new Request(`${ORIGIN}/api/forms/meetup/export`))).arrayBuffer(),
    );
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    const csv = new TextDecoder().decode(bytes);
    expect(csv.startsWith('#,Submitted at (UTC),Name,Email,Role,School\r\n')).toBe(true);
    expect(csv).toContain(',台大\r\n');
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);

    // Studio exports what its search and filters show.
    const exported = async (query: string) =>
      (await handle(new Request(`${ORIGIN}/api/forms/meetup/export?format=csv&${query}`))).text();
    const searched = await exported('q=eve');
    expect(searched).toContain('eve@example.com');
    expect(searched).not.toContain('amy@example.com');
    const rule = JSON.stringify({ rules: [{ field: 'role', op: 'is', value: 'engineer' }] });
    const byRule = await exported(`filter=${encodeURIComponent(rule)}`);
    expect(byRule).toContain('eve@example.com');
    expect(byRule).not.toContain('amy@example.com');
    expect((await handle(new Request(`${ORIGIN}/api/forms/meetup/export?filter={`))).status).toBe(
      400,
    );

    const xlsx = await handle(new Request(`${ORIGIN}/api/forms/meetup/export?format=xlsx`));
    expect(xlsx.headers.get('content-type')).toBe(XLSX_CONTENT_TYPE);
    expect(xlsx.headers.get('content-disposition')).toMatch(/meetup-responses-[\d-]+\.xlsx"$/);
    expect([...new Uint8Array(await xlsx.arrayBuffer()).slice(0, 4)]).toEqual([
      0x50, 0x4b, 0x03, 0x04,
    ]);

    const id = page.items[0]?.id as string;
    const del = await handle(
      new Request(`${ORIGIN}/api/forms/meetup/submissions/${id}`, {
        method: 'DELETE',
        headers: { origin: ORIGIN },
      }),
    );
    expect(del.status).toBe(200);
    expect(await storage.countSubmissions('meetup')).toBe(1);
  });

  it('deletes several responses at once', async () => {
    const handle = makeHandler();
    for (const email of ['a@x.co', 'b@x.co', 'c@x.co']) {
      expect((await handle(post({ ...alex, email }))).status).toBe(201);
    }
    const { items } = await storage.listSubmissions('meetup');
    const bulk = (body: unknown, headers: HeadersInit = { origin: ORIGIN }) =>
      handle(
        new Request(`${ORIGIN}/api/forms/meetup/submissions/delete`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...headers },
          body: JSON.stringify(body),
        }),
      );

    const ids = items.slice(0, 2).map((item) => item.id);
    const res = await bulk({ ids: [...ids, ids[0], 'missing'] });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    expect(await storage.countSubmissions('meetup')).toBe(1);

    expect((await bulk({ ids: [] })).status).toBe(400);
    expect((await bulk({ ids: [1] })).status).toBe(400);
    expect((await bulk({ ids: Array(501).fill('x') })).status).toBe(400);
    expect((await bulk({ ids: [items[2]?.id] }, { origin: 'https://evil.example' })).status).toBe(
      403,
    );
    expect(await storage.countSubmissions('meetup')).toBe(1);
  });

  it('pages with whole numbers only', async () => {
    const handle = makeHandler();
    for (const email of ['a@x.co', 'b@x.co', 'c@x.co']) await handle(post({ ...alex, email }));
    const list = (query: string) =>
      handle(new Request(`${ORIGIN}/api/forms/meetup/submissions?${query}`));
    for (const query of ['limit=2.5', 'offset=1.5', 'offset=1e400', 'offset=-1', 'limit=abc']) {
      const res = await list(query);
      expect(res.status, query).toBe(400);
      expect(await res.json()).toMatchObject({ error: 'bad_request' });
    }
    const page = (await (await list('limit=100000&offset=1')).json()) as {
      items: unknown[];
      limit: number;
      offset: number;
    };
    expect(page).toMatchObject({ limit: 500, offset: 1 });
    expect(page.items).toHaveLength(2);
    expect(((await (await list('limit=&offset=')).json()) as { limit: number }).limit).toBe(50);
  });

  it('refuses admin requests the gate does not authorize', async () => {
    const handle = createOpenFormHandler({
      registry: { list: async () => [], load: async () => null },
      storage,
      secret: SECRET,
      adminAuth: { authorize: () => false },
    });
    const res = await handle(new Request(`${ORIGIN}/api/forms`));
    expect(res.status).toBe(401);
    expect(res.headers.get('www-authenticate')).toBeNull();
    const publicRoute = await handle(new Request(`${ORIGIN}/api/forms/missing`));
    expect(publicRoute.status).toBe(404);
  });

  it('stays closed when no admin gate is given', async () => {
    const handle = createOpenFormHandler({
      registry: { list: async () => ['meetup'], load: async () => definition() },
      storage,
      secret: SECRET,
    });
    expect((await handle(new Request(`${ORIGIN}/api/forms`))).status).toBe(404);
    expect((await handle(new Request(`${ORIGIN}/api/forms/meetup/export`))).status).toBe(404);
    expect((await handle(new Request(`${ORIGIN}/api/forms/meetup`))).status).toBe(200);
  });

  it('serves the folder manifest to signed-in Studio only', async () => {
    const manifest = { folders: [{ id: 'f-1', name: 'Events' }], assignments: { meetup: 'f-1' } };
    const handler = (authorized: boolean) =>
      createOpenFormHandler({
        registry: { list: async () => [], load: async () => null, folders: async () => manifest },
        storage,
        secret: SECRET,
        adminAuth: { authorize: () => authorized },
      });
    const folders = new Request(`${ORIGIN}/api/studio/folders`);
    expect((await handler(false)(folders)).status).toBe(401);
    expect(await (await handler(true)(folders)).json()).toEqual(manifest);
  });
});

describe('public read-only Studio', () => {
  const PASSWORD = 'correct horse battery staple';

  function publicHandler(adminAuth?: { password: string }) {
    return createOpenFormHandler({
      registry: {
        list: async () => ['meetup'],
        load: async (id) => (id === 'meetup' ? definition() : null),
      },
      storage,
      secret: SECRET,
      config: { protection: { minimumCompletionTime: false, rateLimit: false } },
      now: () => now,
      clientAddress: () => address,
      adminAuth,
      publicStudio: 'read-only',
    });
  }

  const get = (handle: OpenFormHandler, path: string, cookie?: string) =>
    handle(new Request(`${ORIGIN}/api${path}`, { headers: cookie ? { cookie } : {} }));
  const send = (handle: OpenFormHandler, method: string, path: string, cookie?: string) =>
    handle(
      new Request(`${ORIGIN}/api${path}`, {
        method,
        headers: {
          origin: ORIGIN,
          'content-type': 'application/json',
          ...(cookie ? { cookie } : {}),
        },
        body: method === 'DELETE' ? undefined : JSON.stringify({ ids: ['x'] }),
      }),
    );

  it('lets anyone read Studio but not change anything', async () => {
    const handle = publicHandler();
    const created = (await (await handle(post(alex))).json()) as { id: string };

    expect((await get(handle, '/forms')).status).toBe(200);
    expect((await get(handle, '/forms/meetup/schema')).status).toBe(200);
    const page = (await (await get(handle, '/forms/meetup/submissions')).json()) as {
      total: number;
    };
    expect(page.total).toBe(1);
    expect((await get(handle, `/forms/meetup/submissions/${created.id}`)).status).toBe(200);
    expect((await get(handle, '/forms/meetup/export')).status).toBe(200);
    expect(await (await get(handle, '/studio/session')).json()).toMatchObject({
      signedIn: false,
      readOnly: true,
      signIn: null,
    });

    expect((await send(handle, 'DELETE', `/forms/meetup/submissions/${created.id}`)).status).toBe(
      404,
    );
    expect((await send(handle, 'POST', '/forms/meetup/submissions/delete')).status).toBe(404);
    expect((await send(handle, 'DELETE', '/forms/meetup/overrides')).status).toBe(404);
    expect((await send(handle, 'POST', '/studio/session')).status).toBe(404);
    expect(await storage.countSubmissions('meetup')).toBe(1);
  });

  it('still asks for the password before changes', async () => {
    const handle = publicHandler({ password: PASSWORD });
    const created = (await (await handle(post(alex))).json()) as { id: string };
    expect((await get(handle, '/forms')).status).toBe(200);
    expect(await (await get(handle, '/studio/session')).json()).toMatchObject({
      signedIn: false,
      readOnly: true,
      signIn: 'password',
    });
    const path = `/forms/meetup/submissions/${created.id}`;
    expect((await send(handle, 'DELETE', path)).status).toBe(401);

    const signedIn = await handle(
      new Request(`${ORIGIN}/api/studio/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ password: PASSWORD }),
      }),
    );
    const cookie = signedIn.headers.get('set-cookie')?.split(';')[0];
    expect(await (await get(handle, '/studio/session', cookie)).json()).toMatchObject({
      signedIn: true,
      readOnly: false,
    });
    expect((await send(handle, 'DELETE', path, cookie)).status).toBe(200);
  });

  it('is off unless asked for', async () => {
    const handle = createOpenFormHandler({
      registry: { list: async () => ['meetup'], load: async () => definition() },
      storage,
      secret: SECRET,
      adminAuth: { password: PASSWORD },
    });
    expect((await get(handle, '/forms')).status).toBe(401);
    expect(await (await get(handle, '/studio/session')).json()).toMatchObject({
      signedIn: false,
      readOnly: false,
    });
  });
});

describe('schedule', () => {
  const put = (submissions: unknown, headers: HeadersInit = {}, timeZone?: string) =>
    new Request(`${ORIGIN}/api/forms/meetup/overrides`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
      body: JSON.stringify({ submissions, timeZone }),
    });
  const state = async (handle: OpenFormHandler) =>
    (
      (await (await handle(new Request(`${ORIGIN}/api/forms/meetup`))).json()) as {
        availability: { state: string };
      }
    ).availability.state;

  it('reads policy dates in the form’s time zone', async () => {
    // now is 12:00 UTC, which is 20:00 in Taipei.
    config = { submissions: { closesAt: '2026-10-08T19:00' } };
    expect(await state(makeHandler())).toBe('open');
    config = { timeZone: 'Asia/Taipei', submissions: { closesAt: '2026-10-08T19:00' } };
    expect(await state(makeHandler())).toBe('closed');
  });

  it('lets Studio change the schedule without touching the code', async () => {
    config = { submissions: { closesAt: '2026-10-01', maxResponses: 100, uniqueBy: 'email' } };
    const handle = makeHandler();
    expect(await state(handle)).toBe('closed');

    const saved = await handle(
      put({ opensAt: null, closesAt: '2026-10-31', maxResponses: 100, closed: false }),
    );
    expect(saved.status).toBe(200);
    // Only what differs from the code is stored, so later code edits still apply.
    expect(((await saved.json()) as { overrides: unknown }).overrides).toEqual({
      submissions: { closesAt: '2026-10-31' },
      updatedAt: expect.any(String),
    });
    expect(await state(handle)).toBe('open');
    expect((await handle(post(alex))).status).toBe(201);

    const info = (await (
      await handle(new Request(`${ORIGIN}/api/forms/meetup/schema`))
    ).json()) as { status: string; schedule: unknown; config: FormConfig; closesAt: string };
    expect(info.status).toBe('open');
    expect(info.schedule).toEqual({
      opensAt: null,
      closesAt: '2026-10-31',
      maxResponses: 100,
      closed: false,
    });
    expect(info.config.submissions?.closesAt).toBe('2026-10-01');
    expect(info.closesAt).toBe('2026-10-31T23:59:59.999Z');

    await handle(put({ closesAt: '2026-10-31', maxResponses: 100, closed: true }));
    expect(await state(handle)).toBe('closed');
    const forms = (await (await handle(new Request(`${ORIGIN}/api/forms`))).json()) as {
      forms: Array<{ status: string }>;
    };
    expect(forms.forms[0]?.status).toBe('closed');

    const cleared = await handle(
      new Request(`${ORIGIN}/api/forms/meetup/overrides`, {
        method: 'DELETE',
        headers: { origin: ORIGIN },
      }),
    );
    expect(cleared.status).toBe(200);
    expect(await storage.getFormOverrides('meetup')).toBeNull();
    expect(await state(handle)).toBe('closed');
  });

  it('lets Studio read the code’s dates in another time zone', async () => {
    // now is 12:00 UTC, which is 20:00 in Taipei.
    config = { submissions: { closesAt: '2026-10-08T19:00' } };
    const handle = makeHandler();
    expect(await state(handle)).toBe('open');
    const schema = async () =>
      (await (await handle(new Request(`${ORIGIN}/api/forms/meetup/schema`))).json()) as {
        timeZone: string;
        timeZoneFallback: boolean;
      };
    expect(await schema()).toMatchObject({ timeZone: 'UTC', timeZoneFallback: true });

    const saved = await handle(put({ closesAt: '2026-10-08T19:00' }, {}, 'Asia/Taipei'));
    expect(((await saved.json()) as { overrides: unknown }).overrides).toEqual({
      timeZone: 'Asia/Taipei',
      updatedAt: expect.any(String),
    });
    expect(await state(handle)).toBe('closed');
    expect(await schema()).toMatchObject({ timeZone: 'Asia/Taipei', timeZoneFallback: false });

    await handle(put({ closesAt: '2026-10-08T19:00' }, {}, 'UTC'));
    expect(await storage.getFormOverrides('meetup')).toBeNull();
    expect((await handle(put({}, {}, 'Mars/Olympus'))).status).toBe(422);
  });

  it('applies an overridden limit to new responses', async () => {
    config = { submissions: { maxResponses: 100 } };
    const handle = makeHandler();
    await handle(put({ maxResponses: 1 }));
    expect((await handle(post(alex))).status).toBe(201);
    expect(await state(handle)).toBe('full');
    expect((await handle(post({ ...alex, email: 'b@x.co' }))).status).toBe(410);
  });

  it('answers 404 for an unpublished form but keeps it in Studio', async () => {
    config = { published: false };
    const handle = makeHandler();
    const status = async (request: Request) => (await handle(request)).status;
    expect(await status(new Request(`${ORIGIN}/api/forms/meetup`))).toBe(404);
    expect(await status(post(alex))).toBe(404);
    expect(await storage.countSubmissions('meetup')).toBe(0);

    const schema = async () =>
      (await (await handle(new Request(`${ORIGIN}/api/forms/meetup/schema`))).json()) as {
        published: boolean;
        status: string;
      };
    expect(await schema()).toMatchObject({ published: false, status: 'unpublished' });
    const forms = (await (await handle(new Request(`${ORIGIN}/api/forms`))).json()) as {
      forms: Array<{ status: string }>;
    };
    expect(forms.forms[0]?.status).toBe('unpublished');
  });

  it('lets Studio unpublish and republish without touching the code', async () => {
    config = {};
    const handle = makeHandler();
    const publish = (published: unknown) =>
      handle(
        new Request(`${ORIGIN}/api/forms/meetup/overrides`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({ submissions: {}, published }),
        }),
      );

    const saved = await publish(false);
    expect(((await saved.json()) as { overrides: unknown }).overrides).toEqual({
      published: false,
      updatedAt: expect.any(String),
    });
    expect((await handle(new Request(`${ORIGIN}/api/forms/meetup`))).status).toBe(404);
    expect((await handle(post(alex))).status).toBe(404);

    await publish(true);
    expect(await storage.getFormOverrides('meetup')).toBeNull();
    expect(await state(handle)).toBe('open');
    expect((await publish('yes')).status).toBe(422);
  });

  it('rejects schedules that make no sense', async () => {
    config = {};
    const handle = makeHandler();
    for (const bad of [
      { closesAt: 'tomorrow' },
      { opensAt: '2026-11-01', closesAt: '2026-10-31' },
      { maxResponses: 0 },
      { maxResponses: 2.5 },
      { uniqueBy: 'device' },
      'soon',
    ]) {
      expect((await handle(put(bad))).status).toBe(422);
    }
    expect((await handle(put({}, { origin: 'https://evil.example' }))).status).toBe(403);
    expect(await storage.getFormOverrides('meetup')).toBeNull();
  });
});

describe('embedding', () => {
  const BLOG = 'https://blog.example';

  function embedHandler(origins: string[]) {
    return createOpenFormHandler({
      registry: {
        list: async () => ['meetup'],
        load: async (id) => (id === 'meetup' ? definition() : null),
      },
      storage,
      secret: SECRET,
      config: {
        protection: { minimumCompletionTime: false, rateLimit: false },
        embed: { origins },
      },
      adminAuth: { authorize: () => true },
    });
  }

  it('answers CORS only for listed sites and only on the public form routes', async () => {
    const handle = embedHandler([BLOG]);
    const preflight = await handle(
      new Request(`${ORIGIN}/api/forms/meetup/submissions`, {
        method: 'OPTIONS',
        headers: { origin: BLOG, 'access-control-request-method': 'POST' },
      }),
    );
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-origin')).toBe(BLOG);
    expect(preflight.headers.get('access-control-allow-headers')).toContain('x-open-form-visitor');
    expect(preflight.headers.get('access-control-allow-credentials')).toBeNull();

    const other = await handle(
      new Request(`${ORIGIN}/api/forms/meetup/submissions`, {
        method: 'OPTIONS',
        headers: { origin: 'https://evil.example' },
      }),
    );
    expect(other.headers.get('access-control-allow-origin')).toBeNull();

    const admin = await handle(new Request(`${ORIGIN}/api/forms`, { headers: { origin: BLOG } }));
    expect(admin.headers.get('access-control-allow-origin')).toBeNull();
    const adminPreflight = await handle(
      new Request(`${ORIGIN}/api/forms`, { method: 'OPTIONS', headers: { origin: BLOG } }),
    );
    expect(adminPreflight.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('accepts submissions from listed sites', async () => {
    const handle = embedHandler([BLOG]);
    const cross = { origin: BLOG, 'sec-fetch-site': 'cross-site' };
    const ok = await handle(post(alex, {}, cross));
    expect(ok.status).toBe(201);
    expect(ok.headers.get('access-control-allow-origin')).toBe(BLOG);
    const evil = await handle(post(alex, {}, { origin: 'https://evil.example' }));
    expect(evil.status).toBe(403);
    const any = await embedHandler(['*'])(post({ ...alex, email: 'z@x.co' }, {}, cross));
    expect(any.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('keeps one response per device with the page-held id where cookies are blocked', async () => {
    config = { submissions: { uniqueBy: 'device' } };
    const handle = makeHandler();
    const visitor = 'v-0123456789abcdef';
    expect((await handle(post(alex, { visitor }))).status).toBe(201);
    expect((await handle(post({ ...alex, email: 'b@x.co' }, { visitor }))).status).toBe(409);
    const info = await handle(
      new Request(`${ORIGIN}/api/forms/meetup`, { headers: { 'x-open-form-visitor': visitor } }),
    );
    expect(((await info.json()) as { availability: { state: string } }).availability.state).toBe(
      'duplicate',
    );
  });

  it('rejects embed entries that are not origins', () => {
    expect(() => embedHandler(['https://blog.example/path'])).toThrow(/not an origin/);
  });
});

describe('Studio sign-in', () => {
  const PASSWORD = 'correct horse battery staple';

  function passwordHandler(password = PASSWORD) {
    return createOpenFormHandler({
      registry: { list: async () => [], load: async () => null },
      storage,
      secret: SECRET,
      now: () => now,
      clientAddress: () => '203.0.113.7',
      adminAuth: { password, sessionMaxAge: '1h' },
    });
  }

  const signIn = (handle: OpenFormHandler, password: unknown, headers: HeadersInit = {}) =>
    handle(
      new Request(`${ORIGIN}/api/studio/session`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers },
        body: JSON.stringify({ password }),
      }),
    );
  const forms = (handle: OpenFormHandler, cookie?: string) =>
    handle(new Request(`${ORIGIN}/api/forms`, { headers: cookie ? { cookie } : {} }));
  const session = async (handle: OpenFormHandler, cookie?: string) =>
    (await (
      await handle(
        new Request(`${ORIGIN}/api/studio/session`, { headers: cookie ? { cookie } : {} }),
      )
    ).json()) as { signedIn: boolean; canSignOut: boolean; signIn: string | null };

  it('trades the password for a session cookie', async () => {
    const handle = passwordHandler();
    expect(await session(handle)).toMatchObject({ signedIn: false, signIn: 'password' });
    expect((await forms(handle)).status).toBe(401);

    expect((await signIn(handle, 'wrong horse battery staple')).status).toBe(401);
    const ok = await signIn(handle, PASSWORD);
    expect(ok.status).toBe(200);
    const setCookie = ok.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(
      /^of_session=\d+\.[\w-]+; Path=\/; Max-Age=3600; HttpOnly; SameSite=Strict$/,
    );
    const cookie = setCookie.split(';')[0] as string;

    expect((await forms(handle, cookie)).status).toBe(200);
    expect(await session(handle, cookie)).toMatchObject({ signedIn: true, canSignOut: true });
    expect((await forms(handle, `${cookie.slice(0, -2)}xx`)).status).toBe(401);

    now += 61 * 60_000;
    expect((await forms(handle, cookie)).status).toBe(401);
  });

  it('ends old sessions when the password changes', async () => {
    const cookie = (await signIn(passwordHandler(), PASSWORD)).headers
      .get('set-cookie')
      ?.split(';')[0];
    expect((await forms(passwordHandler('another horse battery staple'), cookie)).status).toBe(401);
  });

  it('signs out and marks cookies Secure over HTTPS', async () => {
    const handle = passwordHandler();
    const res = await handle(
      new Request('https://forms.example/api/studio/session', {
        method: 'DELETE',
        headers: { origin: 'https://forms.example' },
      }),
    );
    expect(res.headers.get('set-cookie')).toBe(
      'of_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict; Secure',
    );
  });

  it('revokes the session on sign-out, so a copied cookie stops working too', async () => {
    const handle = passwordHandler();
    const cookie = (await signIn(handle, PASSWORD)).headers.get('set-cookie')?.split(';')[0];
    now += 1000;
    const otherCookie = (await signIn(handle, PASSWORD)).headers.get('set-cookie')?.split(';')[0];
    const signOut = (headers: HeadersInit) =>
      handle(
        new Request(`${ORIGIN}/api/studio/session`, {
          method: 'DELETE',
          headers: { origin: ORIGIN, ...headers },
        }),
      );

    expect((await signOut({ cookie: `${cookie?.slice(0, -2)}xx` })).status).toBe(200);
    expect((await forms(handle, cookie)).status).toBe(200);

    expect((await signOut({ cookie: cookie as string })).status).toBe(200);
    expect((await forms(handle, cookie)).status).toBe(401);
    expect(await session(handle, cookie)).toMatchObject({ signedIn: false });
    expect((await forms(handle, otherCookie)).status).toBe(200);
    expect((await forms(passwordHandler(), cookie)).status).toBe(401);
  });

  it('limits sign-in attempts and blocks cross-site ones', async () => {
    const handle = passwordHandler();
    expect((await signIn(handle, PASSWORD, { origin: 'https://evil.example' })).status).toBe(403);
    for (let i = 0; i < 10; i++) await signIn(handle, `guess-${i}-0123456789abcdef`);
    expect((await signIn(handle, PASSWORD)).status).toBe(429);
  });

  it('counts sign-in attempts from one IPv6 /64 together', async () => {
    let ip = '';
    const handle = createOpenFormHandler({
      registry: { list: async () => [], load: async () => null },
      storage,
      secret: SECRET,
      now: () => now,
      clientAddress: () => ip,
      adminAuth: { password: PASSWORD },
    });
    for (let i = 0; i < 10; i++) {
      ip = `2001:db8:1:2::${i + 1}`;
      await signIn(handle, `guess-${i}-0123456789abcdef`);
    }
    ip = '2001:db8:1:2:ffff::1';
    expect((await signIn(handle, PASSWORD)).status).toBe(429);
    ip = '2001:db8:1:3::1';
    expect((await signIn(handle, PASSWORD)).status).toBe(200);
  });

  it('marks the session cookie Secure for https pages behind a proxy that ends TLS', async () => {
    const res = await passwordHandler()(
      new Request('http://forms.example/api/studio/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'https://forms.example' },
        body: JSON.stringify({ password: PASSWORD }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toMatch(/; Secure$/);
  });

  it('warns once when the password crosses the network over plain HTTP', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const handle = passwordHandler();
    const plain = () =>
      handle(
        new Request('http://forms.example/api/studio/session', {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: 'http://forms.example' },
          body: JSON.stringify({ password: PASSWORD }),
        }),
      );
    expect((await signIn(handle, PASSWORD)).status).toBe(200);
    expect(warn).not.toHaveBeenCalled();
    await plain();
    await plain();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]?.[0])).toMatch(/forms\.example over plain HTTP/);
    warn.mockRestore();
  });

  it('rejects short passwords', () => {
    expect(() => passwordHandler('short')).toThrow(/at least 16/);
  });

  it('rejects long passwords that repeat themselves', () => {
    for (const weak of [
      'aaaaaaaaaaaaaaaa',
      'passwordpassword',
      'abcabcabcabcabcabc',
      'Summer2026!Summer2026!',
    ]) {
      expect(() => passwordHandler(weak), weak).toThrow(/repeats itself/);
    }
    expect(() => passwordHandler('correct horse battery staple')).not.toThrow();
  });
});

describe('toCsv', () => {
  it('neutralizes formulas in lists as well as text', () => {
    const csv = toCsv(
      [{ key: 'tags', header: 'Tags' }],
      [
        {
          id: 'a',
          formId: 'f',
          number: 1,
          formVersionId: 'v',
          visitorHash: null,
          createdAt: 'now',
          data: { tags: ['=1+1', 'b'] },
        },
      ],
    );
    expect(csv).toContain(',"\'=1+1; b"\r\n');
  });

  it('keeps international phone numbers as stored, but not formulas starting with +', () => {
    const csv = toCsv(
      [
        { key: 'phone', header: 'Phone' },
        { key: 'sum', header: 'Sum' },
      ],
      [
        {
          id: 'a',
          formId: 'f',
          number: 1,
          formVersionId: 'v',
          visitorHash: null,
          createdAt: 'now',
          data: { phone: '+886912345678', sum: '+1+cmd' },
        },
      ],
    );
    expect(csv).toContain(",+886912345678,'+1+cmd\r\n");
  });

  it('quotes cells that a semicolon-separated Excel would split', () => {
    const csv = toCsv(
      [{ key: 'note', header: 'Note' }],
      [
        {
          id: 'a',
          formId: 'f',
          number: 1,
          formVersionId: 'v',
          visitorHash: null,
          createdAt: 'now',
          data: { note: 'x;=HYPERLINK("https://evil.example")' },
        },
      ],
    );
    expect(csv).toContain(',"x;=HYPERLINK(""https://evil.example"")"\r\n');
  });

  it('writes times in the given time zone, booleans as Yes or No and languages by name', () => {
    const csv = toCsv(
      [{ key: 'agree', header: 'Agree' }],
      [
        {
          id: 'a',
          formId: 'f',
          number: 1,
          formVersionId: 'v',
          visitorHash: null,
          createdAt: '2026-10-13T00:48:08.256Z',
          locale: 'zh-TW',
          data: { agree: true },
        },
      ],
      { language: true, timeZone: 'Asia/Taipei' },
    );
    expect(csv).toBe(
      '\ufeff#,Submitted at (Asia/Taipei),Language,Agree\r\n1,2026-10-13 08:48:08,繁體中文,Yes\r\n',
    );
  });
});

describe('createSigner', () => {
  it('rejects short secrets', () => {
    expect(() => createSigner('short')).toThrow(/at least 16/);
  });
});

describe('turnstile', () => {
  const SITE_KEY = '0x4AAAAAAAtest';
  const verifyCalls: URLSearchParams[] = [];

  function turnstileHandler(opts: {
    secret?: string;
    answer?: () => Response | Promise<Response>;
  }) {
    verifyCalls.length = 0;
    return createOpenFormHandler({
      registry: {
        list: async () => ['meetup'],
        load: async (id) => (id === 'meetup' ? definition() : null),
      },
      storage,
      secret: SECRET,
      config: {
        protection: {
          minimumCompletionTime: false,
          rateLimit: false,
          turnstile: { siteKey: SITE_KEY },
        },
      },
      now: () => now,
      clientAddress: () => address,
      turnstileSecret: opts.secret,
      fetch: (async (_url: string, init?: RequestInit) => {
        verifyCalls.push(new URLSearchParams(init?.body as URLSearchParams));
        return (opts.answer ?? (() => Response.json({ success: true })))();
      }) as typeof fetch,
    });
  }

  it('hands the site key to the form page', async () => {
    const handle = turnstileHandler({ secret: 'turnstile-secret' });
    const res = await handle(new Request(`${ORIGIN}/api/forms/meetup`));
    expect(((await res.json()) as { turnstile?: unknown }).turnstile).toEqual({
      siteKey: SITE_KEY,
    });
  });

  it('stores a response only with a token Cloudflare accepts', async () => {
    const handle = turnstileHandler({ secret: 'turnstile-secret' });
    const res = await handle(post(alex, { turnstile: 'token-1' }));
    expect(res.status).toBe(201);
    expect(verifyCalls[0]?.get('secret')).toBe('turnstile-secret');
    expect(verifyCalls[0]?.get('response')).toBe('token-1');
    expect(verifyCalls[0]?.get('remoteip')).toBe(address);
  });

  it('refuses a missing or rejected token, without storing', async () => {
    const handle = turnstileHandler({
      secret: 'turnstile-secret',
      answer: () => Response.json({ success: false, 'error-codes': ['invalid-input-response'] }),
    });
    const missing = await handle(post(alex));
    expect(missing.status).toBe(400);
    expect(((await missing.json()) as { error: string }).error).toBe('human_check');
    expect(verifyCalls).toHaveLength(0);
    expect((await handle(post(alex, { turnstile: 'forged' }))).status).toBe(400);
    expect(await storage.countSubmissions('meetup')).toBe(0);
  });

  it('checks the answers first, so fixing a mistake keeps the token', async () => {
    const handle = turnstileHandler({ secret: 'turnstile-secret' });
    expect((await handle(post({ ...alex, email: 'nope' }, { turnstile: 't' }))).status).toBe(422);
    expect(verifyCalls).toHaveLength(0);
  });

  it('fails closed without a secret or when Cloudflare is unreachable', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const unset = turnstileHandler({});
      expect((await unset(post(alex, { turnstile: 't' }))).status).toBe(503);
      const down = turnstileHandler({
        secret: 'turnstile-secret',
        answer: () => {
          throw new TypeError('fetch failed');
        },
      });
      expect((await down(post(alex, { turnstile: 't' }))).status).toBe(503);
      expect(await storage.countSubmissions('meetup')).toBe(0);
    } finally {
      error.mockRestore();
      warn.mockRestore();
    }
  });
});
