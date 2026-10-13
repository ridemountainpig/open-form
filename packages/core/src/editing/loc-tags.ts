import { parse } from '@babel/parser';

// Dev-only: stamp every JSX element in a form file with where it was written,
// `data-of-loc="forms/meetup/index.tsx:12:7"`, so Studio's inspector can map a
// click in the preview back to the source. Only text is inserted inside the
// opening tag, so every line keeps its number.

export const LOC_ATTRIBUTE = 'data-of-loc';

type Node = {
  type: string;
  start: number;
  end: number;
  loc: { start: { line: number; column: number } };
  [key: string]: unknown;
};

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';
}

export function walk(node: unknown, visit: (node: Node, parent: Node | null) => void): void {
  const go = (current: Node, parent: Node | null) => {
    visit(current, parent);
    for (const [key, value] of Object.entries(current)) {
      if (key === 'loc' || key === 'leadingComments' || key === 'trailingComments') continue;
      if (Array.isArray(value)) {
        for (const item of value) if (isNode(item)) go(item, current);
      } else if (isNode(value)) {
        go(value, current);
      }
    }
  };
  if (isNode(node)) go(node, null);
}

export function parseSource(code: string) {
  return parse(code, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    errorRecovery: true,
  });
}

function tagName(name: Node): string {
  if (name.type === 'JSXIdentifier') return name.name as string;
  if (name.type === 'JSXMemberExpression') return tagName(name.property as Node);
  return '';
}

/** `code` with a location on each element; unchanged when it can't be parsed. */
export function addLocTags(code: string, file: string): string {
  // The path goes into a JSX string attribute, which has no escapes.
  if (/["{}<>\r\n]/.test(file)) return code;
  let ast: ReturnType<typeof parseSource>;
  try {
    ast = parseSource(code);
  } catch {
    return code;
  }
  const inserts: Array<{ at: number; text: string }> = [];
  walk(ast.program, (node) => {
    if (node.type !== 'JSXOpeningElement') return;
    const name = node.name as Node;
    // Fragments only accept `key`; and never stamp twice.
    if (tagName(name) === 'Fragment') return;
    const attributes = node.attributes as Node[];
    if (
      attributes.some((a) => a.type === 'JSXAttribute' && (a.name as Node).name === LOC_ATTRIBUTE)
    ) {
      return;
    }
    const after = (node.typeArguments ?? node.typeParameters) as Node | undefined;
    const { line, column } = node.loc.start;
    inserts.push({
      at: (after ?? name).end,
      text: ` ${LOC_ATTRIBUTE}="${file}:${line}:${column + 1}"`,
    });
  });
  let out = code;
  for (const { at, text } of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, at) + text + out.slice(at);
  }
  return out;
}
