import { useCallback, useEffect, useState } from 'react';
import type {
  FieldType,
  FormConfig,
  FormOverrides,
  FormSchema,
  FormValues,
  Locale,
  PaletteReport,
  ResolvedProtection,
  Schedule,
  ThemeColorKey,
  ThemePatch,
  ThemeTokens,
  TranslationCoverage,
} from '../../schema/index.ts';
import { onFormChanged } from '../lib/forms.ts';
import { onThemeChanged } from '../lib/themes.ts';

export type FormStatus = 'open' | 'closed' | 'not-open' | 'full' | 'unpublished';

export type FormSummary = {
  id: string;
  title: string;
  description?: string;
  fields?: number;
  pages?: number;
  responses: number;
  maxResponses?: number;
  status?: FormStatus;
  error?: string;
  /** When the form's files last changed. */
  updatedAt?: string;
  lastResponseAt?: string;
};

export type SchemaInfo = {
  id: string;
  version: string;
  schema: FormSchema;
  config: FormConfig;
  /** IANA zone the policy dates are read in. */
  timeZone: string;
  /** Nothing (form, project or Studio) set a zone, so `timeZone` is the UTC fallback. */
  timeZoneFallback: boolean;
  /** In effect now: the code's values with Studio's overrides applied. */
  schedule: Schedule;
  /** Reachable at its link; like `schedule`, with Studio's override applied. */
  published: boolean;
  /** Changes made in Studio on the running server, or null when it follows the code. */
  overrides: (FormOverrides & { updatedAt: string }) | null;
  status: FormStatus;
  /** When the form opens and closes, as ISO timestamps. */
  opensAt?: string;
  closesAt?: string;
  protection: ResolvedProtection;
  responses: number;
  embed?: { origins: string[] };
  /** Origins only: a webhook URL's path may be a secret. */
  webhooks?: Array<{ origin: string; signed: boolean }>;
  languages?: { available: Locale[]; coverage: TranslationCoverage[] };
};

export type Submission = {
  id: string;
  number: number;
  formVersionId: string;
  data: FormValues;
  locale?: string | null;
  createdAt: string;
};

export type Column = { key: string; header: string; type?: FieldType };

export type SubmissionPage = {
  items: Submission[];
  total: number;
  columns: Column[];
  limit: number;
  offset: number;
};

export type SubmissionDetail = {
  submission: Submission;
  schema: FormSchema | null;
  version?: string;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Fired when an API call finds the session gone; Studio returns to sign-in. */
export const SIGNED_OUT_EVENT = 'open-form:signed-out';

export function checkSignedIn(res: Response): void {
  if (res.status === 401) window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { credentials: 'same-origin', ...init });
  checkSignedIn(res);
  const body = (await res.json().catch(() => ({}))) as { message?: string };
  if (!res.ok) throw new ApiError(res.status, body.message ?? res.statusText);
  return body as T;
}

export type Resource<T> = {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload(): void;
};

type Settled<T> = { key: string; url: string; data?: T; error?: Error };

/**
 * Fetch JSON; refetch on `reload()` and whenever a form's source changes.
 * What came back belongs to its URL: another one starts empty, so one form's
 * data never shows under another. URLs that share a `scope` (the pages of one
 * list) keep the last data up while the next loads.
 */
export function useResource<T>(
  url: string | null,
  opts: { live?: boolean; scope?: string } = {},
): Resource<T> {
  const key = url && (opts.scope ?? url);
  const [settled, setSettled] = useState<Settled<T>>();
  const [fetching, setFetching] = useState(false);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  const live = opts.live ?? true;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `tick` forces a refetch
  useEffect(() => {
    if (!url || !key) return;
    let cancelled = false;
    setFetching(true);
    request<T>(url).then(
      (data) => {
        if (cancelled) return;
        setSettled({ key, url, data });
        setFetching(false);
      },
      (error: Error) => {
        if (cancelled) return;
        setSettled((prev) => ({
          key,
          url,
          data: prev?.key === key ? prev.data : undefined,
          error,
        }));
        setFetching(false);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [url, key, tick]);

  const current = key && settled?.key === key ? settled : undefined;
  const loading = Boolean(url) && (fetching || settled?.url !== url);

  useEffect(() => {
    if (!live) return;
    const offForm = onFormChanged(reload);
    const offTheme = onThemeChanged(reload);
    return () => {
      offForm();
      offTheme();
    };
  }, [live, reload]);

  return { data: current?.data, error: current?.error, loading, reload };
}

export const formPath = (id: string) => `/api/forms/${encodeURIComponent(id)}`;

export const EXPORT_FORMATS = [
  { format: 'xlsx', label: 'Excel' },
  { format: 'csv', label: 'CSV' },
  { format: 'json', label: 'JSON' },
] as const;

export const exportPath = (id: string, format: (typeof EXPORT_FORMATS)[number]['format']) =>
  `${formPath(id)}/export?format=${format}`;

export function deleteSubmission(formId: string, submissionId: string) {
  return request<{ ok: true }>(
    `${formPath(formId)}/submissions/${encodeURIComponent(submissionId)}`,
    { method: 'DELETE' },
  );
}

/** The server takes up to 500 ids a request; larger selections go in turns. */
const DELETE_BATCH = 500;

export async function deleteSubmissions(formId: string, submissionIds: string[]) {
  let deleted = 0;
  for (let i = 0; i < submissionIds.length; i += DELETE_BATCH) {
    const result = await request<{ deleted: number }>(`${formPath(formId)}/submissions/delete`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ids: submissionIds.slice(i, i + DELETE_BATCH) }),
    });
    deleted += result.deleted;
  }
  return { deleted };
}

/** Every response matching `search` and `filter` (all of them without either), by id. */
export async function submissionIds(
  formId: string,
  search: string,
  filter: string,
): Promise<Set<string>> {
  const ids = new Set<string>();
  const limit = 500;
  for (let offset = 0; ; offset += limit) {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    if (search) params.set('q', search);
    if (filter) params.set('filter', filter);
    const page = await request<SubmissionPage>(`${formPath(formId)}/submissions?${params}`);
    for (const item of page.items) ids.add(item.id);
    if (page.items.length < limit || offset + limit >= page.total) return ids;
  }
}

/**
 * Under `open-form dev` the schedule is written into the form's code; on a
 * running server it is stored as an override, so it changes without a deploy.
 */
export function saveSchedule(
  formId: string,
  schedule: Schedule,
  { timeZone, published, dev }: { timeZone: string; published: boolean; dev: boolean },
) {
  const url = dev
    ? `/api/studio/forms/${encodeURIComponent(formId)}/schedule`
    : `${formPath(formId)}/overrides`;
  return request<unknown>(url, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ submissions: schedule, timeZone, published }),
  });
}

/**
 * Under `open-form dev` only: erases the form's responses and removes
 * `forms/<id>/`. `confirm` repeats the id the person typed.
 */
export function deleteForm(formId: string) {
  return request<{ responses: number }>(`/api/studio/forms/${encodeURIComponent(formId)}`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ confirm: formId }),
  });
}

export function clearOverrides(formId: string) {
  return request<unknown>(`${formPath(formId)}/overrides`, { method: 'DELETE' });
}

/** One of the project's themes: a reference in themes/ that forms copy. */
export type ThemeSummary = {
  id: string;
  name: string;
  description: string;
  layout?: string;
  hasDoc: boolean;
};

export type ThemeGallery = {
  themes: ThemeSummary[];
};

export type StarterTheme = {
  id: string;
  name: string;
  description: string;
  colors: Partial<Record<ThemeColorKey, string>>;
  colorScheme?: 'light' | 'dark';
};

/** A web font the theme serves from its own `fonts/` folder. */
export type ThemeFont = {
  family: string;
  /** The `font` / `headingFont` value that uses it. */
  stack: string;
  css: string;
  files: number;
  bytes: number;
  /** The stylesheet on the dev server, so Studio can show the font too. */
  href?: string;
};

export type ThemeDetail = Omit<ThemeSummary, 'hasDoc'> & {
  doc: string | null;
  file: string;
  tokens: ThemeTokens;
  fonts: ThemeFont[];
  contrast: { palettes: PaletteReport[]; warnings: string[] };
};

/** A family in the Google Fonts catalog. */
export type GoogleFont = {
  family: string;
  category: string;
  weights: number[];
  axis?: { min: number; max: number };
  italicOnly: boolean;
  subsets: string[];
  cjk: boolean;
};

export type FontFilter = { q: string; category?: string; cjk?: boolean };

export function searchFonts(filter: FontFilter, signal?: AbortSignal) {
  const params = new URLSearchParams({ q: filter.q });
  if (filter.category) params.set('category', filter.category);
  if (filter.cjk) params.set('cjk', '1');
  return request<{ fonts: GoogleFont[] }>(`/api/studio/themes/_fonts?${params}`, { signal });
}

/** Download a Google font into the theme's `fonts/` folder. */
export function addThemeFont(id: string, family: string) {
  return request<{ font: ThemeFont }>(`${themePath(id)}/fonts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ family }),
  });
}

const themePath = (id: string) => `/api/studio/themes/${encodeURIComponent(id)}`;

export function themeUrl(id: string) {
  return themePath(id);
}

export function saveThemeTokens(id: string, patch: ThemePatch) {
  return request<Pick<ThemeDetail, 'tokens' | 'contrast'>>(themePath(id), {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ patch }),
  });
}

/** Copy a starter into `themes/<as>/`. */
export function addStarterRequest(starter: string, as?: string) {
  return request<{ id: string; files: string[] }>('/api/studio/themes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ starter, ...(as ? { as } : {}) }),
  });
}
