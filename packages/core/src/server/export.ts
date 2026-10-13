import type { FieldType, FormSchema } from '../schema/index.ts';
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
  if (Array.isArray(value)) return value.map(formatCell).join('; ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

// Spreadsheet apps execute cells starting with these characters as formulas.
const FORMULA_START = /^[=+\-@\t\r]/;

function csvCell(value: unknown): string {
  let text = formatCell(value);
  if (typeof value !== 'number' && FORMULA_START.test(text)) text = `'${text}`;
  // `;` and tabs too: Excel splits on them in many locales, which would start a new cell.
  return /[",;\t\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  columns: readonly ExportColumn[],
  rows: readonly StoredSubmission[],
  opts: { language?: boolean } = {},
): string {
  const meta = opts.language ? ['#', 'Submitted at', 'Language'] : ['#', 'Submitted at'];
  const header = [...meta, ...columns.map((c) => c.header)];
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) {
    const cells = opts.language
      ? [row.number, row.createdAt, row.locale ?? '']
      : [row.number, row.createdAt];
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
