import { parse } from '@babel/parser';
import type {
  Expression,
  Node,
  ObjectExpression,
  ObjectProperty,
  Program,
  Statement,
} from '@babel/types';

// Edits values inside an object literal in a source file in place: only the
// touched values change, so comments, formatting and everything else survive.

/** `null` removes the property. */
export type SourceValue = string | number | boolean | null;

export type FindObject = (program: Program) => ObjectExpression;

export function parseProgram(source: string): Program {
  return parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] }).program;
}

function unwrap(node: Node | null | undefined): Node | null | undefined {
  let current = node;
  while (
    current &&
    (current.type === 'TSAsExpression' ||
      current.type === 'TSSatisfiesExpression' ||
      current.type === 'ParenthesizedExpression')
  ) {
    current = current.expression;
  }
  return current;
}

/** The object literal `node` evaluates to: itself, `define…({ … })`, or a `const` it names. */
export function resolveObject(
  program: Program,
  node: Node | null | undefined,
): ObjectExpression | null {
  const n = unwrap(node);
  if (!n) return null;
  if (n.type === 'ObjectExpression') return n;
  if (n.type === 'CallExpression') {
    return resolveObject(program, n.arguments[0] as Expression | undefined);
  }
  if (n.type === 'Identifier') {
    const init = constInit(program, n.name);
    return init ? resolveObject(program, init) : null;
  }
  return null;
}

/** The initializer of a top-level `const <name> = …`, exported or not. */
export function constInit(program: Program, name: string): Node | null {
  for (const statement of program.body as Statement[]) {
    const decl = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
    if (decl?.type !== 'VariableDeclaration') continue;
    for (const d of decl.declarations) {
      if (d.id.type === 'Identifier' && d.id.name === name) return d.init ?? null;
    }
  }
  return null;
}

function propertyName(prop: ObjectProperty): string | null {
  if (prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'StringLiteral') return prop.key.value;
  return null;
}

export function findProperty(object: ObjectExpression, name: string): ObjectProperty | undefined {
  for (const prop of object.properties) {
    if (prop.type === 'ObjectProperty' && propertyName(prop) === name) return prop;
  }
  return undefined;
}

export type Edit = { start: number; end: number; text: string };

// Match the delimiter the object already uses for its string values (counting
// raw quote characters would be fooled by font names like '"Inter", sans-serif').
function quoteFor(source: string, object: ObjectExpression): string {
  const stack: Node[] = [object];
  while (stack.length) {
    const node = stack.shift() as Node;
    if (node.type === 'StringLiteral') return source[node.start ?? 0] === '"' ? '"' : "'";
    if (node.type === 'ObjectExpression') {
      for (const prop of node.properties)
        if (prop.type === 'ObjectProperty') stack.push(prop.value);
    }
  }
  return "'";
}

/** A JS string literal in `quote`, with backslashes, quotes and line breaks escaped. */
export function stringLiteral(value: string, quote: string): string {
  const json = JSON.stringify(value).slice(1, -1);
  const body = quote === '"' ? json : json.replace(/\\"/g, '"').replaceAll(quote, `\\${quote}`);
  return `${quote}${body}${quote}`;
}

function literal(value: Exclude<SourceValue, null>, quote: string): string {
  return typeof value === 'string' ? stringLiteral(value, quote) : String(value);
}

function lineIndent(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1;
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? '';
}

const oneLine = (source: string, node: Node) =>
  !source.slice(node.start ?? 0, node.end ?? 0).includes('\n');

export function insertProperty(source: string, object: ObjectExpression, text: string): Edit {
  const end = object.end ?? 0;
  const last = object.properties.at(-1);
  if (!last) {
    const indent = `${lineIndent(source, object.start ?? 0)}  `;
    return {
      start: (object.start ?? 0) + 1,
      end: end - 1,
      text: `\n${indent}${text},\n${lineIndent(source, object.start ?? 0)}`,
    };
  }
  // A one-line object stays on one line: `{ primary: '#111', background: '#fff' }`.
  if (oneLine(source, object))
    return { start: last.end ?? 0, end: last.end ?? 0, text: `, ${text}` };
  const indent = lineIndent(source, last.start ?? 0);
  const between = source.slice(last.end ?? 0, end - 1);
  const comma = between.indexOf(',');
  if (comma !== -1) {
    const at = (last.end ?? 0) + comma + 1;
    return { start: at, end: at, text: `\n${indent}${text},` };
  }
  return { start: last.end ?? 0, end: last.end ?? 0, text: `,\n${indent}${text}` };
}

function removeProperty(source: string, prop: ObjectProperty): Edit {
  let end = prop.end ?? 0;
  const after = /^[ \t]*,/.exec(source.slice(end));
  if (after) end += after[0].length;
  let start = prop.start ?? 0;
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  if (/^[ \t]*$/.test(source.slice(lineStart, start))) start = lineStart;
  if (source[end] === '\n' && start === lineStart) end += 1;
  return { start, end, text: '' };
}

export function apply(source: string, edit: Edit): string {
  return source.slice(0, edit.start) + edit.text + source.slice(edit.end);
}

/**
 * Set (or with `null`, remove) the value at `path` inside the object `find`
 * locates. One edit against a fresh parse keeps offsets trivially correct.
 */
export function setPath(
  source: string,
  find: FindObject,
  path: string[],
  value: SourceValue,
): string {
  let object = find(parseProgram(source));
  const quote = quoteFor(source, object);
  for (const [i, key] of path.slice(0, -1).entries()) {
    const prop = findProperty(object, key);
    const valueNode = unwrap(prop?.value);
    if (!prop) {
      if (value === null) return source;
      const nested = path
        .slice(i + 1)
        .reduceRight<string>((acc, k) => `{ ${k}: ${acc} }`, literal(value, quote));
      return apply(source, insertProperty(source, object, `${key}: ${nested}`));
    }
    if (valueNode?.type !== 'ObjectExpression') {
      if (value === null) return source;
      if (valueNode?.type === 'BooleanLiteral' || valueNode?.type === 'NullLiteral') {
        const indent = lineIndent(source, prop.start ?? 0);
        const text = `{\n${indent}  ${path.at(-1)}: ${literal(value, quote)},\n${indent}}`;
        return apply(source, { start: valueNode.start ?? 0, end: valueNode.end ?? 0, text });
      }
      throw new Error(
        `\`${path.slice(0, i + 1).join('.')}\` isn't a plain object in the source — edit it by hand.`,
      );
    }
    object = valueNode;
  }

  const key = path.at(-1) as string;
  const prop = findProperty(object, key);
  if (value === null) return prop ? apply(source, removeProperty(source, prop)) : source;
  if (!prop)
    return apply(source, insertProperty(source, object, `${key}: ${literal(value, quote)}`));
  const node = prop.value;
  const original = source.slice(node.start ?? 0, node.end ?? 0);
  const keepQuote = /^['"]/.test(original) ? (original[0] as string) : quote;
  return apply(source, {
    start: node.start ?? 0,
    end: node.end ?? 0,
    text: literal(value, keepQuote),
  });
}

/** Remove the property at `path` if its value is an empty object literal. */
export function dropIfEmpty(source: string, find: FindObject, path: string[]): string {
  let object = find(parseProgram(source));
  let prop: ObjectProperty | undefined;
  for (const key of path) {
    prop = findProperty(object, key);
    const value = unwrap(prop?.value);
    if (value?.type !== 'ObjectExpression') return source;
    object = value;
  }
  if (!prop || object.properties.length > 0) return source;
  return apply(source, removeProperty(source, prop));
}
