import {
  CHOICE_TYPES,
  coerceValue,
  type FieldSchema,
  type FormSchema,
  type FormValues,
  isFilled,
  ownValue,
} from '../schema/index.ts';

// Answers a link fills in (`/f/meetup#name=Ada&email=ada@example.com`), for the
// fields a form lists in `config.prefill`. They're only a starting point: the
// respondent can change them and the server validates them like any answer.

const MAX_VALUE_LENGTH = 1000;
const MAX_VALUES_PER_FIELD = 50;

function linkParams(search: string, hash: string): URLSearchParams[] {
  return [new URLSearchParams(hash.replace(/^#/, '')), new URLSearchParams(search)];
}

/**
 * The raw strings a link carries for the allowed fields. The fragment wins over
 * the query string: browsers never send it to a server, so names and emails in
 * it stay out of access logs and `Referer` headers.
 */
export function readLinkPrefill(
  allowed: readonly string[],
  search: string,
  hash: string,
): FormValues {
  const out: FormValues = {};
  const sources = linkParams(search, hash);
  for (const name of allowed) {
    const params = sources.find((p) => p.has(name));
    if (!params) continue;
    const values = params
      .getAll(name)
      .slice(0, MAX_VALUES_PER_FIELD)
      .map((v) => v.slice(0, MAX_VALUE_LENGTH));
    out[name] = values.length === 1 ? values[0] : values;
  }
  return out;
}

/** The link without the prefilled answers, or null when it carried none. */
export function withoutPrefill(href: string, allowed: readonly string[]): string | null {
  const url = new URL(href);
  const [hash, search] = linkParams(url.search, url.hash);
  if (!allowed.some((name) => hash?.has(name) || search?.has(name))) return null;
  for (const name of allowed) {
    hash?.delete(name);
    search?.delete(name);
  }
  url.search = search?.toString() ?? '';
  url.hash = hash?.toString() ?? '';
  return url.href;
}

function prefillValue(field: FieldSchema, raw: unknown): unknown {
  if (field.type === 'custom') return undefined;
  const first = Array.isArray(raw) ? raw[0] : raw;
  const value = coerceValue(field, field.type === 'checkbox-group' ? raw : first);
  if (!CHOICE_TYPES.has(field.type)) {
    if (field.type === 'number' && typeof value !== 'number') return undefined;
    return isFilled(value) || value === true ? value : undefined;
  }
  const options = new Set(field.options?.map((o) => o.value));
  if (Array.isArray(value)) {
    const picked = value.filter((v) => options.has(v));
    return picked.length ? picked : undefined;
  }
  return typeof value === 'string' && options.has(value) ? value : undefined;
}

/**
 * Link answers as the form's own answers: coerced to each field's type, choices
 * the field doesn't offer and fields outside `allowed` dropped.
 */
export function prefillAnswers(
  schema: FormSchema,
  allowed: readonly string[],
  raw: FormValues,
): FormValues {
  const out: FormValues = {};
  for (const name of allowed) {
    const field = schema.fields.find((f) => f.name === name);
    const given = ownValue(raw, name);
    if (!field || given === undefined) continue;
    const value = prefillValue(field, given);
    if (value !== undefined) out[name] = value;
  }
  return out;
}

/**
 * A restored draft wins field by field: it holds what the respondent typed after
 * opening the link, often a correction, and reopening the same link mustn't undo
 * it. The link still fills the fields the draft never reached.
 */
export function prefillOverDraft(prefill: FormValues, draft: FormValues | undefined): FormValues {
  if (!draft) return prefill;
  return Object.fromEntries(
    Object.entries(prefill).filter(([name]) => ownValue(draft, name) === undefined),
  );
}
