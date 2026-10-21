import { stripVTControlCharacters } from 'node:util';
import chalk from 'chalk';
import { readPackageVersion } from '../vite/project.ts';

const UNICODE =
  process.platform !== 'win32' ||
  Boolean(process.env.WT_SESSION) ||
  process.env.TERM_PROGRAM === 'vscode';

export const glyph = {
  bar: UNICODE ? '┃' : '|',
  warn: UNICODE ? '▲' : '!',
  cross: UNICODE ? '✖' : 'x',
  check: UNICODE ? '✔' : 'v',
} as const;

export function brand(): string {
  return chalk.bgHex('#4f46e5').white.bold(' open-form ');
}

export function printHeader(status?: string): void {
  const parts = [brand(), chalk.dim(`v${readPackageVersion()}`)];
  if (status) parts.push(chalk.dim(status));
  process.stdout.write(`\n  ${parts.join('  ')}\n\n`);
}

export function row(label: string, value: string): string {
  return `  ${chalk.dim(glyph.bar)}  ${chalk.bold(label.padEnd(9))} ${value}`;
}

export function printRows(rows: Array<[string, string]>): void {
  process.stdout.write(`${rows.map(([l, v]) => row(l, v)).join('\n')}\n`);
}

export function formatError(message: string): string {
  return `\n  ${chalk.red(glyph.cross)} ${message}\n\n`;
}

export function startupDuration(): string {
  return `ready in ${Math.round(process.uptime() * 1000)} ms`;
}

// East Asian wide and fullwidth characters, and emoji, take two terminal columns.
const WIDE =
  /[\u1100-\u115f\u2e80-\u303e\u3041-\u33ff\u3400-\u4dbf\u4e00-\u9fff\ua000-\ua4cf\ua960-\ua97f\uac00-\ud7a3\uf900-\ufaff\ufe10-\ufe19\ufe30-\ufe6f\uff00-\uff60\uffe0-\uffe6\u{1f300}-\u{1f64f}\u{1f680}-\u{1f6ff}\u{1f900}-\u{1faff}\u{20000}-\u{3fffd}]/u;

// Combining marks and zero-width characters take none.
const ZERO = /[\p{Mn}\p{Me}\u200b-\u200f\u2060\ufeff]/gu;
const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

// One glyph per grapheme, so "é" and joined emoji like 👩‍💻 are measured as drawn.
export function displayWidth(text: string): number {
  let width = 0;
  for (const { segment } of graphemes.segment(stripVTControlCharacters(text))) {
    const [base] = segment.replace(ZERO, '');
    if (base) width += WIDE.test(base) ? 2 : 1;
  }
  return width;
}

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(displayWidth(h), ...rows.map((r) => displayWidth(r[i] ?? ''))),
  );
  const pad = (cell: string, i: number) =>
    cell + ' '.repeat(Math.max(0, (widths[i] ?? 0) - displayWidth(cell)));
  const lines = [
    headers.map((h, i) => chalk.dim(pad(h, i))).join('   '),
    ...rows.map((r) => r.map((c, i) => pad(c, i)).join('   ')),
  ];
  return `${lines.map((l) => `  ${l}`).join('\n')}\n`;
}
