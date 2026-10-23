import type { FieldSchema, FormSchema } from '../../schema/index.ts';

export function fieldIndex(schema: FormSchema | null | undefined): Map<string, FieldSchema> {
  const map = new Map<string, FieldSchema>();
  for (const field of schema?.fields ?? []) if (!map.has(field.name)) map.set(field.name, field);
  return map;
}

/** Human-readable value: option labels instead of raw values, lists joined. */
export function formatValue(
  value: unknown,
  field?: FieldSchema,
  yesNo: readonly [string, string] = ['Yes', 'No'],
): string {
  if (value === undefined || value === null || value === '') return '';
  const label = (v: unknown) =>
    field?.options?.find((o) => o.value === String(v))?.label ?? String(v);
  if (Array.isArray(value)) return value.map(label).join(', ');
  if (typeof value === 'boolean') return value ? yesNo[0] : yesNo[1];
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'number' && isScale(field)) return `${value} / ${field?.max}`;
  return label(value);
}

/** A whole-number field with a short fixed range, like a rating or an NPS score: "4 / 5" reads better than "4". */
function isScale(field: FieldSchema | undefined): boolean {
  if (field?.type !== 'number' || field.integer !== true) return false;
  const { min, max } = field;
  return typeof min === 'number' && typeof max === 'number' && max - min <= 10;
}

export function timeAgo(iso: string, locale: string, now = Date.now()): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(seconds, 'second');
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86_400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86_400 * 30) return relative.format(Math.round(seconds / 86_400), 'day');
  return new Date(iso).toLocaleDateString(locale, { dateStyle: 'medium' });
}

/** "in 3 days", "2 hours ago" — never falls back to a date, unlike `timeAgo`. */
export function relativeTime(instant: number, locale: string, now = Date.now()): string {
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const minutes = Math.round((instant - now) / 60_000);
  const abs = Math.abs(minutes);
  if (abs < 60) return relative.format(minutes, 'minute');
  if (abs < 48 * 60) return relative.format(Math.round(minutes / 60), 'hour');
  return relative.format(Math.round(minutes / 1440), 'day');
}

export function fullDate(iso: string, locale: string): string {
  return new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}

export function formatDuration(ms: number): string {
  if (ms % 3_600_000 === 0) return `${ms / 3_600_000}h`;
  if (ms % 60_000 === 0) return `${ms / 60_000} min`;
  if (ms % 1000 === 0) return `${ms / 1000}s`;
  return `${ms}ms`;
}

export function formatBytes(bytes: number, locale: string): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  const mb = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(
    bytes / 1024 / 1024,
  );
  return `${mb} MB`;
}
