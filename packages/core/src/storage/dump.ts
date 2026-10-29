import type { StorageDump } from './types.ts';

export const RESTORE_NOT_EMPTY =
  'The target database already has responses or Studio settings, so nothing was copied. Copy into an empty database.';

/**
 * The form versions a restore writes, and the id each dumped one ends up with:
 * a version the target already has (same form, same hash) keeps the target's id.
 */
export function planVersions(
  dump: StorageDump,
  existing: Array<{ id: string; formId: string; version: string }>,
): { insert: StorageDump['formVersions']; idFor: (dumpedId: string) => string } {
  const byKey = new Map(existing.map((v) => [`${v.formId}\0${v.version}`, v.id]));
  const remap = new Map<string, string>();
  const insert: StorageDump['formVersions'] = [];
  for (const version of dump.formVersions) {
    const kept = byKey.get(`${version.formId}\0${version.version}`);
    if (kept) remap.set(version.id, kept);
    else insert.push(version);
  }
  return { insert, idFor: (id) => remap.get(id) ?? id };
}

/** The last number handed out per form: the stored counter, or the highest number if that's more. */
export function countersFor(
  submissions: ReadonlyArray<{ formId: string; number: number }>,
  stored: Record<string, number>,
): Record<string, number> {
  const counters = { ...stored };
  for (const { formId, number } of submissions) {
    counters[formId] = Math.max(counters[formId] ?? 0, number);
  }
  return counters;
}
