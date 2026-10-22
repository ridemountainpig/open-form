import type { Condition, FieldCondition, FieldSchema, FormValues, Primitive } from './types.ts';

/** `record[key]` only when it's the record's own entry: a field named `constructor` isn't a function. */
export function ownValue(record: FormValues, key: string): unknown {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

export function isFilled(value: unknown): boolean {
  if (value === undefined || value === null || value === false) return false;
  if (typeof value === 'string') return value.trim() !== '';
  if (typeof value === 'number') return !Number.isNaN(value);
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

// Select values are strings while authors often write `equals={1}` or
// `equals={true}`, so primitives compare by their string form.
export function sameValue(actual: unknown, expected: Primitive): boolean {
  if (actual === expected) return true;
  if (expected === null) return !isFilled(actual);
  // An untouched checkbox has no value but reads as unticked.
  if (actual === null || actual === undefined) return expected === false;
  if (typeof actual === 'object') return false;
  return String(actual) === String(expected);
}

// A checkbox group's answer is the list of ticked options: it "equals" an
// option only when that's the one ticked, and is "in" a list when any ticked
// option is.
function isExactly(value: unknown, expected: Primitive): boolean {
  return Array.isArray(value)
    ? value.length === 1 && sameValue(value[0], expected)
    : sameValue(value, expected);
}

function hasAny(value: unknown, expected: Primitive): boolean {
  return Array.isArray(value) && expected !== null
    ? value.some((item) => sameValue(item, expected))
    : sameValue(value, expected);
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return Number.NaN;
}

function evaluateFieldCondition(cond: FieldCondition, values: FormValues): boolean {
  const value = ownValue(values, cond.field);

  if ('equals' in cond && cond.equals !== undefined) {
    if (!isExactly(value, cond.equals)) return false;
  }
  if ('notEquals' in cond && cond.notEquals !== undefined) {
    if (isExactly(value, cond.notEquals)) return false;
  }
  if (cond.in && !cond.in.some((expected) => hasAny(value, expected))) return false;
  if (cond.notIn?.some((expected) => hasAny(value, expected))) return false;
  if (cond.contains !== undefined) {
    const expected = cond.contains;
    if (Array.isArray(value)) {
      if (!value.some((item) => sameValue(item, expected))) return false;
    } else if (typeof value === 'string') {
      if (!value.includes(String(expected))) return false;
    } else {
      return false;
    }
  }
  if (cond.filled !== undefined && isFilled(value) !== cond.filled) return false;
  if (cond.empty !== undefined && isFilled(value) === cond.empty) return false;

  if (
    cond.gt !== undefined ||
    cond.gte !== undefined ||
    cond.lt !== undefined ||
    cond.lte !== undefined
  ) {
    const n = toNumber(value);
    if (Number.isNaN(n)) return false;
    if (cond.gt !== undefined && !(n > cond.gt)) return false;
    if (cond.gte !== undefined && !(n >= cond.gte)) return false;
    if (cond.lt !== undefined && !(n < cond.lt)) return false;
    if (cond.lte !== undefined && !(n <= cond.lte)) return false;
  }
  return true;
}

export function evaluateCondition(cond: Condition, values: FormValues): boolean {
  if ('all' in cond) return cond.all.every((c) => evaluateCondition(c, values));
  if ('any' in cond) return cond.any.some((c) => evaluateCondition(c, values));
  if ('not' in cond) return !evaluateCondition(cond.not, values);
  return evaluateFieldCondition(cond, values);
}

export function evaluateAll(conditions: readonly Condition[], values: FormValues): boolean {
  return conditions.every((c) => evaluateCondition(c, values));
}

/** Field names a condition reads — lets the runtime subscribe to only those values. */
export function conditionFields(cond: Condition, out: Set<string> = new Set()): Set<string> {
  if ('all' in cond) for (const c of cond.all) conditionFields(c, out);
  else if ('any' in cond) for (const c of cond.any) conditionFields(c, out);
  else if ('not' in cond) conditionFields(cond.not, out);
  else out.add(cond.field);
  return out;
}

/**
 * Answers worth trying when asking what a question can change: each option, a ticked
 * box, each score on a short scale. Other fields get one stand-in answer.
 */
export function sampleAnswers(field: FieldSchema): unknown[] {
  if (field.type === 'checkbox') return [true];
  if (field.type === 'checkbox-group') return (field.options ?? []).map((o) => [o.value]);
  if (field.type === 'select' || field.type === 'radio') {
    return (field.options ?? []).map((o) => o.value);
  }
  const { min, max } = field;
  if (typeof min === 'number' && typeof max === 'number' && max - min <= 10) {
    return Array.from({ length: Math.floor(max - min) + 1 }, (_, i) => min + i);
  }
  if (typeof min === 'number' || typeof max === 'number') {
    return [min, max].filter((n) => typeof n === 'number');
  }
  return [field.type === 'number' ? 0 : 'answer'];
}
