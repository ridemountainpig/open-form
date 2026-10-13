const keywords = new Set([
  'import',
  'from',
  'type',
  'const',
  'return',
  'export',
  'default',
  'function',
  'satisfies',
  'true',
  'false',
]);

// Monochrome on purpose: weight and lightness carry the syntax, like the rest of the site.
const palette = {
  kw: 'var(--color-muted)',
  str: 'var(--color-text-soft)',
  num: 'var(--color-text-soft)',
  cmt: 'var(--color-dim)',
  tag: 'var(--color-text)',
  fn: 'var(--color-text)',
  punct: 'var(--color-dim)',
};

export function highlight(src: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const wrap = (cls: keyof typeof palette, t: string, weight?: number) =>
    `<span style="color:${palette[cls]}${weight ? `;font-weight:${weight}` : ''}">${t}</span>`;

  const tokens: string[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];

    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < src.length && src[j] !== c) j++;
      tokens.push(wrap('str', esc(src.slice(i, j + 1))));
      i = j + 1;
      continue;
    }

    if ((c === '/' && src[i + 1] === '/') || (c === '{' && src.startsWith('{/*', i))) {
      tokens.push(wrap('cmt', esc(src.slice(i))));
      break;
    }

    if (/[A-Za-z_$]/.test(c)) {
      let j = i;
      while (j < src.length && /[A-Za-z0-9_$]/.test(src[j])) j++;
      const word = src.slice(i, j);
      if (keywords.has(word)) tokens.push(wrap('kw', esc(word)));
      else if (/^[A-Z]/.test(word)) tokens.push(wrap('tag', esc(word), 550));
      else tokens.push(wrap('fn', esc(word)));
      i = j;
      continue;
    }

    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < src.length && /[0-9.]/.test(src[j])) j++;
      tokens.push(wrap('num', esc(src.slice(i, j))));
      i = j;
      continue;
    }

    if (/[{}()[\];:,.<>=+\-*/!?|&]/.test(c)) {
      tokens.push(wrap('punct', esc(c)));
      i++;
      continue;
    }

    tokens.push(esc(c));
    i++;
  }

  return tokens.join('');
}
