import { type FormConfig, formTimeZone, type SubmissionPolicy } from './config.ts';
import { isTimeZone, policyInstant } from './time.ts';

/** The part of a submission policy Studio can change: when a form takes responses, and how many. */
export type Schedule = {
  opensAt: string | null;
  closesAt: string | null;
  maxResponses: number | null;
  closed: boolean;
};

/** Studio's changes to a form's code policy. `null` clears the code's value. */
export type SubmissionOverrides = {
  opensAt?: string | null;
  closesAt?: string | null;
  maxResponses?: number | null;
  closed?: boolean;
};

export type FormOverrides = {
  submissions?: SubmissionOverrides;
  /** Read the policy dates in this IANA zone instead of the code's. */
  timeZone?: string;
};

/** The zone a form's policy dates are read in: Studio's override, else the form's, else the project's. */
export function overriddenTimeZone(
  config: FormConfig | undefined,
  overrides: FormOverrides | null | undefined,
  projectTimeZone: string | undefined,
): string {
  return overrides?.timeZone ?? formTimeZone(config, projectTimeZone);
}

const KEYS = ['opensAt', 'closesAt', 'maxResponses', 'closed'] as const;
const MAX_RESPONSES_LIMIT = 1_000_000_000;

export function scheduleOf(policy: SubmissionPolicy | undefined): Schedule {
  const date = (value: string | Date | undefined) =>
    value === undefined ? null : value instanceof Date ? value.toISOString() : value;
  return {
    opensAt: date(policy?.opensAt),
    closesAt: date(policy?.closesAt),
    maxResponses: policy?.maxResponses ?? null,
    closed: policy?.closed === true,
  };
}

export function applyOverrides(
  policy: SubmissionPolicy | undefined,
  overrides: SubmissionOverrides | null | undefined,
): SubmissionPolicy | undefined {
  if (!overrides) return policy;
  const merged: Record<string, unknown> = { ...policy };
  for (const key of KEYS) {
    if (!(key in overrides)) continue;
    const value = overrides[key];
    if (value === null || value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return merged as SubmissionPolicy;
}

/** Check a schedule sent by Studio; throws a message fit to show next to the form. */
export function parseSchedule(input: unknown, timeZone: string): Schedule {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new Error('Schedule must be an object.');
  }
  const body = input as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!(KEYS as readonly string[]).includes(key)) throw new Error(`Unknown setting "${key}".`);
  }
  const date = (key: 'opensAt' | 'closesAt', edge: 'start' | 'end') => {
    const value = body[key];
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || value.length > 64) throw new Error(`${key} must be a date.`);
    policyInstant(value, timeZone, edge);
    return value;
  };
  const opensAt = date('opensAt', 'start');
  const closesAt = date('closesAt', 'end');
  if (
    opensAt &&
    closesAt &&
    policyInstant(opensAt, timeZone, 'start') > policyInstant(closesAt, timeZone, 'end')
  ) {
    throw new Error('The closing time is before the opening time.');
  }
  const max = body.maxResponses;
  if (
    max !== undefined &&
    max !== null &&
    (typeof max !== 'number' || !Number.isInteger(max) || max < 1 || max > MAX_RESPONSES_LIMIT)
  ) {
    throw new Error('maxResponses must be a whole number of at least 1.');
  }
  if (body.closed !== undefined && typeof body.closed !== 'boolean') {
    throw new Error('closed must be true or false.');
  }
  return {
    opensAt,
    closesAt,
    maxResponses: (max as number | null | undefined) ?? null,
    closed: body.closed === true,
  };
}

/** The zone Studio asked for, else `fallback`. Throws a message fit to show next to the form. */
export function parseTimeZone(input: unknown, fallback: string): string {
  if (input === undefined || input === null || input === '') return fallback;
  if (!isTimeZone(input)) throw new Error('timeZone must be an IANA time zone, e.g. Asia/Taipei.');
  return input;
}

/**
 * A schedule sent by Studio (`{ submissions, timeZone }`) as changes to the code.
 * Dates compare in the zone they will be read in, so changing only the zone
 * keeps the code's wall-clock dates and moves them with it.
 */
export function scheduleEdit(
  body: { submissions?: unknown; timeZone?: unknown },
  code: { policy: SubmissionPolicy | undefined; timeZone: string },
): FormOverrides {
  const timeZone = parseTimeZone(body.timeZone, code.timeZone);
  const submissions = scheduleChanges(
    code.policy,
    parseSchedule(body.submissions, timeZone),
    timeZone,
  );
  return {
    ...(Object.keys(submissions).length > 0 ? { submissions } : {}),
    ...(timeZone !== code.timeZone ? { timeZone } : {}),
  };
}

/** What `next` changes relative to the code's policy, key by key. Dates compare as instants. */
export function scheduleChanges(
  policy: SubmissionPolicy | undefined,
  next: Schedule,
  timeZone: string,
): SubmissionOverrides {
  const current = scheduleOf(policy);
  const changes: SubmissionOverrides = {};
  const sameDate = (a: string | null, b: string | null, edge: 'start' | 'end') =>
    a === b ||
    (a !== null &&
      b !== null &&
      policyInstant(a, timeZone, edge) === policyInstant(b, timeZone, edge));
  if (!sameDate(current.opensAt, next.opensAt, 'start')) changes.opensAt = next.opensAt;
  if (!sameDate(current.closesAt, next.closesAt, 'end')) changes.closesAt = next.closesAt;
  if (current.maxResponses !== next.maxResponses) changes.maxResponses = next.maxResponses;
  if (current.closed !== next.closed) changes.closed = next.closed;
  return changes;
}
