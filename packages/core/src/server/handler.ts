import {
  applyOverrides,
  type CustomValidator,
  type FormConfig,
  type FormSchema,
  type FormValues,
  formLocales,
  formTimeZone,
  getMessages,
  isPublished,
  type Locale,
  type Messages,
  type OpenFormConfig,
  overriddenTimeZone,
  parseResponseFilter,
  parseResponseSort,
  type ResponseFilter,
  type ResponseSort,
  resolveProtection,
  scheduleEdit,
  scheduleOf,
  submissionWindow,
  translationCoverage,
  validateSubmission,
  type WindowStatus,
} from '../schema/index.ts';
import type { CreateSubmissionResult, StorageAdapter, StoredOverrides } from '../storage/index.ts';
import { isLoopbackHost, rateLimitSubject } from './address.ts';
import { type AdminAuth, createAdminGate, sentOverHttps } from './admin.ts';
import { checkTimingToken, createSigner, issueTimingToken, type Signer } from './crypto.ts';
import { responseColumns } from './export.ts';
import { EXPORT_CONTENT_TYPES, exportFormResponses, schemaHistory } from './form-export.ts';
import { createWebhookSender } from './webhooks.ts';

export type FormDefinition = {
  id: string;
  schema: FormSchema;
  /** Fingerprint of `schema`; a new version is recorded whenever it changes. */
  version: string;
  config: FormConfig;
  validators: ReadonlyMap<string, CustomValidator>;
  /** Every string respondents see, for translation coverage. Optional. */
  texts?: readonly string[];
};

export type FormRegistry = {
  list(): Promise<string[]>;
  /** Resolves `null` for unknown ids; throws when the form exists but is broken. */
  load(id: string): Promise<FormDefinition | null>;
  /** When the form's source last changed (ISO), for sorting in Studio. Optional. */
  updatedAt?(id: string): Promise<string | undefined>;
  /** Studio's folder manifest (`forms/.folders.json`). Optional. */
  folders?(): Promise<unknown>;
};

export type OpenFormHandlerOptions = {
  registry: FormRegistry;
  storage: StorageAdapter;
  /** Signs timing tokens and hashes visitor ids / IPs. Keep it stable and private. */
  secret: string;
  config?: OpenFormConfig;
  /** Path prefix the handler is mounted under. Default `/api`. */
  basePath?: string;
  /** Who may use Studio's endpoints (responses, export, delete). Without it they answer 404. */
  adminAuth?: AdminAuth;
  clientAddress?: (request: Request) => string | undefined;
  secureCookies?: boolean;
  /** Signs webhook deliveries (`config.webhooks`). Usually `OPEN_FORM_WEBHOOK_SECRET`. */
  webhookSecret?: string;
  /**
   * Keeps webhook deliveries alive after the response on platforms that stop
   * work once it's sent (Vercel's `waitUntil`, Next.js `after`, Workers' `ctx.waitUntil`).
   */
  waitUntil?: (promise: Promise<unknown>) => void;
  /** Used for webhook deliveries. Default: the global `fetch`. */
  fetch?: typeof fetch;
  /** Include error details in 500 responses (dev). */
  exposeErrors?: boolean;
  maxBodyBytes?: number;
  now?: () => number;
};

export type OpenFormHandler = (request: Request) => Promise<Response>;

export const FORM_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const VISITOR_COOKIE = 'of_vid';
const DEFAULT_MAX_BODY = 256 * 1024;
const SIGN_IN_MAX = 10;
const SIGN_IN_WINDOW_MS = 10 * 60_000;
const MAX_BULK_DELETE = 500;

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...headers,
    },
  });
}

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    throw new HttpError(404, 'not_found', 'Not found.');
  }
}

function withoutMessage(err: unknown): string {
  if (!(err instanceof Error)) return typeof err;
  const frames = err.stack?.split('\n').filter((line) => /^\s+at /.test(line)) ?? [];
  return [err.name, ...frames].join('\n');
}

function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get('cookie');
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key !== name) continue;
    try {
      return decodeURIComponent(rest.join('='));
    } catch {
      return undefined;
    }
  }
  return undefined;
}

/** Same origin, or a site `embed.origins` lets in (only for the public form routes). */
function assertSameOrigin(request: Request, embedOrigins: readonly string[] = []): void {
  const origin = request.headers.get('origin');
  if (origin && (embedOrigins.includes('*') || embedOrigins.includes(origin))) return;
  const site = request.headers.get('sec-fetch-site');
  if (site === 'cross-site') throw new HttpError(403, 'forbidden', 'Cross-site request blocked.');
  if (!origin) return;
  const target = new URL(request.url);
  // A proxy that ends TLS without a trusted X-Forwarded-Proto hands us http for
  // an https page. Only that way round: an http page must not act on https.
  const behindTlsProxy = target.protocol === 'http:' && origin === `https://${target.host}`;
  if (origin === 'null' || (origin !== target.origin && !behindTlsProxy)) {
    throw new HttpError(403, 'forbidden', 'Origin mismatch.');
  }
}

/** A non-negative whole number from the query string, or `fallback` when it's absent. */
function countParam(url: URL, name: string, fallback: number): number {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === '') return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value)) {
    throw new HttpError(400, 'bad_request', `${name} must be a whole number.`);
  }
  return value;
}

/** Studio's `?filter=` rules, as JSON; absent means no filter. */
function filterParam(url: URL): ResponseFilter | undefined {
  const raw = url.searchParams.get('filter');
  if (raw === null || raw === '') return undefined;
  try {
    return parseResponseFilter(JSON.parse(raw));
  } catch (err) {
    const reason = err instanceof SyntaxError ? 'it must be JSON' : (err as Error).message;
    throw new HttpError(400, 'bad_request', `Invalid filter: ${reason}.`);
  }
}

/** Studio's `?sort=` column, as JSON; absent means newest first. */
function sortParam(url: URL): ResponseSort | undefined {
  const raw = url.searchParams.get('sort');
  if (raw === null || raw === '') return undefined;
  try {
    return parseResponseSort(JSON.parse(raw));
  } catch (err) {
    const reason = err instanceof SyntaxError ? 'it must be JSON' : (err as Error).message;
    throw new HttpError(400, 'bad_request', `Invalid sort: ${reason}.`);
  }
}

export function embedOriginProblems(origins: readonly string[] = []): string[] {
  return origins.flatMap((origin) => {
    if (origin === '*') return [];
    try {
      const url = new URL(origin);
      if ((url.protocol === 'https:' || url.protocol === 'http:') && url.origin === origin) {
        return [];
      }
    } catch {}
    return [
      `embed.origins: "${origin}" is not an origin. Use scheme and host only, e.g. "https://example.com", or "*".`,
    ];
  });
}

const VISITOR_HEADER = 'x-open-form-visitor';
const VISITOR_RE = /^[\w-]{16,64}$/;

async function readJson(request: Request, maxBytes: number): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Content-Type must be application/json.');
  }
  const tooLarge = () => new HttpError(413, 'too_large', 'Request body is too large.');
  if (Number(request.headers.get('content-length') ?? 0) > maxBytes) throw tooLarge();
  // Count while reading: a chunked body has no content-length to check up front.
  let text = '';
  let size = 0;
  const decoder = new TextDecoder();
  const reader = request.body?.getReader();
  while (reader) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) throw tooLarge();
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try {
    const body = JSON.parse(text) as unknown;
    if (typeof body !== 'object' || body === null || Array.isArray(body)) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'bad_request', 'Request body must be a JSON object.');
  }
}

function statusOf(
  window: WindowStatus,
  responses: number,
  max: number | undefined,
  published: boolean,
) {
  if (!published) return 'unpublished';
  return window === 'open' && max !== undefined && responses >= max ? 'full' : window;
}

function normalizeUniqueValue(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (Array.isArray(value)) return value.map(String).sort().join('|').toLowerCase();
  return String(value).trim().toLowerCase();
}

type Route = {
  method: string;
  pattern: RegExp;
  admin: boolean;
  /** Public form route other sites may call (`embed.origins`). */
  cors?: boolean;
  handle: (ctx: RouteContext, params: string[]) => Promise<Response>;
};

type RouteContext = {
  request: Request;
  url: URL;
  now: number;
};

type Outcome =
  | { ok: true; submission: { id: string; number: number } }
  | Extract<CreateSubmissionResult, { ok: false }>;

export function createOpenFormHandler(opts: OpenFormHandlerOptions): OpenFormHandler {
  const basePath = (opts.basePath ?? '/api').replace(/\/$/, '');
  const signer: Signer = createSigner(opts.secret);
  const storage = opts.storage;
  const maxBody = opts.maxBodyBytes ?? DEFAULT_MAX_BODY;
  const clock = opts.now ?? Date.now;
  const decoyNumbers = new Map<string, number>();
  const webhooks = createWebhookSender({
    webhooks: opts.config?.webhooks,
    secret: opts.webhookSecret,
    fetch: opts.fetch,
  });
  if (opts.config?.webhooks?.length && !opts.webhookSecret) {
    console.warn(
      '[open-form] Webhooks are sent unsigned. Set OPEN_FORM_WEBHOOK_SECRET so receivers can verify them.',
    );
  }
  const embedOrigins = opts.config?.embed?.origins ?? [];
  const embedProblems = embedOriginProblems(embedOrigins);
  if (embedProblems.length) throw new Error(embedProblems.join('\n'));
  // CORS only for sites in `embed.origins`, only on the public form routes, never with credentials.
  const corsHeaders = (request: Request): Record<string, string> | null => {
    const origin = request.headers.get('origin');
    if (!origin) return null;
    if (embedOrigins.includes('*')) return { 'access-control-allow-origin': '*' };
    if (embedOrigins.includes(origin)) {
      return { 'access-control-allow-origin': origin, vary: 'Origin' };
    }
    return null;
  };
  const gate = opts.adminAuth
    ? createAdminGate(opts.adminAuth, signer, {
        revocations: storage,
        secureCookies: opts.secureCookies,
        now: clock,
      })
    : null;

  /** The respondent's language if the form offers it, else the form's own. */
  const localeFor = (def: FormDefinition, requested?: unknown): Locale => {
    const available = formLocales(def.config, opts.config?.locale);
    return available.includes(requested as Locale)
      ? (requested as Locale)
      : (available[0] as Locale);
  };
  const messagesFor = (def: FormDefinition, requested?: unknown): Messages =>
    getMessages(localeFor(def, requested));
  const codeTimeZone = (def: FormDefinition) => formTimeZone(def.config, opts.config?.timeZone);
  const timeZoneOf = (def: FormDefinition, overrides: StoredOverrides | null | undefined) =>
    overriddenTimeZone(def.config, overrides, opts.config?.timeZone);
  /** The form's policy with Studio's overrides applied. */
  const policyOf = (def: FormDefinition, overrides: StoredOverrides | null | undefined) =>
    applyOverrides(def.config.submissions, overrides?.submissions);
  const windowOf = (
    def: FormDefinition,
    overrides: StoredOverrides | null | undefined,
    now: number,
  ) => submissionWindow(policyOf(def, overrides), { now, timeZone: timeZoneOf(def, overrides) });

  async function loadForm(id: string): Promise<FormDefinition> {
    if (!FORM_ID_RE.test(id)) throw new HttpError(404, 'not_found', 'Form not found.');
    const def = await opts.registry.load(id);
    if (!def) throw new HttpError(404, 'not_found', 'Form not found.');
    return def;
  }

  /** A form respondents may reach: unpublished ones answer like ones that don't exist. */
  async function loadPublicForm(id: string) {
    const def = await loadForm(id);
    const overrides = await storage.getFormOverrides(def.id);
    if (!isPublished(def.config, overrides)) {
      throw new HttpError(404, 'not_found', 'Form not found.');
    }
    return { def, overrides };
  }

  // Not cached: deleting a form erases its versions, from Studio or from
  // `open-form delete` in another process, and a stale id would fail every insert.
  async function versionId(def: FormDefinition): Promise<string> {
    return (await storage.ensureFormVersion(def.id, def.version, def.schema)).id;
  }

  /**
   * What storing would answer, without storing: for bots caught by the honeypot.
   * Never a duplicate: that would tell, without a trace, whether a value has already responded.
   */
  async function decoy(formId: string, maxResponses: number | undefined): Promise<Outcome> {
    if (maxResponses !== undefined && (await storage.countSubmissions(formId)) >= maxResponses) {
      return { ok: false, reason: 'full' };
    }
    const [latest] = (await storage.listSubmissions(formId, { limit: 1 })).items;
    const number = Math.max(latest?.number ?? 0, decoyNumbers.get(formId) ?? 0) + 1;
    decoyNumbers.set(formId, number);
    return { ok: true, submission: { id: crypto.randomUUID(), number } };
  }

  // The device cookie, else an id the page keeps in localStorage: third-party
  // iframes (embeds) can't keep cookies. Neither is identity — both are the
  // browser's to forget.
  const deviceId = (request: Request, claimed?: unknown): string | undefined => {
    const cookie = readCookie(request, VISITOR_COOKIE);
    if (cookie && VISITOR_RE.test(cookie)) return cookie;
    const sent = typeof claimed === 'string' ? claimed : request.headers.get(VISITOR_HEADER);
    return sent && VISITOR_RE.test(sent) ? sent : undefined;
  };

  async function visitorFor(request: Request, claimed?: unknown) {
    const existing = readCookie(request, VISITOR_COOKIE);
    const id = deviceId(request, claimed) ?? crypto.randomUUID();
    const hash = (await signer.sign(`visitor:${id}`)).slice(0, 32);
    const setCookie =
      existing === id
        ? undefined
        : `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${
            opts.secureCookies || sentOverHttps(request) ? '; Secure' : ''
          }`;
    return { hash, setCookie };
  }

  async function availability(
    def: FormDefinition,
    overrides: StoredOverrides | null,
    request: Request,
    now: number,
  ) {
    const policy = policyOf(def, overrides);
    const messages = messagesFor(def);
    const window = windowOf(def, overrides, now);
    if (window.status === 'closed') {
      return { state: 'closed', message: policy?.closedMessage ?? messages.closedMessage } as const;
    }
    if (window.status === 'not-open') {
      const opensAt = new Date(window.opensAt ?? now).toISOString();
      return { state: 'not-open', opensAt } as const;
    }
    if (policy?.maxResponses !== undefined) {
      if ((await storage.countSubmissions(def.id)) >= policy.maxResponses) {
        return { state: 'full', message: policy.fullMessage ?? messages.fullMessage } as const;
      }
    }
    if (policy?.uniqueBy === 'device') {
      const device = deviceId(request);
      if (device) {
        const hash = (await signer.sign(`visitor:${device}`)).slice(0, 32);
        if (await storage.hasUniqueKey(def.id, `device:${hash}`)) {
          return {
            state: 'duplicate',
            message: policy.duplicateMessage ?? messages.duplicateMessage,
          } as const;
        }
      }
    }
    return { state: 'open' } as const;
  }

  async function getForm({ request, now }: RouteContext, [id]: string[]) {
    const { def, overrides } = await loadPublicForm(id as string);
    const status = await availability(def, overrides, request, now);
    const token = status.state === 'open' ? await issueTimingToken(signer, def.id, now) : undefined;
    return json({ id: def.id, title: def.schema.title, availability: status, token });
  }

  async function submit({ request, now }: RouteContext, [id]: string[]) {
    assertSameOrigin(request, embedOrigins);
    const { def, overrides } = await loadPublicForm(id as string);
    const body = await readJson(request, maxBody);
    const locale = localeFor(def, body.locale);
    const messages = messagesFor(def, locale);
    const policy = policyOf(def, overrides);
    const window = windowOf(def, overrides, now);
    if (window.status !== 'open') {
      throw new HttpError(
        410,
        window.status === 'closed' ? 'closed' : 'not_open',
        policy?.closedMessage ?? messages.closedMessage,
      );
    }

    const protection = resolveProtection(opts.config?.protection, def.config.protection);
    if (protection.minimumCompletionTimeMs > 0) {
      const check = await checkTimingToken(
        signer,
        def.id,
        body.token,
        protection.minimumCompletionTimeMs,
        now,
      );
      if (check === 'too-fast') throw new HttpError(400, 'too_fast', messages.tooFast);
      if (check === 'expired') throw new HttpError(400, 'expired_token', messages.expiredToken);
      if (check !== 'ok') throw new HttpError(400, 'invalid_token', messages.genericError);
    }

    const data = (
      typeof body.data === 'object' && body.data !== null && !Array.isArray(body.data)
        ? body.data
        : {}
    ) as FormValues;
    const result = await validateSubmission(def.schema, data, {
      messages,
      validators: def.validators,
    });
    if (!result.ok) {
      throw new HttpError(422, 'invalid', messages.fixErrors, { errors: result.errors });
    }

    // Counted once the answers are valid, so fixing mistakes doesn't use it up.
    // Duplicates still count: otherwise uniqueBy could be probed without limit.
    if (protection.rateLimit) {
      const address = rateLimitSubject(opts.clientAddress?.(request) ?? 'unknown');
      const key = (await signer.sign(`rate:${def.id}:${address}`)).slice(0, 32);
      const count = await storage.hitRateLimit(key, protection.rateLimit.windowMs, now);
      if (count > protection.rateLimit.max) {
        throw new HttpError(429, 'rate_limited', messages.rateLimited);
      }
    }

    const visitor = await visitorFor(request, body.visitor);
    let uniqueKey: string | null = null;
    if (policy?.uniqueBy === 'device') {
      uniqueKey = `device:${visitor.hash}`;
    } else if (policy?.uniqueBy) {
      const value = normalizeUniqueValue(result.values[policy.uniqueBy]);
      if (value !== null) uniqueKey = `${policy.uniqueBy}:${value}`;
    }

    const headers: HeadersInit = visitor.setCookie ? { 'set-cookie': visitor.setCookie } : {};
    const respond = (outcome: Outcome) => {
      if (outcome.ok) {
        const { id, number } = outcome.submission;
        return json({ id, number }, 201, headers);
      }
      if (outcome.reason === 'full') {
        throw new HttpError(410, 'full', policy?.fullMessage ?? messages.fullMessage);
      }
      return json(
        { error: 'duplicate', message: policy?.duplicateMessage ?? messages.duplicateMessage },
        409,
        headers,
      );
    };

    // Bots that fill the honeypot get the answer a new submission would get
    // (after the same checks), and nothing is stored.
    if (protection.honeypot && typeof body.hp === 'string' && body.hp.trim() !== '') {
      return respond(await decoy(def.id, policy?.maxResponses));
    }

    const created = await storage.createSubmission(
      {
        formId: def.id,
        formVersionId: await versionId(def),
        data: result.values,
        visitorHash: visitor.hash,
        locale,
        uniqueKey,
      },
      { maxResponses: policy?.maxResponses },
    );
    if (!created.ok) return respond(created);
    const { submission } = created;
    const delivered = webhooks.send(def.id, {
      type: 'submission.created',
      timestamp: submission.createdAt,
      data: {
        form: { id: def.id, title: def.schema.title },
        submission: {
          id: submission.id,
          number: submission.number,
          createdAt: submission.createdAt,
          locale: submission.locale,
          data: submission.data,
        },
      },
    });
    opts.waitUntil?.(delivered);
    return respond(created);
  }

  async function listForms() {
    const ids = await opts.registry.list();
    const [counts, latest, overrides] = await Promise.all([
      storage.countsByForm(),
      storage.latestByForm?.() ?? ({} as Record<string, string>),
      storage.listFormOverrides(),
    ]);
    const now = clock();
    const forms = await Promise.all(
      ids.map(async (id) => {
        try {
          const def = await opts.registry.load(id);
          if (!def) return null;
          const policy = policyOf(def, overrides[id]);
          const window = windowOf(def, overrides[id], now).status;
          const responses = counts[id] ?? 0;
          const max = policy?.maxResponses;
          return {
            id,
            updatedAt: await opts.registry.updatedAt?.(id),
            lastResponseAt: latest[id],
            title: def.schema.title ?? id,
            description: def.schema.description,
            fields: new Set(def.schema.fields.map((f) => f.name)).size,
            pages: def.schema.pages.length,
            responses,
            maxResponses: max,
            status: statusOf(window, responses, max, isPublished(def.config, overrides[id])),
          };
        } catch (err) {
          return {
            id,
            title: id,
            responses: counts[id] ?? 0,
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    );
    return json({ forms: forms.filter(Boolean) });
  }

  async function getSchema({ now }: RouteContext, [id]: string[]) {
    const def = await loadForm(id as string);
    const overrides = await storage.getFormOverrides(def.id);
    const policy = policyOf(def, overrides);
    const window = windowOf(def, overrides, now);
    const responses = await storage.countSubmissions(def.id);
    const published = isPublished(def.config, overrides);
    const iso = (ms?: number) => (ms === undefined ? undefined : new Date(ms).toISOString());
    return json({
      id: def.id,
      version: def.version,
      schema: def.schema,
      config: def.config,
      timeZone: timeZoneOf(def, overrides),
      timeZoneFallback: !overrides?.timeZone && !def.config.timeZone && !opts.config?.timeZone,
      schedule: scheduleOf(policy),
      published,
      overrides,
      status: statusOf(window.status, responses, policy?.maxResponses, published),
      opensAt: iso(window.opensAt),
      closesAt: iso(window.closesAt),
      protection: resolveProtection(opts.config?.protection, def.config.protection),
      responses,
      embed: { origins: embedOrigins },
      webhooks: webhooks.targets(def.id).map((hook) => ({
        origin: new URL(hook.url).origin,
        signed: Boolean(opts.webhookSecret),
      })),
      languages: {
        available: formLocales(def.config, opts.config?.locale),
        coverage: def.texts ? translationCoverage(def.texts, def.config.translations) : [],
      },
    });
  }

  /** Body: the schedule Studio wants. Only what differs from the code is stored. */
  async function setOverrides({ request }: RouteContext, [id]: string[]) {
    assertSameOrigin(request);
    const def = await loadForm(id as string);
    const body = await readJson(request, 4096);
    let changes: ReturnType<typeof scheduleEdit>;
    try {
      changes = scheduleEdit(body, {
        policy: def.config.submissions,
        timeZone: codeTimeZone(def),
        published: isPublished(def.config, null),
      });
    } catch (err) {
      throw new HttpError(422, 'invalid', (err as Error).message);
    }
    await storage.setFormOverrides(def.id, Object.keys(changes).length > 0 ? changes : null);
    return json({ overrides: await storage.getFormOverrides(def.id) });
  }

  async function clearOverrides({ request }: RouteContext, [id]: string[]) {
    assertSameOrigin(request);
    const def = await loadForm(id as string);
    await storage.setFormOverrides(def.id, null);
    return json({ overrides: null });
  }

  async function schemasFor(id: string): Promise<FormSchema[]> {
    let def: FormDefinition | null = null;
    try {
      def = await opts.registry.load(id);
    } catch {}
    return schemaHistory(storage, id, def);
  }

  async function listSubmissions({ url, now }: RouteContext, [id]: string[]) {
    if (!FORM_ID_RE.test(id as string)) throw new HttpError(404, 'not_found', 'Form not found.');
    const limit = Math.min(Math.max(countParam(url, 'limit', 50), 1), 500);
    const offset = countParam(url, 'offset', 0);
    const search = url.searchParams.get('q') ?? undefined;
    const page = await storage.listSubmissions(id as string, {
      limit,
      offset,
      search,
      filter: filterParam(url),
      sort: sortParam(url),
      now,
    });
    const columns = responseColumns(await schemasFor(id as string), page.items);
    return json({ ...page, columns, limit, offset });
  }

  async function getSubmission(_ctx: RouteContext, [id, sid]: string[]) {
    const submission = await storage.getSubmission(id as string, sid as string);
    if (!submission) throw new HttpError(404, 'not_found', 'Response not found.');
    const version = await storage.getFormVersion(submission.formVersionId);
    return json({ submission, schema: version?.schema ?? null, version: version?.version });
  }

  async function deleteSubmission({ request }: RouteContext, [id, sid]: string[]) {
    assertSameOrigin(request);
    const deleted = await storage.deleteSubmission(id as string, sid as string);
    if (!deleted) throw new HttpError(404, 'not_found', 'Response not found.');
    return json({ ok: true });
  }

  async function deleteSubmissions({ request }: RouteContext, [id]: string[]) {
    assertSameOrigin(request);
    if (!FORM_ID_RE.test(id as string)) throw new HttpError(404, 'not_found', 'Form not found.');
    const { ids } = await readJson(request, 64 * 1024);
    if (
      !Array.isArray(ids) ||
      ids.length === 0 ||
      ids.length > MAX_BULK_DELETE ||
      !ids.every((sid) => typeof sid === 'string' && sid.length > 0 && sid.length <= 64)
    ) {
      throw new HttpError(400, 'bad_request', `ids must list 1–${MAX_BULK_DELETE} responses.`);
    }
    let deleted = 0;
    for (const sid of new Set(ids as string[])) {
      if (await storage.deleteSubmission(id as string, sid)) deleted++;
    }
    return json({ deleted });
  }

  async function exportSubmissions({ url, now }: RouteContext, [id]: string[]) {
    if (!FORM_ID_RE.test(id as string)) throw new HttpError(404, 'not_found', 'Form not found.');
    const requested = url.searchParams.get('format');
    const format = requested === 'json' || requested === 'xlsx' ? requested : 'csv';
    const date = new Date(now).toISOString().slice(0, 10);
    const { body } = await exportFormResponses({
      storage,
      formId: id as string,
      format,
      definition: format === 'json' ? null : await loadForm(id as string).catch(() => null),
      projectTimeZone: opts.config?.timeZone,
    });
    return new Response(body, {
      headers: {
        'content-type': EXPORT_CONTENT_TYPES[format],
        'content-disposition': `attachment; filename="${id}-responses-${date}.${format}"`,
        'cache-control': 'no-store',
      },
    });
  }

  function requireGate() {
    if (!gate) throw new HttpError(404, 'not_found', 'Not found.');
    return gate;
  }

  async function getSession({ request }: RouteContext) {
    const via = await requireGate().check(request);
    const auth = opts.adminAuth;
    return json({
      signedIn: via !== null,
      canSignOut: via === 'session',
      signIn: auth?.password ? 'password' : auth?.signInUrl ? 'url' : null,
      signInUrl: auth?.signInUrl,
    });
  }

  let warnedPlainHttp = false;
  async function signIn({ request, url, now }: RouteContext) {
    const admin = requireGate();
    if (!opts.adminAuth?.password) throw new HttpError(404, 'not_found', 'Not found.');
    assertSameOrigin(request);
    if (!warnedPlainHttp && !sentOverHttps(request) && !isLoopbackHost(url.host)) {
      warnedPlainHttp = true;
      console.warn(
        `[open-form] A Studio sign-in reached ${url.host} over plain HTTP, so the password and session cookie crossed the network unencrypted. Serve Studio over HTTPS: a reverse proxy or your platform's TLS.`,
      );
    }
    const body = await readJson(request, 4096);
    const address = rateLimitSubject(opts.clientAddress?.(request) ?? 'unknown');
    const key = (await signer.sign(`sign-in:${address}`)).slice(0, 32);
    if ((await storage.hitRateLimit(key, SIGN_IN_WINDOW_MS, now)) > SIGN_IN_MAX) {
      throw new HttpError(429, 'rate_limited', 'Too many sign-in attempts. Try again later.');
    }
    const cookie = await admin.signIn(request, body.password, now);
    if (!cookie) throw new HttpError(401, 'invalid_password', 'That password is not right.');
    return json({ signedIn: true }, 200, { 'set-cookie': cookie });
  }

  async function signOut({ request }: RouteContext) {
    const admin = requireGate();
    assertSameOrigin(request);
    return json({ signedIn: false }, 200, { 'set-cookie': await admin.signOut(request) });
  }

  const SEG = '([^/]+)';
  const routes: Route[] = [
    { method: 'GET', pattern: /^\/studio\/session$/, admin: false, handle: getSession },
    { method: 'POST', pattern: /^\/studio\/session$/, admin: false, handle: signIn },
    { method: 'DELETE', pattern: /^\/studio\/session$/, admin: false, handle: signOut },
    { method: 'GET', pattern: /^\/forms$/, admin: true, handle: () => listForms() },
    {
      method: 'GET',
      pattern: /^\/studio\/folders$/,
      admin: true,
      handle: async () =>
        json((await opts.registry.folders?.()) ?? { folders: [], assignments: {} }),
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/forms/${SEG}$`),
      admin: false,
      cors: true,
      handle: getForm,
    },
    {
      method: 'POST',
      pattern: new RegExp(`^/forms/${SEG}/submissions$`),
      admin: false,
      cors: true,
      handle: submit,
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/forms/${SEG}/schema$`),
      admin: true,
      handle: getSchema,
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/forms/${SEG}/submissions$`),
      admin: true,
      handle: listSubmissions,
    },
    {
      method: 'PUT',
      pattern: new RegExp(`^/forms/${SEG}/overrides$`),
      admin: true,
      handle: setOverrides,
    },
    {
      method: 'DELETE',
      pattern: new RegExp(`^/forms/${SEG}/overrides$`),
      admin: true,
      handle: clearOverrides,
    },
    {
      method: 'POST',
      pattern: new RegExp(`^/forms/${SEG}/submissions/delete$`),
      admin: true,
      handle: deleteSubmissions,
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/forms/${SEG}/submissions/${SEG}$`),
      admin: true,
      handle: getSubmission,
    },
    {
      method: 'DELETE',
      pattern: new RegExp(`^/forms/${SEG}/submissions/${SEG}$`),
      admin: true,
      handle: deleteSubmission,
    },
    {
      method: 'GET',
      pattern: new RegExp(`^/forms/${SEG}/export$`),
      admin: true,
      handle: exportSubmissions,
    },
  ];

  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(`${basePath}/`) && url.pathname !== basePath) {
      return json({ error: 'not_found', message: 'Not found.' }, 404);
    }
    const subpath = url.pathname.slice(basePath.length) || '/';

    if (request.method === 'OPTIONS') {
      const cors = routes.some((r) => r.cors && r.pattern.test(subpath))
        ? corsHeaders(request)
        : null;
      if (!cors) return json({ error: 'not_found', message: 'Not found.' }, 404);
      return new Response(null, {
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST',
          'access-control-allow-headers': `content-type, ${VISITOR_HEADER}`,
          'access-control-max-age': '600',
        },
      });
    }

    let methodMismatch = false;
    for (const route of routes) {
      const match = route.pattern.exec(subpath);
      if (!match) continue;
      if (route.method !== request.method) {
        methodMismatch = true;
        continue;
      }
      const response = await dispatch(route, match);
      const cors = route.cors ? corsHeaders(request) : null;
      for (const [key, value] of Object.entries(cors ?? {})) response.headers.set(key, value);
      return response;
    }
    if (methodMismatch)
      return json({ error: 'method_not_allowed', message: 'Method not allowed.' }, 405);
    return json({ error: 'not_found', message: 'Not found.' }, 404);

    async function dispatch(route: Route, match: RegExpExecArray): Promise<Response> {
      try {
        if (route.admin && !gate) {
          return json({ error: 'not_found', message: 'Not found.' }, 404);
        }
        if (route.admin && !(await gate?.check(request))) {
          return json({ error: 'unauthorized', message: 'Sign in to Studio.' }, 401);
        }
        const params = match.slice(1).map(decodeParam);
        return await route.handle({ request, url, now: clock() }, params);
      } catch (err) {
        if (err instanceof HttpError) {
          return json({ error: err.code, message: err.message, ...err.extra }, err.status);
        }
        const message = err instanceof Error ? err.message : String(err);
        // Errors from a form's own validators can quote the respondent's answers,
        // so outside dev only the error's type and stack frames are logged.
        console.error(
          `[open-form] ${request.method} ${url.pathname} failed:`,
          opts.exposeErrors ? err : withoutMessage(err),
        );
        return json(
          {
            error: 'internal',
            message: opts.exposeErrors ? message : 'Internal server error.',
          },
          500,
        );
      }
    }
  };
}
