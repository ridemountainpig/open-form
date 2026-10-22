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

function operands(name: string, cond: Condition, out: Primitive[]): Primitive[] {
  if ('all' in cond) for (const c of cond.all) operands(name, c, out);
  else if ('any' in cond) for (const c of cond.any) operands(name, c, out);
  else if ('not' in cond) operands(name, cond.not, out);
  else if (cond.field === name) {
    out.push(
      ...[cond.equals, cond.notEquals, cond.contains, ...(cond.in ?? [])].filter(
        (v): v is Primitive => v !== undefined && v !== null,
      ),
    );
    out.push(...[cond.gte, cond.lte].filter((v): v is number => v !== undefined));
    if (cond.gt !== undefined) out.push(cond.gt + 1);
    if (cond.lt !== undefined) out.push(cond.lt - 1);
    const low = cond.gt ?? cond.gte;
    const high = cond.lt ?? cond.lte;
    if (low !== undefined && high !== undefined) out.push((low + high) / 2);
  }
  return out;
}

/**
 * Answers worth trying when asking what a question can change: each option, a ticked
 * box, each option and all of them in a group, each score on a short scale, and the values `conditions` compare it with.
 * Other fields get one stand-in answer.
 */
export function sampleAnswers(
  field: FieldSchema,
  conditions: readonly Condition[] = [],
): unknown[] {
  if (field.type === 'checkbox') return [true];
  if (field.type === 'checkbox-group') {
    const values = (field.options ?? []).map((o) => o.value);
    return [...values.map((v) => [v]), ...(values.length > 1 ? [values] : [])];
  }
  if (field.type === 'select' || field.type === 'radio') {
    return (field.options ?? []).map((o) => o.value);
  }
  const { min, max } = field;
  const numeric = field.type === 'number' || typeof min === 'number' || typeof max === 'number';
  const compared: unknown[] = [];
  for (const cond of conditions) {
    for (const v of operands(field.name, cond, [])) {
      if (!numeric) {
        compared.push(String(v));
        continue;
      }
      const n = Number(v);
      const below = typeof min === 'number' && n < min;
      const above = typeof max === 'number' && n > max;
      if (!Number.isNaN(n) && !below && !above) compared.push(n);
    }
  }
  let samples: unknown[];
  if (typeof min === 'number' && typeof max === 'number' && max - min <= 10) {
    const steps = Array.from({ length: Math.floor(max - min) + 1 }, (_, i) => min + i);
    samples = steps.at(-1) === max ? steps : [...steps, max];
  } else if (typeof min === 'number' || typeof max === 'number') {
    samples = [min, max].filter((n) => typeof n === 'number');
  } else {
    samples = [numeric ? 0 : 'answer'];
  }
  return [...new Set([...samples, ...compared])];
}

/**
 * The most steps a respondent may see, trying the answers each required question that
 * decides a hidden step could get (and the questions those reveal), so "1 / 3" doesn't
 * later become "1 / 4". Past `budget` evaluations, it's an estimate.
 */
export function mostVisibleSteps(
  steps: readonly { when: readonly Condition[] }[],
  fields: readonly FieldSchema[],
  values: FormValues,
  budget = 2000,
): number {
  const conditions = [...steps.flatMap((step) => step.when), ...fields.flatMap((f) => f.when)];
  const most = (values: FormValues): number => {
    const shown = steps.filter((step) => evaluateAll(step.when, values)).length;
    if (--budget < 0) return shown;
    // Every awaited question gets answered eventually, so trying them in one order
    // covers each combination once.
    // A question that's hidden until another is answered waits on that one first.
    const awaited = (names: Iterable<string>, seen: Set<string>): FieldSchema | undefined => {
      for (const name of names) {
        if (seen.has(name) || isFilled(ownValue(values, name))) continue;
        seen.add(name);
        for (const f of fields) {
          if (f.name !== name || !f.required) continue;
          if (evaluateAll(f.when, values)) return f;
          const before = awaited(
            f.when.flatMap((cond) => [...conditionFields(cond)]),
            seen,
          );
          if (before) return before;
        }
      }
    };
    let next: FieldSchema | undefined;
    for (const step of steps) {
      if (next) break;
      if (evaluateAll(step.when, values)) continue;
      next = awaited(
        step.when.flatMap((cond) => [...conditionFields(cond)]),
        new Set(),
      );
    }
    if (!next) return shown;
    const { name } = next;
    return Math.max(
      shown,
      ...sampleAnswers(next, conditions).map((v) => most({ ...values, [name]: v })),
    );
  };
  return most(values);
}
