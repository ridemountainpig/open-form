import type { WebhookConfig } from '../schema/index.ts';
import type { StoredSubmission } from '../storage/index.ts';

// Deliveries follow Standard Webhooks (https://www.standardwebhooks.com), so
// receivers can verify them with an off-the-shelf library.

export type WebhookEvent = {
  type: 'submission.created';
  timestamp: string;
  data: {
    form: { id: string; title?: string };
    submission: Pick<StoredSubmission, 'id' | 'number' | 'createdAt' | 'locale' | 'data'>;
  };
};

/** Seconds before each attempt: right away, then backing off for about 13 minutes. */
export const WEBHOOK_RETRY_DELAYS = [0, 5, 30, 120, 600];
const TIMEOUT_MS = 10_000;

const encoder = new TextEncoder();

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/** The HMAC key, read as Standard Webhooks libraries read it: base64, `whsec_` optional. */
function keyBytes(secret: string): Uint8Array {
  let binary = '';
  try {
    binary = atob(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret);
  } catch {}
  if (!binary) {
    throw new Error(
      'OPEN_FORM_WEBHOOK_SECRET must be base64 after the whsec_ prefix, e.g. whsec_ and 32 random bytes in base64.',
    );
  }
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export async function signWebhook(
  secret: string,
  id: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes(secret) as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${id}.${timestamp}.${body}`),
  );
  return `v1,${toBase64(new Uint8Array(signature))}`;
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

export function webhookProblems(webhooks: readonly WebhookConfig[] = []): string[] {
  const problems: string[] = [];
  for (const [index, hook] of webhooks.entries()) {
    let url: URL | null = null;
    try {
      url = new URL(hook.url);
    } catch {}
    const local =
      url !== null && (LOOPBACK_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost'));
    // Deliveries carry respondents' answers: plain HTTP only to this machine.
    if (!url || !(url.protocol === 'https:' || (url.protocol === 'http:' && local))) {
      problems.push(
        `webhooks[${index}].url must be an https:// URL (http:// only for localhost): it carries respondents' answers.`,
      );
    }
  }
  return problems;
}

export type WebhookSender = {
  targets(formId: string): WebhookConfig[];
  /** Settles once every delivery has succeeded or given up; never rejects. */
  send(formId: string, event: WebhookEvent): Promise<void>;
};

export function createWebhookSender(opts: {
  webhooks?: readonly WebhookConfig[];
  secret?: string;
  fetch?: typeof fetch;
  retryDelays?: readonly number[];
}): WebhookSender {
  const webhooks = opts.webhooks ?? [];
  const problems = webhookProblems(webhooks);
  if (problems.length) throw new Error(`Invalid webhooks:\n  - ${problems.join('\n  - ')}`);
  // A bad secret would otherwise fail every delivery, silently, after the response.
  if (opts.secret) keyBytes(opts.secret);
  const send = opts.fetch ?? fetch;
  const delays = opts.retryDelays ?? WEBHOOK_RETRY_DELAYS;
  const targets = (formId: string) =>
    webhooks.filter((hook) => !hook.forms || hook.forms.includes(formId));

  async function deliver(hook: WebhookConfig, event: WebhookEvent): Promise<void> {
    // Only the origin is ever logged: the path may be a secret, the body is personal data.
    const where = new URL(hook.url).origin;
    const id = `msg_${crypto.randomUUID()}`;
    const body = JSON.stringify(event);
    for (const [attempt, delay] of delays.entries()) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay * 1000));
      const timestamp = Math.floor(Date.now() / 1000);
      const headers: Record<string, string> = {
        'content-type': 'application/json',
        'webhook-id': id,
        'webhook-timestamp': String(timestamp),
      };
      if (opts.secret)
        headers['webhook-signature'] = await signWebhook(opts.secret, id, timestamp, body);
      let outcome: string;
      try {
        const res = await send(hook.url, {
          method: 'POST',
          headers,
          body,
          redirect: 'manual',
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (res.ok) return;
        // 410: the receiver asks never to be called again.
        if (res.status === 410) {
          console.warn(`[open-form] Webhook ${where} answered 410 Gone; not retrying.`);
          return;
        }
        outcome = `HTTP ${res.status}`;
      } catch (err) {
        outcome = err instanceof Error && err.name === 'TimeoutError' ? 'timed out' : 'unreachable';
      }
      const next = delays[attempt + 1];
      console.warn(
        `[open-form] Webhook ${where} failed (attempt ${attempt + 1}/${delays.length}): ${outcome}${
          next === undefined ? '; giving up.' : `; retrying in ${next}s.`
        }`,
      );
    }
  }

  return {
    targets,
    async send(formId, event) {
      await Promise.all(targets(formId).map((hook) => deliver(hook, event).catch(() => {})));
    },
  };
}
