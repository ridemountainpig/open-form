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

export function table(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => stripVTControlCharacters(r[i] ?? '').length)),
  );
  const pad = (cell: string, i: number) =>
    cell + ' '.repeat(Math.max(0, (widths[i] ?? 0) - stripVTControlCharacters(cell).length));
  const lines = [
    headers.map((h, i) => chalk.dim(pad(h, i))).join('   '),
    ...rows.map((r) => r.map((c, i) => pad(c, i)).join('   ')),
  ];
  return `${lines.map((l) => `  ${l}`).join('\n')}\n`;
}
