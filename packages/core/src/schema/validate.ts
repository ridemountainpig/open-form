import { evaluateAll, isFilled, ownValue } from './conditions.ts';
import { format, formatDate, getMessages, type Messages } from './messages.ts';
import { cleanPhone, isInternationalPhone, phoneInCountries } from './phone.ts';
import { isStandardSchema, type StandardSchemaV1 } from './standard-schema.ts';
import type {
  Condition,
  FieldErrors,
  FieldSchema,
  FieldType,
  FormSchema,
  FormValues,
} from './types.ts';

type ValidatorResult = string | null | undefined;

export type CustomValidatorFn = (
  value: unknown,
  values: FormValues,
) => ValidatorResult | Promise<ValidatorResult>;

/** A function returning an error message, or any Standard Schema (Zod, Valibot, …). */
export type CustomValidator = CustomValidatorFn | StandardSchemaV1;

const TEXT_TYPES = new Set(['text', 'email', 'url', 'tel', 'textarea']);
export const CHOICE_TYPES: ReadonlySet<FieldType> = new Set(['select', 'radio', 'checkbox-group']);

// Deliberately permissive: one @, a dot in the domain, no whitespace. Stricter
// regexes reject real addresses far more often than they catch typos.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The regexes backtrack on long hostile input, so they only see bounded values:
// an address can't exceed 254 characters (RFC 5321), and an author's `pattern`
// without a `maxLength` is checked against at most 1,000.
const EMAIL_MAX_LENGTH = 254;
const PATTERN_MAX_LENGTH = 1000;
const PHONE_RE = /^\+?[\d\s\-().]{6,}$/;
// Custom fields take any JSON; bounded nesting keeps search and exports able to walk it.
const CUSTOM_MAX_DEPTH = 10;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isInternationalTel(field: Pick<FieldSchema, 'type' | 'international' | 'countries'>) {
  return field.type === 'tel' && Boolean(field.international || field.countries);
}

export function coerceValue(
  field: Pick<FieldSchema, 'type' | 'international' | 'countries'>,
  raw: unknown,
): unknown {
  if (raw === undefined || raw === null) return undefined;
  if (isInternationalTel(field) && typeof raw === 'string') {
    const cleaned = cleanPhone(raw.trim());
    return cleaned === '' ? undefined : cleaned;
  }
  switch (field.type) {
    case 'text':
    case 'email':
    case 'url':
    case 'tel':
    case 'textarea':
    case 'select':
    case 'radio':
    case 'date': {
      if (typeof raw === 'string') return raw.trim() === '' ? undefined : raw.trim();
      if (typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
      return raw;
    }
    case 'number': {
      if (typeof raw === 'number') return raw;
      if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (trimmed === '') return undefined;
        const n = Number(trimmed);
        return Number.isFinite(n) ? n : trimmed;
      }
      return raw;
    }
    case 'checkbox':
      return raw === true || raw === 'true' || raw === 'on' || raw === 1;
    case 'checkbox-group': {
      const list = Array.isArray(raw) ? raw : [raw];
      const picked = list.filter(
        (v) => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean',
      );
      return [...new Set(picked.map(String))].filter((v) => v !== '');
    }
    default:
      return raw;
  }
}

function nestedTooDeep(value: unknown, depth = 0): boolean {
  if (value === null || typeof value !== 'object') return false;
  if (depth >= CUSTOM_MAX_DEPTH) return true;
  return Object.values(value).some((v) => nestedTooDeep(v, depth + 1));
}

function isValidDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function compile(pattern: string, flags: string): RegExp | null {
  try {
    return new RegExp(`^(?:${pattern})$`, flags);
  } catch {
    return null;
  }
}

const patterns = new Map<string, RegExp | null>();

// Without the `u` flag when it rejects the pattern: authors write `\-` and
// `[\w-.]`, which browsers accept in the HTML `pattern` attribute.
function patternRegExp(pattern: string): RegExp | null {
  let re = patterns.get(pattern);
  if (re === undefined) {
    re = compile(pattern, 'u') ?? compile(pattern, '');
    patterns.set(pattern, re);
  }
  return re;
}

/** Why a field's `pattern` can't be used, or undefined if it compiles. */
export function patternProblem(pattern: string): string | undefined {
  if (patternRegExp(pattern)) return undefined;
  return `pattern ${JSON.stringify(pattern)} isn't a valid regular expression.`;
}

function matchesPattern(pattern: string, value: string): boolean {
  return patternRegExp(pattern)?.test(value) ?? false;
}

function decimals(n: number): number {
  const [mantissa = '', exponent = '0'] = String(n).toLowerCase().split('e');
  return Math.max(0, (mantissa.split('.')[1]?.length ?? 0) - Number(exponent));
}

/** The nearest allowed value when `value` is off the field's `step` grid, else undefined. */
function offStep(field: FieldSchema, value: number): number | undefined {
  const step = field.step;
  if (typeof step !== 'number' || !Number.isFinite(step) || step <= 0) return undefined;
  const base = typeof field.min === 'number' ? field.min : 0;
  const steps = (value - base) / step;
  const whole = Math.round(steps);
  // Binary fractions: 0.3 / 0.1 is 2.9999999999999996.
  if (Math.abs(steps - whole) <= 1e-9 * Math.max(1, Math.abs(steps))) return undefined;
  let nearest = base + whole * step;
  if (typeof field.max === 'number' && nearest > field.max) nearest -= step;
  return Number(nearest.toFixed(Math.min(100, Math.max(decimals(step), decimals(base)))));
}

/** Built-in validation shared by the browser runtime and the server. */
export function validateField(
  field: FieldSchema,
  value: unknown,
  messages: Messages = getMessages('en'),
): string | undefined {
  if (!isFilled(value)) {
    if (!field.required) return undefined;
    return field.type === 'checkbox' ? messages.mustAccept : messages.required;
  }

  if (TEXT_TYPES.has(field.type)) {
    if (typeof value !== 'string') return messages.required;
    const length = [...value].length;
    if (field.minLength !== undefined && length < field.minLength) {
      return format(messages.minLength, { n: field.minLength });
    }
    const maxLength = field.maxLength ?? (field.pattern ? PATTERN_MAX_LENGTH : undefined);
    if (maxLength !== undefined && length > maxLength) {
      return format(messages.maxLength, { n: maxLength });
    }
    if (field.type === 'email' && (length > EMAIL_MAX_LENGTH || !EMAIL_RE.test(value))) {
      return messages.invalidEmail;
    }
    if (field.type === 'url' && !isValidUrl(value)) return messages.invalidUrl;
    if (isInternationalTel(field)) {
      if (!isInternationalPhone(value)) return messages.invalidPhone;
      if (field.countries && !phoneInCountries(value, field.countries)) {
        return messages.phoneCountry;
      }
    } else if (field.type === 'tel' && !PHONE_RE.test(value)) {
      return messages.invalidPhone;
    }
    if (field.pattern && !matchesPattern(field.pattern, value)) {
      return field.patternMessage ?? messages.pattern;
    }
    return undefined;
  }

  switch (field.type) {
    case 'number': {
      if (typeof value !== 'number' || !Number.isFinite(value)) return messages.invalidNumber;
      if (field.integer && !Number.isInteger(value)) return messages.integer;
      if (typeof field.min === 'number' && value < field.min) {
        return format(messages.min, { n: field.min });
      }
      if (typeof field.max === 'number' && value > field.max) {
        return format(messages.max, { n: field.max });
      }
      const nearest = offStep(field, value);
      if (nearest !== undefined) return format(messages.step, { n: nearest });
      return undefined;
    }
    case 'select':
    case 'radio': {
      if (typeof value !== 'string') return messages.invalidOption;
      if (!(field.options ?? []).some((o) => o.value === value)) return messages.invalidOption;
      return undefined;
    }
    case 'checkbox':
      return value === true ? undefined : messages.mustAccept;
    case 'checkbox-group': {
      if (!Array.isArray(value)) return messages.invalidOption;
      const options = field.options ?? [];
      if (value.some((v) => !options.some((o) => o.value === v))) return messages.invalidOption;
      if (field.minSelected !== undefined && value.length < field.minSelected) {
        return format(messages.minSelected, { n: field.minSelected });
      }
      if (field.maxSelected !== undefined && value.length > field.maxSelected) {
        return format(messages.maxSelected, { n: field.maxSelected });
      }
      return undefined;
    }
    case 'date': {
      if (typeof value !== 'string' || !isValidDate(value)) return messages.invalidDate;
      if (typeof field.min === 'string' && value < field.min) {
        return format(messages.minDate, { n: formatDate(field.min, messages.locale) });
      }
      if (typeof field.max === 'string' && value > field.max) {
        return format(messages.maxDate, { n: formatDate(field.max, messages.locale) });
      }
      return undefined;
    }
    case 'custom':
      return nestedTooDeep(value) ? messages.invalidValue : undefined;
    default:
      return undefined;
  }
}

export async function runCustomValidator(
  validator: CustomValidator,
  value: unknown,
  values: FormValues,
): Promise<string | undefined> {
  if (isStandardSchema(validator)) {
    const result = await validator['~standard'].validate(value);
    return result.issues?.[0]?.message;
  }
  const message = await validator(value, values);
  return message || undefined;
}

/**
 * One validator for a name several fields share (one per `<When>` branch):
 * each field's own validator runs only while that field is the one shown.
 */
export function validatorForFields(
  fields: ReadonlyArray<{ when: readonly Condition[]; validator?: CustomValidator }>,
): CustomValidator | undefined {
  if (fields.length === 1) return fields[0]?.validator;
  if (!fields.some((f) => f.validator)) return undefined;
  return async (value, values) => {
    for (const { when, validator } of fields) {
      if (!validator || !evaluateAll(when, values)) continue;
      const message = await runCustomValidator(validator, value, values);
      if (message) return message;
    }
    return undefined;
  };
}

/** Each field's answer coerced to its type; unknown keys and empty answers left out. */
export function coerceValues(schema: FormSchema, raw: FormValues): FormValues {
  const out = new Map<string, unknown>();
  for (const field of schema.fields) {
    if (out.has(field.name)) continue;
    out.set(field.name, coerceValue(field, ownValue(raw, field.name)));
  }
  return Object.fromEntries([...out].filter(([, value]) => value !== undefined));
}

export type VisibleFields = {
  fields: FieldSchema[];
  values: FormValues;
};

function pick(values: FormValues, names: ReadonlySet<string>): FormValues {
  return Object.fromEntries(Object.entries(values).filter(([key]) => names.has(key)));
}

function sameNames(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean {
  return a.size === b.size && [...a].every((name) => b.has(name));
}

/**
 * Which fields are visible for these (coerced) values, and the values
 * restricted to them. A field is visible when its conditions hold on the
 * answers of the visible fields, so iterate to a fixed point: every round
 * re-reads the full answers, which lets a field hidden in one round return in
 * the next (`<When field="phone" empty>` once `phone` itself is hidden).
 */
export function resolveVisibleFields(schema: FormSchema, values: FormValues): VisibleFields {
  let names: ReadonlySet<string> = new Set(schema.fields.map((f) => f.name));
  let previous = names;
  // Without a cycle, each round settles at least one more level of nesting.
  const rounds = names.size + 2;
  for (let round = 0; round < rounds; round++) {
    const current = pick(values, names);
    const fields = schema.fields.filter((f) => evaluateAll(f.when, current));
    const next = new Set(fields.map((f) => f.name));
    if (sameNames(next, names)) return { fields, values: current };
    previous = names;
    names = next;
  }
  // Circular conditions that never settle: keep what the last two rounds agree on.
  const settled = new Set([...names].filter((name) => previous.has(name)));
  const fields = schema.fields.filter(
    (f) => settled.has(f.name) && evaluateAll(f.when, pick(values, settled)),
  );
  return { fields, values: pick(values, new Set(fields.map((f) => f.name))) };
}

/** Answers worth storing: filled ones, plus `false` where it's an answer (an unchecked box). */
function storedValues(schema: FormSchema, values: FormValues): FormValues {
  const types = new Map<string, FieldType>();
  for (const field of schema.fields) if (!types.has(field.name)) types.set(field.name, field.type);
  return Object.fromEntries(
    Object.entries(values).filter(([key, value]) => {
      if (isFilled(value)) return true;
      const type = types.get(key);
      return value === false && (type === 'checkbox' || type === 'custom');
    }),
  );
}

/** What the server stores for these raw answers: coerced, visible fields only. */
export function submissionValues(schema: FormSchema, raw: FormValues): FormValues {
  return storedValues(schema, resolveVisibleFields(schema, coerceValues(schema, raw)).values);
}

export type SubmissionValidation =
  | { ok: true; values: FormValues }
  | { ok: false; values: FormValues; errors: FieldErrors };

export type ValidateSubmissionOptions = {
  messages?: Messages;
  validators?: ReadonlyMap<string, CustomValidator>;
};

/** Coerce, drop hidden/unknown fields, then validate what remains. */
export async function validateSubmission(
  schema: FormSchema,
  raw: FormValues,
  opts: ValidateSubmissionOptions = {},
): Promise<SubmissionValidation> {
  const messages = opts.messages ?? getMessages('en');
  const { fields, values } = resolveVisibleFields(schema, coerceValues(schema, raw));
  const errors = new Map<string, string>();
  const customChecked = new Set<string>();
  for (const field of fields) {
    if (errors.has(field.name)) continue;
    const value = ownValue(values, field.name);
    const builtIn = validateField(field, value, messages);
    if (builtIn) {
      errors.set(field.name, builtIn);
      continue;
    }
    const custom = opts.validators?.get(field.name);
    if (custom && isFilled(value) && !customChecked.has(field.name)) {
      customChecked.add(field.name);
      const message = await runCustomValidator(custom, value, values);
      if (message) errors.set(field.name, message);
    }
  }

  const clean = storedValues(schema, values);
  if (errors.size > 0) return { ok: false, values: clean, errors: Object.fromEntries(errors) };
  return { ok: true, values: clean };
}
