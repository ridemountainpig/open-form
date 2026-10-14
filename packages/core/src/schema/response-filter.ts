import { isFilled, ownValue } from './conditions.ts';
import { isTimeZone, zonedInstant } from './time.ts';

// Studio's Responses filters. The storage adapters run them, so the rules are
// plain data that travel in a query string and are checked here on the way in.

export const RESPONSE_FILTER_OPS = [
  'contains',
  'notContains',
  'is',
  'isNot',
  'startsWith',
  'endsWith',
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'anyOf',
  'noneOf',
  'allOf',
  'checked',
  'unchecked',
  'on',
  'before',
  'after',
  'onOrBefore',
  'onOrAfter',
  'between',
  'pastDays',
  'empty',
  'notEmpty',
] as const;

export type ResponseFilterOp = (typeof RESPONSE_FILTER_OPS)[number];

/** What an operator compares against, which decides the value it needs. */
export type ResponseFilterValueKind =
  | 'text'
  | 'number'
  | 'options'
  | 'date'
  | 'range'
  | 'days'
  | 'none';

const VALUE_KIND: Record<ResponseFilterOp, ResponseFilterValueKind> = {
  contains: 'text',
  notContains: 'text',
  is: 'text',
  isNot: 'text',
  startsWith: 'text',
  endsWith: 'text',
  eq: 'number',
  neq: 'number',
  gt: 'number',
  gte: 'number',
  lt: 'number',
  lte: 'number',
  anyOf: 'options',
  noneOf: 'options',
  allOf: 'options',
  checked: 'none',
  unchecked: 'none',
  on: 'date',
  before: 'date',
  after: 'date',
  onOrBefore: 'date',
  onOrAfter: 'date',
  between: 'range',
  pastDays: 'days',
  empty: 'none',
  notEmpty: 'none',
};

export function responseFilterValueKind(op: ResponseFilterOp): ResponseFilterValueKind {
  return VALUE_KIND[op];
}

export type ResponseFilterRule = {
  /** The answer to test. Without it, the rule tests when the response was submitted. */
  field?: string;
  op: ResponseFilterOp;
  /** Text, a number, a `YYYY-MM-DD` day, or the number of days for `pastDays`. */
  value?: string | number;
  /** `anyOf`, `noneOf` and `allOf`: option values. */
  values?: string[];
  /** `between`: the last day, inclusive. */
  to?: string;
};

export type ResponseFilter = {
  /** `all` (the default): every rule must hold. `any`: one is enough. */
  match?: 'all' | 'any';
  rules: ResponseFilterRule[];
  /** Where the days of submission-time rules begin and end. Defaults to UTC. */
  timeZone?: string;
};

export const MAX_FILTER_RULES = 20;
const MAX_TEXT = 500;
const MAX_OPTIONS = 100;
const MAX_DAYS = 36_500;
const DAY_MS = 86_400_000;
const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})/;
const SUBMITTED_OPS = new Set<ResponseFilterOp>([
  'on',
  'before',
  'after',
  'onOrBefore',
  'onOrAfter',
  'between',
  'pastDays',
]);

function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 10) return false;
  const match = DAY_RE.exec(value);
  if (!match) return false;
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Why a rule can't run (unfinished in Studio, or malformed), or undefined when it can. */
export function responseFilterRuleProblem(rule: ResponseFilterRule): string | undefined {
  if (!RESPONSE_FILTER_OPS.includes(rule.op)) return `unknown operator ${JSON.stringify(rule.op)}`;
  if (rule.field === undefined) {
    if (!SUBMITTED_OPS.has(rule.op)) return `${rule.op} doesn't apply to the submission time`;
  } else if (typeof rule.field !== 'string' || !rule.field || rule.field.length > MAX_TEXT) {
    return 'field must be a field name';
  } else if (rule.op === 'pastDays') {
    return 'pastDays only applies to the submission time';
  }
  const { value, values, to } = rule;
  switch (VALUE_KIND[rule.op]) {
    case 'text':
      return typeof value === 'string' && value.trim() && value.length <= MAX_TEXT
        ? undefined
        : `${rule.op} needs some text`;
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
        ? undefined
        : `${rule.op} needs a number`;
    case 'options':
      return Array.isArray(values) &&
        values.length > 0 &&
        values.length <= MAX_OPTIONS &&
        values.every((v) => typeof v === 'string' && v.length <= MAX_TEXT)
        ? undefined
        : `${rule.op} needs one or more options`;
    case 'date':
      return isDay(value) ? undefined : `${rule.op} needs a YYYY-MM-DD day`;
    case 'range':
      return isDay(value) && isDay(to) && value <= to
        ? undefined
        : 'between needs two YYYY-MM-DD days, the earlier one first';
    case 'days':
      return Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_DAYS
        ? undefined
        : 'pastDays needs a whole number of days';
    case 'none':
      return undefined;
  }
}

/** Checks a filter that arrived as JSON. Throws with what's wrong. */
export function parseResponseFilter(input: unknown): ResponseFilter {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('filter must be an object with rules');
  }
  const { match, rules, timeZone } = input as Record<string, unknown>;
  if (match !== undefined && match !== 'all' && match !== 'any') {
    throw new Error('match must be "all" or "any"');
  }
  if (timeZone !== undefined && !isTimeZone(timeZone)) {
    throw new Error('timeZone must be an IANA time zone');
  }
  if (!Array.isArray(rules) || rules.length > MAX_FILTER_RULES) {
    throw new Error(`rules must list at most ${MAX_FILTER_RULES} rules`);
  }
  const parsed = rules.map((raw, index): ResponseFilterRule => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      throw new Error(`rule ${index + 1} must be an object`);
    }
    const { field, op, value, values, to } = raw as Record<string, unknown>;
    const rule = { field, op, value, values, to } as ResponseFilterRule;
    const problem = responseFilterRuleProblem(rule);
    if (problem) throw new Error(`rule ${index + 1}: ${problem}`);
    return Object.fromEntries(
      Object.entries(rule).filter(([, v]) => v !== undefined),
    ) as ResponseFilterRule;
  });
  return {
    match: match ?? 'all',
    rules: parsed,
    ...(timeZone ? { timeZone: timeZone as string } : {}),
  };
}

export type FilterableResponse = { data: Record<string, unknown>; createdAt: string };

/** Strings and numbers anywhere in an answer: a choice list's items, a custom field's parts. */
export function answerTexts(value: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof value === 'string') {
    if (value !== '') out.push(value);
  } else if (typeof value === 'number' && Number.isFinite(value)) {
    out.push(String(value));
  } else if (value && typeof value === 'object' && depth < 12) {
    for (const item of Object.values(value)) answerTexts(item, out, depth + 1);
  }
  return out;
}

function asNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function dayOf(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const day = value.slice(0, 10);
  return isDay(day) ? day : null;
}

function dayStart(day: string, timeZone: string, plusDays = 0): number {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  return zonedInstant(timeZone, y, m, d + plusDays);
}

type Test = (response: FilterableResponse) => boolean;

function answerTest(rule: ResponseFilterRule & { field: string }): Test {
  const field = rule.field;
  const text = typeof rule.value === 'string' ? rule.value.trim().toLowerCase() : '';
  const textTest = (pass: (atom: string) => boolean) => (answer: unknown) =>
    answerTexts(answer).some((atom) => pass(atom.toLowerCase()));
  const options = new Set(rule.values ?? []);
  const numeric = (pass: (n: number) => boolean) => (answer: unknown) => {
    const n = asNumber(answer);
    return Number.isFinite(n) && pass(n);
  };
  const dated = (pass: (day: string) => boolean) => (answer: unknown) => {
    const day = dayOf(answer);
    return day !== null && pass(day);
  };
  const number = rule.value as number;
  const day = rule.value as string;
  const tests: Record<ResponseFilterOp, (answer: unknown) => boolean> = {
    contains: textTest((a) => a.includes(text)),
    notContains: (a) => !textTest((atom) => atom.includes(text))(a),
    is: textTest((a) => a === text),
    isNot: (a) => !textTest((atom) => atom === text)(a),
    startsWith: textTest((a) => a.startsWith(text)),
    endsWith: textTest((a) => a.endsWith(text)),
    eq: numeric((n) => n === number),
    neq: (a) => !numeric((n) => n === number)(a),
    gt: numeric((n) => n > number),
    gte: numeric((n) => n >= number),
    lt: numeric((n) => n < number),
    lte: numeric((n) => n <= number),
    anyOf: (a) => answerTexts(a).some((atom) => options.has(atom)),
    noneOf: (a) => !answerTexts(a).some((atom) => options.has(atom)),
    allOf: (a) => {
      const given = new Set(answerTexts(a));
      return [...options].every((option) => given.has(option));
    },
    checked: (a) => a === true || a === 'true',
    unchecked: (a) => !(a === true || a === 'true'),
    on: dated((d) => d === day),
    before: dated((d) => d < day),
    after: dated((d) => d > day),
    onOrBefore: dated((d) => d <= day),
    onOrAfter: dated((d) => d >= day),
    between: dated((d) => d >= day && d <= (rule.to as string)),
    pastDays: () => false,
    empty: (a) => !isFilled(a),
    notEmpty: (a) => isFilled(a),
  };
  const test = tests[rule.op];
  return (response) => test(ownValue(response.data, field));
}

function submittedTest(rule: ResponseFilterRule, timeZone: string, now: number): Test {
  let from = Number.NEGATIVE_INFINITY;
  let until = Number.POSITIVE_INFINITY;
  const day = rule.value as string;
  switch (rule.op) {
    case 'on':
      from = dayStart(day, timeZone);
      until = dayStart(day, timeZone, 1);
      break;
    case 'before':
      until = dayStart(day, timeZone);
      break;
    case 'after':
      from = dayStart(day, timeZone, 1);
      break;
    case 'onOrBefore':
      until = dayStart(day, timeZone, 1);
      break;
    case 'onOrAfter':
      from = dayStart(day, timeZone);
      break;
    case 'between':
      from = dayStart(day, timeZone);
      until = dayStart(rule.to as string, timeZone, 1);
      break;
    case 'pastDays':
      from = now - (rule.value as number) * DAY_MS;
      break;
  }
  return ({ createdAt }) => {
    const at = Date.parse(createdAt);
    return at >= from && at < until;
  };
}

/** A test for one response. Runs `parseResponseFilter`'s checks first and throws like it. */
export function responseFilterTest(
  filter: ResponseFilter,
  now: number = Date.now(),
): (response: FilterableResponse) => boolean {
  const { rules, match, timeZone = 'UTC' } = parseResponseFilter(filter);
  const tests = rules.map((rule) =>
    rule.field === undefined
      ? submittedTest(rule, timeZone, now)
      : answerTest(rule as ResponseFilterRule & { field: string }),
  );
  if (tests.length === 0) return () => true;
  return match === 'any'
    ? (response) => tests.some((test) => test(response))
    : (response) => tests.every((test) => test(response));
}
