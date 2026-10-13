import { parseSource, walk } from './loc-tags.ts';

// Review comments live in the form's source as markers next to the element they
// are about, so an agent sees them in context and removes each once applied:
//
//   {/* @form-comment: make this optional */}
//   <Email name="email" label="Email" required />

export const COMMENT_MARKER = '@form-comment';
const MAX_LENGTH = 500;
const MARKER_RE = /\/\*\s*@form-comment:\s?([\s\S]*?)\s*\*\//;
// Braces only as a pair: a `{` before a bare marker belongs to the code around
// it, as in `defineForm({/* … */ title: …`.
const REMOVE_RE = new RegExp(`(?:\\{${MARKER_RE.source}\\}|${MARKER_RE.source}) ?`);

export type FormComment = { line: number; text: string };

export function listComments(source: string): FormComment[] {
  return source.split('\n').flatMap((text, index) => {
    const match = MARKER_RE.exec(text);
    return match ? [{ line: index + 1, text: match[1] ?? '' }] : [];
  });
}

/** One line of plain text that can't close the comment it is written into. */
export function cleanCommentText(text: unknown): string {
  if (typeof text !== 'string') throw new Error('Comment text must be a string.');
  const clean = text.replace(/\s+/g, ' ').replace(/\*\//g, '* /').trim();
  if (!clean) throw new Error('Comment text is empty.');
  if (clean.length > MAX_LENGTH) throw new Error(`Keep comments under ${MAX_LENGTH} characters.`);
  return clean;
}

/**
 * Insert a marker before the JSX element — or object property, such as
 * `title` in `config` — that starts at `line`:`column` (1-based). `shifted`
 * says whether the marker took a line of its own, moving what follows down.
 */
export function insertComment(
  source: string,
  line: number,
  column: number,
  text: string,
): { source: string; line: number; shifted: boolean } {
  const marker = `/* ${COMMENT_MARKER}: ${cleanCommentText(text)} */`;
  let target: { start: number; inJsx: boolean } | null = null;
  walk(parseSource(source).program, (node, parent) => {
    if (
      (node.type === 'JSXElement' || node.type === 'ObjectProperty') &&
      node.loc.start.line === line &&
      node.loc.start.column + 1 === column
    ) {
      target = {
        start: node.start,
        inJsx: parent?.type === 'JSXElement' || parent?.type === 'JSXFragment',
      };
    }
  });
  if (!target) throw new Error(`No element starts at line ${line}, column ${column}.`);
  const { start, inJsx } = target as { start: number; inJsx: boolean };
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  const indent = source.slice(lineStart, start);
  const wrapped = inJsx ? `{${marker}}` : marker;
  // The element starts its line: the marker gets its own line above, indented alike.
  if (/^[ \t]*$/.test(indent)) {
    return {
      source: `${source.slice(0, lineStart)}${indent}${wrapped}\n${source.slice(lineStart)}`,
      line,
      shifted: true,
    };
  }
  return {
    source: `${source.slice(0, start)}${wrapped}${inJsx ? '' : ' '}${source.slice(start)}`,
    line,
    shifted: false,
  };
}

/** Remove the marker on `line`; the line goes too when the marker was all it held. */
export function removeComment(source: string, line: number): string {
  const lines = source.split('\n');
  const text = lines[line - 1];
  if (text === undefined || !MARKER_RE.test(text)) {
    throw new Error(`No ${COMMENT_MARKER} on line ${line}.`);
  }
  const rest = text.replace(REMOVE_RE, '');
  if (rest.trim() === '') lines.splice(line - 1, 1);
  else lines[line - 1] = rest;
  return lines.join('\n');
}
