import { type FormSchema, overriddenTimeZone, type ResponseFilter } from '../schema/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { responseColumns, toCsv, toJsonExport } from './export.ts';
import type { FormDefinition } from './handler.ts';
import { toXlsx, XLSX_CONTENT_TYPE } from './xlsx.ts';

export type ExportFormat = 'csv' | 'xlsx' | 'json';

export const EXPORT_CONTENT_TYPES: Record<ExportFormat, string> = {
  csv: 'text/csv; charset=utf-8',
  xlsx: XLSX_CONTENT_TYPE,
  json: 'application/json; charset=utf-8',
};

export type FormExportOptions = {
  storage: StorageAdapter;
  formId: string;
  format: ExportFormat;
  /** The form as its code defines it now; `null` when it no longer loads. */
  definition: FormDefinition | null;
  /** The project's `timeZone`, for forms that don't set one. */
  projectTimeZone?: string;
  /** Only the responses Studio's search matches. */
  search?: string;
  /** Only the responses Studio's filter rules match. */
  filter?: ResponseFilter;
  /** The current time for relative filter rules. */
  now?: number;
};

/**
 * The form's current schema, then every stored version from newest to oldest:
 * response columns use today's labels and keep fields only older versions had.
 */
export async function schemaHistory(
  storage: StorageAdapter,
  formId: string,
  definition: FormDefinition | null,
): Promise<FormSchema[]> {
  const versions = (await storage.listFormVersions(formId)).reverse();
  return [...(definition ? [definition.schema] : []), ...versions.map((v) => v.schema)];
}

/**
 * A form's responses as CSV, Excel or JSON. Studio's export and
 * `open-form responses export` both use it, so the two files always match.
 */
export async function exportFormResponses({
  storage,
  formId,
  format,
  definition,
  projectTimeZone,
  search,
  filter,
  now,
}: FormExportOptions): Promise<{ body: string | Uint8Array<ArrayBuffer>; count: number }> {
  const { items } = await storage.listSubmissions(formId, { order: 'asc', search, filter, now });
  if (format === 'json') {
    return { body: JSON.stringify(toJsonExport(items), null, 2), count: items.length };
  }

  const columns = responseColumns(await schemaHistory(storage, formId, definition), items);
  const language =
    items.some((item) => item.locale) &&
    Object.keys(definition?.config.translations ?? {}).length > 0;

  const overrides = definition ? await storage.getFormOverrides(formId) : null;
  const timeZone = overriddenTimeZone(definition?.config, overrides, projectTimeZone);
  if (format === 'xlsx') {
    return { body: await toXlsx(columns, items, { language, timeZone }), count: items.length };
  }
  return { body: toCsv(columns, items, { language, timeZone }), count: items.length };
}
