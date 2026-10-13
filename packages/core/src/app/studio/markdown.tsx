import { Fragment, type ReactNode } from 'react';

// Enough Markdown for THEME.md files: headings, paragraphs, lists, tables,
// fenced code, **bold**, *italic* and `code`. No HTML passthrough.

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g;
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    if (index > last) out.push(text.slice(last, index));
    const token = match[0];
    if (token.startsWith('`')) {
      out.push(
        <code
          key={index}
          className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[0.85em] dark:bg-zinc-800"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      out.push(<strong key={index}>{token.slice(2, -2)}</strong>);
    } else {
      out.push(<em key={index}>{token.slice(1, -1)}</em>);
    }
    last = index + token.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const cells = (line: string) =>
  line
    .trim()
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((c) => c.trim());

export function Markdown({ source, skipTitle }: { source: string; skipTitle?: boolean }) {
  let body = source.replace(/^---\n[\s\S]*?\n---\n?/, '');
  // The page already shows the title.
  if (skipTitle) body = body.replace(/^\s*#\s+.*\n?/, '');
  const lines = body.split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1]?.length ?? 1;
      const cls =
        level === 1
          ? 'text-lg font-semibold tracking-tight'
          : level === 2
            ? 'mt-7 text-[15px] font-semibold tracking-tight text-zinc-900 first:mt-0 dark:text-zinc-100'
            : 'mt-5 text-[13px] font-semibold tracking-tight text-zinc-900 dark:text-zinc-100';
      // Nested under the page's own h1.
      const Tag = `h${level + 1}` as 'h2';
      blocks.push(
        <Tag key={i} className={cls}>
          {inline(heading[2] ?? '')}
        </Tag>,
      );
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const code: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) code.push(lines[i++] ?? '');
      i++;
      blocks.push(
        <pre
          key={i}
          className="overflow-x-auto rounded-lg bg-zinc-100 p-3 font-mono text-[12px] leading-relaxed dark:bg-zinc-900"
        >
          {code.join('\n')}
        </pre>,
      );
      continue;
    }
    if (line.trim().startsWith('|')) {
      const rows: string[][] = [];
      while (i < lines.length && (lines[i] ?? '').trim().startsWith('|')) {
        const row = cells(lines[i] ?? '');
        if (!row.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(row);
        i++;
      }
      const [head, ...rest] = rows;
      blocks.push(
        <div key={i} className="overflow-x-auto">
          <table className="w-full text-left text-[12px]">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                {head?.map((c, k) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static table
                  <th key={k} className="py-1.5 pr-3 font-medium text-zinc-500">
                    {inline(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rest.map((row) => (
                <tr
                  key={row.join('|')}
                  className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/60"
                >
                  {row.map((c, k) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static table
                    <td key={k} className="py-1.5 pr-3 align-top">
                      {inline(c)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={i} className="list-disc space-y-1 pl-4">
          {items.map((item, k) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static list
            <li key={k}>{inline(item)}</li>
          ))}
        </ul>,
      );
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      (lines[i] ?? '').trim() &&
      !/^(#|```|\||\s*[-*]\s)/.test(lines[i] ?? '')
    ) {
      para.push(lines[i++] ?? '');
    }
    blocks.push(<p key={i}>{inline(para.join(' '))}</p>);
  }
  return (
    <div className="space-y-2.5 text-[13px] leading-relaxed text-zinc-700 dark:text-zinc-300">
      {blocks.map((b, k) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: positional blocks
        <Fragment key={k}>{b}</Fragment>
      ))}
    </div>
  );
}
