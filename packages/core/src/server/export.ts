import {
  DEFAULT_TIME_ZONE,
  type FieldType,
  type FormSchema,
  isLocale,
  LOCALE_NAMES,
  wallClock,
} from '../schema/index.ts';
import type { StoredSubmission } from '../storage/index.ts';

export type ExportColumn = {
  key: string;
  header: string;
  type?: FieldType;
};

/**
 * Columns for a response table: fields of the newest schema in order, then
 * fields that only older versions had, then any stray keys found in the data.
 */
export function responseColumns(
  schemas: readonly FormSchema[],
  rows: readonly StoredSubmission[],
): ExportColumn[] {
  const columns: Array<{ key: string; label?: string; type?: FieldType }> = [];
  const seen = new Set<string>();
  for (const schema of schemas) {
    for (const field of schema.fields) {
      if (seen.has(field.name)) continue;
      seen.add(field.name);
      columns.push({ key: field.name, label: field.label, type: field.type });
    }
  }
  for (const row of rows) {
    for (const key of Object.keys(row.data)) {
      if (seen.has(key)) continue;
      seen.add(key);
      columns.push({ key });
    }
  }

  const headerCount = new Map<string, number>();
  for (const c of columns) {
    const header = c.label ?? c.key;
    headerCount.set(header, (headerCount.get(header) ?? 0) + 1);
  }
  return columns.map((c) => {
    const header = c.label ?? c.key;
    return {
      key: c.key,
      header: (headerCount.get(header) ?? 0) > 1 ? `${header} (${c.key})` : header,
      type: c.type,
    };
  });
}

export function formatCell(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return value.map(formatCell).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Spreadsheet apps execute cells starting with these characters as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;
// A `+` and digits alone, like an international phone number, can't call or
// reference anything, so it stays as stored.
const PLUS_DIGITS = /^\+\d+$/;

function csvCell(value: unknown): string {
  let text = formatCell(value);
  if (typeof value !== 'number' && FORMULA_START.test(text) && !PLUS_DIGITS.test(text)) {
    text = `'${text}`;
  }
  // `;` and tabs too: Excel splits on them in many locales, which would start a new cell.
  return /[",;\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A response's language by its own name ("繁體中文"), or the stored code when it isn't one. */
export function localeName(locale: string | null | undefined): string {
  if (!locale) return '';
  return isLocale(locale) ? LOCALE_NAMES[locale] : locale;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** `2026-10-13 08:48:03`, as a clock in `timeZone` shows it: what spreadsheets read as a date. */
export function submittedAtText(createdAt: string, timeZone: string): string {
  const instant = Date.parse(createdAt);
  if (Number.isNaN(instant)) return createdAt;
  const c = wallClock(instant, timeZone);
  return `${c.year}-${pad(c.month)}-${pad(c.day)} ${pad(c.hour)}:${pad(c.minute)}:${pad(c.second)}`;
}

export function toCsv(
  columns: readonly ExportColumn[],
  rows: readonly StoredSubmission[],
  opts: { language?: boolean; timeZone?: string } = {},
): string {
  const timeZone = opts.timeZone ?? DEFAULT_TIME_ZONE;
  const meta = ['#', `Submitted at (${timeZone})`, ...(opts.language ? ['Language'] : [])];
  const header = [...meta, ...columns.map((c) => c.header)];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    const submitted = submittedAtText(row.createdAt, timeZone);
    const cells = opts.language
      ? [row.number, submitted, localeName(row.locale)]
      : [row.number, submitted];
    lines.push([...cells, ...columns.map((c) => row.data[c.key])].map(csvCell).join(','));
  }
  // BOM so Excel opens UTF-8 (CJK, accents) correctly.
  return `﻿${lines.join('\r\n')}\r\n`;
}

export function toJsonExport(rows: readonly StoredSubmission[]) {
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    submittedAt: row.createdAt,
    ...(row.locale ? { locale: row.locale } : {}),
    data: row.data,
  }));
}
