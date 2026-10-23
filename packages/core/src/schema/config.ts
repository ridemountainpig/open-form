import type { CalendarEvent } from './calendar.ts';
import type { Translations } from './i18n.ts';
import type { Locale } from './messages.ts';
import { DEFAULT_TIME_ZONE, policyInstant } from './time.ts';

export type Duration = number | `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

const UNIT_MS = { ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

/** `'2s'`, `'10m'`, `'1h'` or a number of milliseconds. */
export function parseDuration(value: Duration): number {
  if (typeof value === 'number') return value;
  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h|d)$/.exec(value.trim());
  if (!match) throw new Error(`Invalid duration "${value}". Use e.g. "2s", "10m", "1h".`);
  return Number(match[1]) * UNIT_MS[match[2] as keyof typeof UNIT_MS];
}

export type SubmissionPolicy = {
  /** Stop accepting responses once this many are stored. */
  maxResponses?: number;
  /**
   * `YYYY-MM-DD` (from the start of that day) or `YYYY-MM-DDTHH:mm`, in the
   * form's `timeZone`; or an ISO timestamp with an offset.
   */
  opensAt?: string | Date;
  /** `YYYY-MM-DD` (until the end of that day) or `YYYY-MM-DDTHH:mm`, like `opensAt`. */
  closesAt?: string | Date;
  /** Stop taking responses now, whatever the dates say. */
  closed?: boolean;
  /**
   * `'device'` allows one response per browser (a cookie — lightweight, not identity).
   * A field name (e.g. `'email'`) allows one response per distinct value.
   */
  uniqueBy?: 'device' | (string & {});
  closedMessage?: string;
  fullMessage?: string;
  duplicateMessage?: string;
};

export type RateLimitConfig = {
  max: number;
  window: Duration;
};

export type ProtectionConfig = {
  /** Hidden field bots fill in. Default `true`. */
  honeypot?: boolean;
  /** Reject submissions sent faster than this after the form loads. Default `'2s'`. */
  minimumCompletionTime?: Duration | false;
  /** Per-IP limit per form. Default `{ max: 10, window: '10m' }`. */
  rateLimit?: RateLimitConfig | false;
};

export type SuccessConfig = {
  title?: string;
  message?: string;
  /** Send the respondent here after a successful submission. */
  redirect?: string;
  /** An event to offer on the thank-you screen: Add to Google Calendar and an `.ics` download. */
  calendar?: CalendarEvent;
};

/** Per-form configuration: `export const config = defineForm({...})`. */
export type FormConfig = {
  title?: string;
  description?: string;
  /** The language the form is written in. Default: the project's `locale`, else `'en'`. */
  locale?: Locale;
  /** IANA time zone for `submissions` dates. Default: the project's `timeZone`, else `'UTC'`. */
  timeZone?: string;
  /**
   * Other languages, keyed by the exact source text:
   * `{ en: { '姓名': 'Name' } }`. Usually imported from `./locales/<lang>.json`.
   */
  translations?: Translations;
  /** Show the language picker when the form has translations. Default `true`. */
  languageSwitch?: boolean;
  /**
   * `false` takes the form offline: its link and API answer "not found", and
   * only Studio can still preview it. Its responses are kept. Default `true`.
   */
  published?: boolean;
  submissions?: SubmissionPolicy;
  protection?: ProtectionConfig;
  success?: SuccessConfig;
  /**
   * Keep unfinished answers in the respondent's browser and restore them when
   * they come back; cleared on submit. `true` keeps them 7 days. Off by default:
   * on a shared computer the next person would see them.
   */
  drafts?: boolean | { expires?: Duration };
};

export function defineForm(config: FormConfig): FormConfig {
  return config;
}

export type WebhookConfig = {
  /**
   * Receives a POST for every new response. The project config never reaches
   * the browser, so the URL may carry its own secret (Slack, Zapier).
   */
  url: string;
  /** Only these forms. Default: every form. */
  forms?: string[];
};

/** Project configuration: `open-form.config.ts`. */
export type OpenFormConfig = {
  formsDir?: string;
  themesDir?: string;
  port?: number;
  /** Default locale for built-in UI strings and validation messages. */
  locale?: Locale;
  /**
   * IANA time zone (`'Asia/Taipei'`) for dates in submission policies, so they
   * mean the same on your laptop and on a server running in UTC. Default `'UTC'`.
   */
  timeZone?: string;
  storage?: {
    /** SQLite file path, relative to the project root. Default `.open-form/open-form.db`. */
    path?: string;
    /**
     * A Postgres connection string, read from the environment
     * (`url: process.env.DATABASE_URL`) and never written here: this file is committed.
     * `OPEN_FORM_DATABASE_URL` wins over it.
     */
    url?: string;
  };
  /** Defaults applied to every form; each form's own `protection` wins. */
  protection?: ProtectionConfig;
  /**
   * Read the client IP and protocol from `X-Forwarded-*`: `true` for one proxy,
   * or how many proxies sit in front of the server. Only behind proxies you control.
   */
  trustProxy?: boolean | number;
  allowedHosts?: string[] | true;
  /**
   * Notify other services of new responses. Signed with `OPEN_FORM_WEBHOOK_SECRET`
   * in the Standard Webhooks format (https://www.standardwebhooks.com).
   */
  webhooks?: WebhookConfig[];
  /** Show forms on other sites (`<script src="…/embed.js">` or an iframe). */
  embed?: {
    /**
     * Sites that may frame `/f/<id>` and call the public form API, as origins:
     * `['https://example.com']`. `'*'` allows any site.
     */
    origins?: string[];
  };
  studio?: {
    /**
     * `'read-only'`: under `open-form start`, anyone can open Studio and read
     * every form and response, unpublished forms included, without signing in.
     * Changes still need `OPEN_FORM_ADMIN_PASSWORD`. For public demos.
     */
    public?: 'read-only';
  };
};

export function defineConfig(config: OpenFormConfig): OpenFormConfig {
  return config;
}

export function studioProblem(studio: unknown): string | undefined {
  if (studio === undefined) return undefined;
  if (typeof studio !== 'object' || studio === null) return 'studio must be an object.';
  const value = (studio as { public?: unknown }).public;
  if (value === undefined || value === 'read-only') return undefined;
  return `studio.public ${JSON.stringify(value)} isn't supported. Use 'read-only', or leave it out.`;
}

export const DEFAULT_PROTECTION = {
  honeypot: true,
  minimumCompletionTime: '2s',
  rateLimit: { max: 10, window: '10m' },
} as const satisfies Required<ProtectionConfig>;

export type ResolvedProtection = {
  honeypot: boolean;
  minimumCompletionTimeMs: number;
  rateLimit: { max: number; windowMs: number } | null;
};

export function resolveProtection(
  ...layers: Array<ProtectionConfig | undefined>
): ResolvedProtection {
  const merged: ProtectionConfig = { ...DEFAULT_PROTECTION };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, value] of Object.entries(layer)) {
      if (value !== undefined) (merged as Record<string, unknown>)[key] = value;
    }
  }
  const rate = merged.rateLimit;
  return {
    honeypot: merged.honeypot !== false,
    minimumCompletionTimeMs:
      merged.minimumCompletionTime === false || merged.minimumCompletionTime === undefined
        ? 0
        : parseDuration(merged.minimumCompletionTime),
    rateLimit: rate ? { max: rate.max, windowMs: parseDuration(rate.window) } : null,
  };
}

/** The form's own `timeZone`, else the project's, else UTC. */
export function formTimeZone(config: FormConfig | undefined, projectTimeZone?: string): string {
  return config?.timeZone ?? projectTimeZone ?? DEFAULT_TIME_ZONE;
}

export type WindowStatus = 'open' | 'not-open' | 'closed';

export function submissionWindow(
  policy: SubmissionPolicy | undefined,
  { now = Date.now(), timeZone = DEFAULT_TIME_ZONE }: { now?: number; timeZone?: string } = {},
): { status: WindowStatus; opensAt?: number; closesAt?: number } {
  const opensAt = policy?.opensAt ? policyInstant(policy.opensAt, timeZone, 'start') : undefined;
  const closesAt = policy?.closesAt ? policyInstant(policy.closesAt, timeZone, 'end') : undefined;
  if (policy?.closed) return { status: 'closed', opensAt, closesAt };
  if (opensAt !== undefined && now < opensAt) return { status: 'not-open', opensAt, closesAt };
  if (closesAt !== undefined && now > closesAt) return { status: 'closed', opensAt, closesAt };
  return { status: 'open', opensAt, closesAt };
}
