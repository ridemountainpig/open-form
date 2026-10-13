import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type FormSchema, schemaVersion, type WebhookConfig } from '../schema/index.ts';
import { createMemoryStorage } from '../storage/index.ts';
import { createOpenFormHandler } from './handler.ts';
import { createWebhookSender, signWebhook, type WebhookEvent } from './webhooks.ts';

const ORIGIN = 'http://localhost:3000';
const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw';
const KEY = Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw', 'base64');

const schema: FormSchema = {
  id: 'rsvp',
  title: 'RSVP',
  pages: [{ index: 0, when: [] }],
  fields: [{ name: 'email', type: 'email', page: 0, when: [], required: true }],
};

type Call = { url: string; init: RequestInit };

function recorder(statuses: number[] = []) {
  const calls: Call[] = [];
  const fetchMock = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(null, { status: statuses.shift() ?? 200 });
  }) as unknown as typeof fetch;
  return { calls, fetch: fetchMock };
}

function handlerWith(webhooks: WebhookConfig[], fetchMock: typeof fetch) {
  const pending: Promise<unknown>[] = [];
  const handle = createOpenFormHandler({
    registry: {
      list: async () => ['rsvp'],
      load: async (id) =>
        id === 'rsvp'
          ? { id, schema, version: schemaVersion(schema), config: {}, validators: new Map() }
          : null,
    },
    storage: createMemoryStorage(),
    secret: 'test-secret-0123456789abcdef',
    config: { webhooks, protection: { minimumCompletionTime: false, rateLimit: false } },
    webhookSecret: SECRET,
    fetch: fetchMock,
    waitUntil: (promise) => pending.push(promise),
  });
  const submit = (email: string) =>
    handle(
      new Request(`${ORIGIN}/api/forms/rsvp/submissions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({ data: { email } }),
      }),
    );
  return { submit, settled: () => Promise.all(pending) };
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warn.mockRestore();
});

describe('webhook secrets', () => {
  it('refuses a secret that is not base64 at startup instead of failing every delivery', () => {
    expect(() => createWebhookSender({ secret: 'whsec_not base64!' })).toThrow(/must be base64/);
    expect(() => createWebhookSender({ secret: 'test-secret-0123456789abcdef' })).toThrow(
      /must be base64/,
    );
  });

  it('reads the key without the prefix the same way', async () => {
    const bare = SECRET.slice('whsec_'.length);
    expect(await signWebhook(bare, 'msg_1', 1, '{}')).toBe(
      await signWebhook(SECRET, 'msg_1', 1, '{}'),
    );
  });
});

describe('webhooks', () => {
  it('posts a signed Standard Webhooks event for each response', async () => {
    const { calls, fetch } = recorder();
    const { submit, settled } = handlerWith([{ url: 'https://hooks.example/in' }], fetch);
    expect((await submit('amy@example.com')).status).toBe(201);
    await settled();

    expect(calls).toHaveLength(1);
    const { url, init } = calls[0] as Call;
    expect(url).toBe('https://hooks.example/in');
    const headers = init.headers as Record<string, string>;
    const body = init.body as string;
    const event = JSON.parse(body) as WebhookEvent;
    expect(event.type).toBe('submission.created');
    expect(event.data.form).toEqual({ id: 'rsvp', title: 'RSVP' });
    expect(event.data.submission).toMatchObject({ number: 1, data: { email: 'amy@example.com' } });

    const expected = createHmac('sha256', KEY)
      .update(`${headers['webhook-id']}.${headers['webhook-timestamp']}.${body}`)
      .digest('base64');
    expect(headers['webhook-signature']).toBe(`v1,${expected}`);
    expect(headers['webhook-id']).toMatch(/^msg_/);
  });

  it('only notifies the forms a webhook lists', async () => {
    const { calls, fetch } = recorder();
    const { submit, settled } = handlerWith(
      [
        { url: 'https://a.example', forms: ['other'] },
        { url: 'https://b.example', forms: ['rsvp'] },
      ],
      fetch,
    );
    await submit('amy@example.com');
    await settled();
    expect(calls.map((c) => c.url)).toEqual(['https://b.example']);
  });

  it('retries failures with the same id and logs no personal data', async () => {
    const { calls, fetch } = recorder([500, 200]);
    const sender = createWebhookSender({
      webhooks: [{ url: 'https://hooks.example/secret-path' }],
      secret: SECRET,
      fetch,
      retryDelays: [0, 0.01, 0.01, 0.01, 0.01],
    });
    await sender.send('rsvp', {
      type: 'submission.created',
      timestamp: 'now',
      data: {
        form: { id: 'rsvp' },
        submission: { id: 's', number: 1, createdAt: 'now', data: { email: 'amy@example.com' } },
      },
    });
    expect(calls).toHaveLength(2);
    const ids = calls.map((c) => (c.init.headers as Record<string, string>)['webhook-id']);
    expect(ids[0]).toBe(ids[1]);
    const logged = warn.mock.calls.flat().join(' ');
    expect(logged).toContain(
      'https://hooks.example failed (attempt 1/5): HTTP 500; retrying in 0.01s',
    );
    expect(logged).not.toContain('secret-path');
    expect(logged).not.toContain('amy@example.com');
  });

  it('stops when the receiver answers 410 Gone', async () => {
    const { calls, fetch } = recorder([410]);
    const sender = createWebhookSender({ webhooks: [{ url: 'https://hooks.example' }], fetch });
    await sender.send('rsvp', {} as WebhookEvent);
    expect(calls).toHaveLength(1);
  });

  it('rejects URLs it cannot post to', () => {
    expect(() => createWebhookSender({ webhooks: [{ url: 'ftp://x' }] })).toThrow(/https:\/\//);
    expect(() => createWebhookSender({ webhooks: [{ url: 'http://hooks.example' }] })).toThrow(
      /http:\/\/ only for localhost/,
    );
    expect(() =>
      createWebhookSender({ webhooks: [{ url: 'http://127.0.0.1:3999/hook' }] }),
    ).not.toThrow();
  });
});
