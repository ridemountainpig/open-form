import { format, type Locale } from './messages.ts';
import type { Condition, FieldCondition, FormSchema, Primitive } from './types.ts';

/** The form's own words for its fields and options, used by `explainCondition`. */
export type ConditionNames = {
  field?(name: string): string | undefined;
  option?(field: string, value: Primitive): string | undefined;
};

/** Code-like, for the CLI and agents: `nps ≤ 6`, `role in ["student"]`. */
export function describeCondition(cond: Condition): string {
  if ('all' in cond) return cond.all.map(describeCondition).join(' and ');
  if ('any' in cond) return `(${cond.any.map(describeCondition).join(' or ')})`;
  if ('not' in cond) return `not (${describeCondition(cond.not)})`;
  const q = (v: Primitive) => JSON.stringify(v);
  const parts: string[] = [];
  if (cond.equals !== undefined) parts.push(`= ${q(cond.equals)}`);
  if (cond.notEquals !== undefined) parts.push(`≠ ${q(cond.notEquals)}`);
  if (cond.in) parts.push(`in ${JSON.stringify(cond.in)}`);
  if (cond.notIn) parts.push(`not in ${JSON.stringify(cond.notIn)}`);
  if (cond.contains !== undefined) parts.push(`contains ${q(cond.contains)}`);
  if (cond.filled) parts.push('is filled');
  if (cond.filled === false || cond.empty) parts.push('is empty');
  if (cond.gt !== undefined) parts.push(`> ${cond.gt}`);
  if (cond.gte !== undefined) parts.push(`≥ ${cond.gte}`);
  if (cond.lt !== undefined) parts.push(`< ${cond.lt}`);
  if (cond.lte !== undefined) parts.push(`≤ ${cond.lte}`);
  return `${cond.field} ${parts.join(', ')}`;
}

type Phrases = {
  quote: [string, string];
  group: string;
  is: string;
  isNot: string;
  checked: string;
  unchecked: string;
  includes: string;
  answered: string;
  blank: string;
  not: string;
  and: string;
  or: string;
};

const PHRASES: Record<Locale, Phrases> = {
  en: {
    quote: ['“', '”'],
    group: '({condition})',
    is: '{field} is {value}',
    isNot: '{field} is not {value}',
    checked: '{field} is checked',
    unchecked: '{field} is not checked',
    includes: '{field} includes {value}',
    answered: '{field} is answered',
    blank: '{field} is not answered',
    not: 'not ({condition})',
    and: ' and ',
    or: ' or ',
  },
  'zh-TW': {
    quote: ['「', '」'],
    group: '（{condition}）',
    is: '{field}是{value}',
    isNot: '{field}不是{value}',
    checked: '{field}有勾選',
    unchecked: '{field}沒有勾選',
    includes: '{field}包含{value}',
    answered: '{field}有填寫',
    blank: '{field}沒有填寫',
    not: '不符合（{condition}）',
    and: '且',
    or: '或',
  },
  'zh-CN': {
    quote: ['“', '”'],
    group: '（{condition}）',
    is: '{field}是{value}',
    isNot: '{field}不是{value}',
    checked: '{field}已勾选',
    unchecked: '{field}未勾选',
    includes: '{field}包含{value}',
    answered: '{field}已填写',
    blank: '{field}未填写',
    not: '不符合（{condition}）',
    and: '且',
    or: '或',
  },
  ja: {
    quote: ['「', '」'],
    group: '（{condition}）',
    is: '{field}が{value}',
    isNot: '{field}が{value}以外',
    checked: '{field}にチェックあり',
    unchecked: '{field}にチェックなし',
    includes: '{field}に{value}を含む',
    answered: '{field}に回答あり',
    blank: '{field}が未回答',
    not: '（{condition}）ではない',
    and: 'かつ',
    or: 'または',
  },
};

/**
 * A sentence for people, in the form's words: `“Pass” is “Builder” or
 * “Patron”`. A list of conditions must all hold, like a step's `when`.
 */
export function explainCondition(
  conditions: Condition | readonly Condition[],
  names: ConditionNames,
  locale: Locale,
): string {
  const p = PHRASES[locale];
  const quote = (text: string) => `${p.quote[0]}${text}${p.quote[1]}`;
  const either = new Intl.ListFormat(locale, { type: 'disjunction' });

  const field = (cond: FieldCondition) => {
    const subject = quote(names.field?.(cond.field) ?? cond.field);
    const value = (v: Primitive) => quote(names.option?.(cond.field, v) ?? String(v));
    const say = (template: string, v?: string) =>
      format(template, { field: subject, value: v ?? '' });
    const parts: string[] = [];
    if (cond.equals === true || cond.notEquals === false) parts.push(say(p.checked));
    else if (cond.equals === false || cond.notEquals === true) parts.push(say(p.unchecked));
    else {
      if (cond.equals !== undefined) parts.push(say(p.is, value(cond.equals)));
      if (cond.notEquals !== undefined) parts.push(say(p.isNot, value(cond.notEquals)));
    }
    if (cond.in) parts.push(say(p.is, either.format(cond.in.map(value))));
    if (cond.notIn) parts.push(say(p.isNot, either.format(cond.notIn.map(value))));
    if (cond.contains !== undefined) parts.push(say(p.includes, value(cond.contains)));
    if (cond.filled) parts.push(say(p.answered));
    if (cond.filled === false || cond.empty) parts.push(say(p.blank));
    for (const [op, bound] of [
      ['>', cond.gt],
      ['≥', cond.gte],
      ['<', cond.lt],
      ['≤', cond.lte],
    ] as const) {
      if (bound !== undefined) parts.push(`${subject} ${op} ${bound}`);
    }
    return parts.join(p.and);
  };

  const explain = (cond: Condition, nested: boolean): string => {
    if ('field' in cond) return field(cond);
    if ('not' in cond) return format(p.not, { condition: explain(cond.not, false) });
    const [list, joiner] = 'all' in cond ? [cond.all, p.and] : [cond.any, p.or];
    if (list.length === 1 && list[0]) return explain(list[0], nested);
    const text = list.map((c) => explain(c, true)).join(joiner);
    return nested ? format(p.group, { condition: text }) : text;
  };

  const list = (Array.isArray(conditions) ? conditions : [conditions]) as readonly Condition[];
  return explain(list.length === 1 && list[0] ? list[0] : { all: [...list] }, false);
}

/** Names from a form's schema: each field's label, each option's label. */
export function schemaNames(
  schema: Pick<FormSchema, 'fields'> | undefined,
  tr: (text: string) => string = (text) => text,
): ConditionNames {
  const fields = new Map((schema?.fields ?? []).map((f) => [f.name, f]));
  return {
    field: (name) => {
      const label = fields.get(name)?.label;
      return label ? tr(label) : undefined;
    },
    option: (name, value) => {
      const label = fields.get(name)?.options?.find((o) => o.value === String(value))?.label;
      return label ? tr(label) : undefined;
    },
  };
}
