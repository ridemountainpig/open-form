import { walk } from './loc-tags.ts';
import { type Edit, parseProgram } from './source-object.ts';

const OWN_THEME_RE = /^\.\/theme(?:\/index(?:\.[jt]sx?)?)?$/;

type Located = { type: string; start: number; end: number; [key: string]: unknown };

/** Whether the source imports the form's own look from `./theme`. */
export function importsOwnTheme(source: string): boolean {
  try {
    return parseProgram(source).body.some(
      (s) => s.type === 'ImportDeclaration' && OWN_THEME_RE.test(s.source.value),
    );
  } catch {
    return false;
  }
}

/**
 * Point a form at its own look file: `import theme from './theme/index.ts'`, passed
 * to its one `<Form>`. A form that already does either keeps what it has; one
 * whose `<Form>` gets another theme is left alone, since the look file would
 * never apply.
 */
export function wireFormTheme(source: string, importPath = './theme/index.ts'): string {
  const program = parseProgram(source);
  const imports = program.body.filter((s) => s.type === 'ImportDeclaration');
  const own = imports.find((s) => OWN_THEME_RE.test(s.source.value));
  const local = own?.specifiers.find((s) => s.type === 'ImportDefaultSpecifier')?.local.name;

  const forms: Located[] = [];
  const names = new Set<string>();
  walk(program, (node) => {
    const name = node.name as Located | undefined;
    if (node.type === 'Identifier') names.add(node.name as string);
    if (node.type === 'JSXOpeningElement' && name?.type === 'JSXIdentifier' && name.name === 'Form')
      forms.push(node);
  });
  if (forms.length !== 1) {
    throw new Error(
      forms.length === 0
        ? 'Could not find <Form> in this file.'
        : 'This file renders more than one <Form>.',
    );
  }
  const form = forms[0] as Located;
  const attributes = form.attributes as Located[];
  const prop = attributes.find(
    (a) => a.type === 'JSXAttribute' && (a.name as Located & { name: string }).name === 'theme',
  );
  const passes = Boolean(prop);
  const value = prop?.value as Located | null | undefined;
  const expression =
    value?.type === 'JSXExpressionContainer' ? (value.expression as Located) : null;
  const passed = expression
    ? source.slice(expression.start, expression.end)
    : source.slice(value?.start ?? 0, value?.end ?? 0);
  if (prop && passed !== local) {
    throw new Error(
      `<Form> already gets theme=${expression ? `{${passed}}` : passed}. Move what it sets into ${importPath} and remove the prop, or keep changing that theme instead.`,
    );
  }

  const edits: Edit[] = [];
  let name = local ?? 'theme';
  for (let n = 2; !local && names.has(name); n++) name = n === 2 ? 'formTheme' : `formTheme${n}`;
  if (!passes) {
    const at = (form.name as Located).end;
    edits.push({ start: at, end: at, text: ` theme={${name}}` });
  }
  if (!local) {
    const statement = `import ${name} from '${importPath}';`;
    // Above the form's own CSS, so the form's rules win over its theme's.
    const css = imports.find((s) => s.specifiers.length === 0 && /\.css$/.test(s.source.value));
    const last = imports.at(-1);
    if (css) edits.push({ start: css.start ?? 0, end: css.start ?? 0, text: `${statement}\n` });
    else if (last) edits.push({ start: last.end ?? 0, end: last.end ?? 0, text: `\n${statement}` });
    else edits.push({ start: 0, end: 0, text: `${statement}\n` });
  }
  return edits
    .sort((a, b) => b.start - a.start)
    .reduce((text, e) => `${text.slice(0, e.start)}${e.text}${text.slice(e.end)}`, source);
}
