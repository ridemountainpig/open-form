import type { ObjectExpression, Program } from '@babel/types';
import {
  apply,
  constInit,
  findProperty,
  insertProperty,
  parseProgram,
  resolveObject,
  setPath,
} from './source-object.ts';

// A form's `translations` are keyed by its source text, so renaming that text
// in Studio carries each table's entry along. Tables are either imported JSON
// (`import zhTW from './locales/zh-TW.json'`) or object literals in the source.

export type TranslationTable =
  | { locale: string; kind: 'json'; specifier: string }
  | { locale: string; kind: 'inline' };

function tablesObject(program: Program): ObjectExpression | null {
  const config = resolveObject(program, constInit(program, 'config'));
  const prop = config && findProperty(config, 'translations');
  return prop ? resolveObject(program, prop.value) : null;
}

function localeObject(program: Program, locale: string): ObjectExpression | null {
  const tables = tablesObject(program);
  const prop = tables && findProperty(tables, locale);
  return prop ? resolveObject(program, prop.value) : null;
}

function importOf(program: Program, local: string): string | null {
  for (const statement of program.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    for (const spec of statement.specifiers) {
      if (spec.type === 'ImportDefaultSpecifier' && spec.local.name === local) {
        return statement.source.value;
      }
    }
  }
  return null;
}

/** The translation tables `config.translations` names, in the form's index source. */
export function translationTables(source: string): TranslationTable[] {
  let program: Program;
  try {
    program = parseProgram(source);
  } catch {
    return [];
  }
  const tables = tablesObject(program);
  if (!tables) return [];
  const out: TranslationTable[] = [];
  for (const prop of tables.properties) {
    if (prop.type !== 'ObjectProperty' || prop.computed) continue;
    const locale =
      prop.key.type === 'Identifier'
        ? prop.key.name
        : prop.key.type === 'StringLiteral'
          ? prop.key.value
          : null;
    if (!locale) continue;
    if (prop.value.type === 'Identifier') {
      const specifier = importOf(program, prop.value.name);
      if (specifier?.endsWith('.json')) {
        out.push({ locale, kind: 'json', specifier });
        continue;
      }
    }
    if (resolveObject(program, prop.value)) out.push({ locale, kind: 'inline' });
  }
  return out;
}

function inlineEntry(source: string, locale: string, key: string) {
  const program = parseProgram(source);
  const object = localeObject(program, locale);
  const prop = object && findProperty(object, key);
  return { object, prop };
}

export function inlineTranslation(source: string, locale: string, key: string): string | null {
  const { prop } = inlineEntry(source, locale, key);
  return prop?.value.type === 'StringLiteral' ? prop.value.value : null;
}

export function setInlineTranslation(
  source: string,
  locale: string,
  key: string,
  value: string,
): string {
  const { prop } = inlineEntry(source, locale, key);
  if (prop?.value.type !== 'StringLiteral') {
    throw new Error(`Add "${key}" to the ${locale} translations in the source first.`);
  }
  return setPath(
    source,
    (program) => localeObject(program, locale) as ObjectExpression,
    [key],
    value,
  );
}

const quoted = (text: string) => `'${text.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

/** Move an inline entry to `to` — or with `keepOld`, copy it there. */
export function renameInlineKey(
  source: string,
  locale: string,
  from: string,
  to: string,
  keepOld: boolean,
): string {
  const { object, prop } = inlineEntry(source, locale, from);
  if (!object || !prop || findProperty(object, to)) return source;
  if (!keepOld) {
    return apply(source, { start: prop.key.start ?? 0, end: prop.key.end ?? 0, text: quoted(to) });
  }
  const value = source.slice(prop.value.start ?? 0, prop.value.end ?? 0);
  return apply(source, insertProperty(source, object, `${quoted(to)}: ${value}`));
}

function parseJson(json: string): Record<string, unknown> {
  const data = JSON.parse(json) as unknown;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('A translation file must hold one JSON object.');
  }
  return data as Record<string, unknown>;
}

function stringify(data: Record<string, unknown>, like: string): string {
  const indent = /\n([ \t]+)"/.exec(like)?.[1] ?? '  ';
  return `${JSON.stringify(data, null, indent)}${like.endsWith('\n') ? '\n' : ''}`;
}

export function jsonTranslation(json: string, key: string): string | null {
  const value = parseJson(json)[key];
  return typeof value === 'string' ? value : null;
}

export function setJsonTranslation(json: string, key: string, value: string): string {
  const data = parseJson(json);
  data[key] = value;
  return stringify(data, json);
}

/** Move an entry to `to` in place — or with `keepOld`, copy it there. */
export function renameJsonKey(json: string, from: string, to: string, keepOld: boolean): string {
  const data = parseJson(json);
  if (!(from in data) || to in data) return json;
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (key !== from || keepOld) next[key] = value;
    if (key === from) next[to] = value;
  }
  return stringify(next, json);
}
