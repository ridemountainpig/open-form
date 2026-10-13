import { type FormConfig, type FormValues, parseDuration } from '../schema/index.ts';

// Unfinished answers, kept in this browser only (never sent anywhere) when a
// form opts in with `drafts`.

export type Draft = { values: FormValues; step: number };

const PREFIX = 'open-form:draft:';
const DEFAULT_LIFETIME_MS = parseDuration('7d');

/** How long a draft lives, or null when the form doesn't keep drafts. */
export function draftLifetime(setting: FormConfig['drafts']): number | null {
  if (!setting) return null;
  const expires = setting === true ? undefined : setting.expires;
  return expires ? parseDuration(expires) : DEFAULT_LIFETIME_MS;
}

export function readDraft(formId: string, lifetimeMs: number, now = Date.now()): Draft | null {
  try {
    const raw = localStorage.getItem(PREFIX + formId);
    if (!raw) return null;
    const draft = JSON.parse(raw) as { savedAt?: unknown; values?: unknown; step?: unknown };
    const values = draft.values;
    if (
      typeof draft.savedAt !== 'number' ||
      now - draft.savedAt > lifetimeMs ||
      typeof values !== 'object' ||
      values === null ||
      Array.isArray(values)
    ) {
      localStorage.removeItem(PREFIX + formId);
      return null;
    }
    return {
      values: values as FormValues,
      step: typeof draft.step === 'number' && draft.step >= 0 ? Math.floor(draft.step) : 0,
    };
  } catch {
    return null;
  }
}

export function writeDraft(formId: string, draft: Draft, lifetimeMs: number): void {
  try {
    const savedAt = Date.now();
    localStorage.setItem(
      PREFIX + formId,
      JSON.stringify({ savedAt, expiresAt: savedAt + lifetimeMs, ...draft }),
    );
  } catch {}
}

/**
 * Drop every form's expired drafts, not just this one's: a draft for a form the
 * respondent never reopens would otherwise stay in the browser for good.
 */
export function sweepDrafts(now = Date.now()): void {
  try {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key?.startsWith(PREFIX)) continue;
      let expiresAt: unknown;
      try {
        const draft = JSON.parse(localStorage.getItem(key) ?? '') as {
          savedAt?: unknown;
          expiresAt?: unknown;
        };
        expiresAt =
          draft.expiresAt ??
          (typeof draft.savedAt === 'number' ? draft.savedAt + DEFAULT_LIFETIME_MS : undefined);
      } catch {}
      if (typeof expiresAt !== 'number' || expiresAt <= now) localStorage.removeItem(key);
    }
  } catch {}
}

export function clearDraft(formId: string): void {
  try {
    localStorage.removeItem(PREFIX + formId);
  } catch {}
}
