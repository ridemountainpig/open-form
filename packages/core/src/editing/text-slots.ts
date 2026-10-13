import type { Node, ObjectProperty } from '@babel/types';
import { parseSource } from './loc-tags.ts';

// The words a respondent reads, found where they are written so Studio can
// edit them in place: label="…" and friends, text between tags, and the same
// keys in object literals (`config`, `{ value, label }` options). Strings that
// double as values — `options={['Student']}`, `equals="Student"` — are left out,
// since renaming them would change the data.

export const TEXT_KEYS = new Set([
  'label',
  'description',
  'title',
  'placeholder',
  'unit',
  'lowLabel',
  'highLabel',
  'message',
  'patternMessage',
  'closedMessage',
  'fullMessage',
  'duplicateMessage',
]);

const MAX_LENGTH = 2000;

type Kind = 'attribute' | 'string' | 'template' | 'jsx-text';

export type TextSlot = {
  /** Where the text is written (1-based, like the dev server's `data-of-loc`). */
  line: number;
  column: number;
  /** `label`, `title`, … or `children` for text between tags; `success.title` in `config`. */
  key: string;
  /** The element the text belongs to (`Text`, `Page`), or `config`. */
  owner: string;
  /** What a comment about this text sits above: its element, or its property in `config`. */
  anchor: { line: number; column: number };
  value: string;
  /** Source offsets of the literal, quotes included. */
  start: number;
  end: number;
  kind: Kind;
};

type Located = { start: number; end: number; loc: { start: { line: number; column: number } } };

const at = (node: Node) => {
  const { line, column } = (node as unknown as Located).loc.start;
  return { line, column: column + 1 };
};

/** How text reads once rendered: runs of whitespace are one space. */
export const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();

function tagName(name: Node): string {
  if (name.type === 'JSXIdentifier') return name.name;
  if (name.type === 'JSXMemberExpression') return `${tagName(name.object)}.${name.property.name}`;
  if (name.type === 'JSXNamespacedName') return `${name.namespace.name}:${name.name.name}`;
  return '';
}

function keyName(prop: ObjectProperty): string | null {
  if (prop.computed) return null;
  if (prop.key.type === 'Identifier') return prop.key.name;
  if (prop.key.type === 'StringLiteral') return prop.key.value;
  return null;
}

/** A string literal, or a template literal with no `${}`. */
function stringValue(node: Node | null | undefined): { value: string; kind: Kind } | null {
  if (node?.type === 'StringLiteral') return { value: node.value, kind: 'string' };
  if (node?.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return { value: node.quasis[0]?.value.cooked ?? '', kind: 'template' };
  }
  return null;
}

function children(node: Node): Node[] {
  const out: Node[] = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
    if (key === 'innerComments' || key === 'extra') continue;
    if (Array.isArray(value)) {
      for (const item of value) if (item && typeof item.type === 'string') out.push(item);
    } else if (value && typeof value === 'object' && typeof value.type === 'string') {
      out.push(value as Node);
    }
  }
  return out;
}

/** The top-level `const config = …` declarator's initializer, if any. */
function isConfigDeclarator(node: Node): boolean {
  return (
    node.type === 'VariableDeclarator' && node.id.type === 'Identifier' && node.id.name === 'config'
  );
}

/** Every editable piece of text in a form source file. */
export function findTextSlots(source: string): TextSlot[] {
  const slots: TextSlot[] = [];
  const ast = parseSource(source);

  const visit = (node: Node, ancestors: Node[]) => {
    const parent = ancestors.at(-1);
    const element = [...ancestors].reverse().find((a) => a.type === 'JSXElement');
    const elementName =
      element?.type === 'JSXElement' ? tagName(element.openingElement.name) : undefined;

    if (node.type === 'JSXAttribute' && node.name.type === 'JSXIdentifier') {
      const key = node.name.name;
      const value =
        node.value?.type === 'JSXExpressionContainer' ? node.value.expression : node.value;
      const found = stringValue(value as Node | null);
      if (TEXT_KEYS.has(key) && found && value && element) {
        slots.push({
          ...at(value),
          key,
          owner: elementName ?? '',
          anchor: at(element),
          value: found.value,
          start: value.start ?? 0,
          end: value.end ?? 0,
          kind: node.value?.type === 'StringLiteral' ? 'attribute' : found.kind,
        });
      }
    } else if (node.type === 'JSXText' && parent?.type === 'JSXElement' && element) {
      const value = normalizeText(node.value);
      if (value) {
        slots.push({
          ...at(node),
          key: 'children',
          owner: elementName ?? '',
          anchor: at(element),
          value,
          start: node.start ?? 0,
          end: node.end ?? 0,
          kind: 'jsx-text',
        });
      }
    } else if (node.type === 'JSXExpressionContainer' && parent?.type === 'JSXElement' && element) {
      const found = stringValue(node.expression as Node);
      if (found && normalizeText(found.value)) {
        slots.push({
          ...at(node.expression),
          key: 'children',
          owner: elementName ?? '',
          anchor: at(element),
          value: found.value,
          start: node.expression.start ?? 0,
          end: node.expression.end ?? 0,
          kind: found.kind,
        });
      }
    } else if (node.type === 'ObjectProperty') {
      const key = keyName(node);
      const found = stringValue(node.value);
      // Translation tables map text to text; they aren't the text itself.
      const path = objectPath(ancestors, node);
      if (key && TEXT_KEYS.has(key) && found && path && !path.includes('translations')) {
        const inConfig = path[0] === '#config';
        slots.push({
          ...at(node.value),
          key: inConfig ? path.slice(1).join('.') : key,
          owner: inConfig ? 'config' : (elementName ?? ''),
          anchor: inConfig || !element ? at(node) : at(element),
          value: found.value,
          start: node.value.start ?? 0,
          end: node.value.end ?? 0,
          kind: found.kind,
        });
      }
    }

    const next = [...ancestors, node];
    for (const child of children(node)) visit(child, next);
  };

  visit(ast.program as unknown as Node, []);
  return slots;
}

/** Keys from the nearest root object to `prop`, `#config` first inside `const config`. */
function objectPath(ancestors: Node[], prop: ObjectProperty): string[] | null {
  const path = [keyName(prop) ?? '?'];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const node = ancestors[i] as Node;
    if (node.type === 'ObjectProperty') path.unshift(keyName(node) ?? '?');
    if (isConfigDeclarator(node)) return ['#config', ...path];
    if (node.type === 'JSXElement' || node.type === 'Program') return path;
  }
  return path;
}

type JsxRange = { name: string; start: number; end: number; line: number; column: number };

function elementAt(source: string, line: number, column: number): JsxRange | null {
  let found: JsxRange | null = null;
  const visit = (node: Node) => {
    if (found) return;
    if (node.type === 'JSXElement') {
      const pos = at(node);
      if (pos.line === line && pos.column === column) {
        found = {
          name: tagName(node.openingElement.name),
          start: node.start ?? 0,
          end: node.end ?? 0,
          ...pos,
        };
        return;
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(parseSource(source).program as unknown as Node);
  return found;
}

/**
 * The slots showing `text`: those inside the element at `line:column` first,
 * then anywhere in the file (a `<Form>`'s title lives in `config`).
 */
export function slotsForText(
  source: string,
  where: { line: number; column: number } | null,
  text: string,
): TextSlot[] {
  const wanted = normalizeText(text);
  if (!wanted) return [];
  const matches = findTextSlots(source).filter((slot) => normalizeText(slot.value) === wanted);
  const element = where && elementAt(source, where.line, where.column);
  if (element) {
    const inside = matches.filter((s) => s.start >= element.start && s.end <= element.end);
    if (inside.length > 0) return inside;
  }
  return matches;
}

/** The text an element shows itself: its props and children, and for `<Form>` the config's. */
export function slotsOfElement(source: string, line: number, column: number): TextSlot[] {
  const element = elementAt(source, line, column);
  if (!element) return [];
  const slots = findTextSlots(source);
  const own = slots.filter((s) => s.anchor.line === line && s.anchor.column === column);
  if (element.name !== 'Form') return own;
  const fromConfig = slots.filter(
    (s) => s.owner === 'config' && (s.key === 'title' || s.key === 'description'),
  );
  return [...fromConfig.filter((s) => !own.some((o) => o.key === s.key)), ...own];
}

/** One line of text, as it can be written into the source. */
export function cleanText(text: unknown): string {
  if (typeof text !== 'string') throw new Error('Text must be a string.');
  const clean = normalizeText(text);
  if (!clean) throw new Error('Text is empty — delete it in the code, or leave a comment.');
  if (clean.length > MAX_LENGTH) throw new Error(`Keep text under ${MAX_LENGTH} characters.`);
  return clean;
}

const jsString = (value: string, quote: string) =>
  `${quote}${value.replace(/\\/g, '\\\\').replaceAll(quote, `\\${quote}`)}${quote}`;

function written(slot: TextSlot, value: string, original: string): string {
  switch (slot.kind) {
    case 'attribute': {
      // JSX attribute strings have no escapes and decode `&…;` entities.
      if (value.includes('&')) return `{${jsString(value, "'")}}`;
      const quote = original[0] === "'" ? "'" : '"';
      if (!value.includes(quote)) return `${quote}${value}${quote}`;
      const other = quote === '"' ? "'" : '"';
      return value.includes(other) ? `{${jsString(value, "'")}}` : `${other}${value}${other}`;
    }
    case 'jsx-text': {
      const lead = /^\s*/.exec(original)?.[0] ?? '';
      const trail = /\s*$/.exec(original.slice(lead.length))?.[0] ?? '';
      const text = /[{}<>&]/.test(value) ? `{${jsString(value, "'")}}` : value;
      return `${lead}${text}${trail}`;
    }
    case 'template':
      return `\`${value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')}\``;
    default:
      return jsString(value, original[0] === '"' ? '"' : "'");
  }
}

/**
 * Rewrite the text at `line:column`. `from` is what the caller last saw there,
 * so an edit made against a stale view fails instead of clobbering newer text.
 */
export function replaceText(
  source: string,
  line: number,
  column: number,
  from: string,
  to: string,
): { source: string; slot: TextSlot } {
  const slot = findTextSlots(source).find((s) => s.line === line && s.column === column);
  if (!slot) throw new Error(`No editable text at line ${line}, column ${column}.`);
  if (normalizeText(slot.value) !== normalizeText(from)) {
    throw new Error('This text changed in the source since it was loaded — try again.');
  }
  const value = cleanText(to);
  const original = source.slice(slot.start, slot.end);
  const next = `${source.slice(0, slot.start)}${written(slot, value, original)}${source.slice(slot.end)}`;
  const errors = parseSource(next).errors ?? [];
  if (errors.length > 0) throw new Error('That text would break the form source.');
  return { source: next, slot };
}

/** Each JSX element's tag and, for fields, its `name`, keyed by `line:column`. */
export function elementNames(source: string): Map<string, { tag: string; name?: string }> {
  const out = new Map<string, { tag: string; name?: string }>();
  const visit = (node: Node) => {
    if (node.type === 'JSXElement') {
      const opening = node.openingElement;
      const tag = tagName(opening.name);
      if (tag && tag !== 'Fragment') {
        const nameAttr = opening.attributes.find(
          (a) =>
            a.type === 'JSXAttribute' && a.name.type === 'JSXIdentifier' && a.name.name === 'name',
        );
        const name =
          nameAttr?.type === 'JSXAttribute' && nameAttr.value?.type === 'StringLiteral'
            ? nameAttr.value.value
            : undefined;
        const pos = at(node);
        out.set(`${pos.line}:${pos.column}`, name ? { tag, name } : { tag });
      }
    }
    for (const child of children(node)) visit(child);
  };
  visit(parseSource(source).program as unknown as Node);
  return out;
}
