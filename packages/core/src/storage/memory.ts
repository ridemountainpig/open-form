import type { FormSchema } from '../schema/index.ts';
import { countersFor, planVersions, RESTORE_NOT_EMPTY } from './dump.ts';
import { pageSubmissions } from './list.ts';
import type {
  CreateSubmissionInput,
  CreateSubmissionResult,
  FormVersionRecord,
  ListSubmissionsOptions,
  StorageAdapter,
  StoredOverrides,
  StoredSubmission,
} from './types.ts';

type Row = StoredSubmission & { uniqueKey: string | null; updatedAt?: string };

function answerMatches(value: unknown, needle: string): boolean {
  if (typeof value === 'string' || typeof value === 'number') {
    return String(value).toLowerCase().includes(needle);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).some((v) => answerMatches(v, needle));
  }
  return false;
}

/** In-memory adapter for tests and throwaway previews. Data dies with the process. */
export function createMemoryStorage(): StorageAdapter {
  const versions = new Map<string, FormVersionRecord>();
  const submissions: Row[] = [];
  const rate = new Map<string, { count: number; expiresAt: number }>();
  const overrides = new Map<string, StoredOverrides>();
  const counters = new Map<string, number>();
  const revoked = new Map<string, number>();

  const strip = ({ uniqueKey: _key, updatedAt: _updated, ...rest }: Row): StoredSubmission => rest;
  const ofForm = (formId: string) => submissions.filter((s) => s.formId === formId);

  return {
    async ensureFormVersion(formId: string, version: string, schema: FormSchema) {
      for (const record of versions.values()) {
        if (record.formId === formId && record.version === version) return record;
      }
      const record = {
        id: crypto.randomUUID(),
        formId,
        version,
        schema,
        createdAt: new Date().toISOString(),
      };
      versions.set(record.id, record);
      return record;
    },
    async getFormVersion(id) {
      return versions.get(id) ?? null;
    },
    async listFormVersions(formId) {
      return [...versions.values()].filter((v) => v.formId === formId);
    },
    async createSubmission(
      input: CreateSubmissionInput,
      constraints = {},
    ): Promise<CreateSubmissionResult> {
      const existing = ofForm(input.formId);
      if (constraints.maxResponses !== undefined && existing.length >= constraints.maxResponses) {
        return { ok: false, reason: 'full' };
      }
      if (input.uniqueKey && existing.some((s) => s.uniqueKey === input.uniqueKey)) {
        return { ok: false, reason: 'duplicate' };
      }
      const number = (counters.get(input.formId) ?? 0) + 1;
      counters.set(input.formId, number);
      const row: Row = {
        id: crypto.randomUUID(),
        formId: input.formId,
        number,
        formVersionId: input.formVersionId,
        data: input.data,
        visitorHash: input.visitorHash ?? null,
        locale: input.locale ?? null,
        uniqueKey: input.uniqueKey ?? null,
        createdAt: new Date().toISOString(),
      };
      submissions.push(row);
      return { ok: true, submission: strip(row) };
    },
    async getSubmission(formId, id) {
      const row = submissions.find((s) => s.formId === formId && s.id === id);
      return row ? strip(row) : null;
    },
    async listSubmissions(formId, opts: ListSubmissionsOptions = {}) {
      const needle = opts.search?.toLowerCase();
      let rows = ofForm(formId);
      if (needle) rows = rows.filter((s) => answerMatches(s.data, needle));
      const page = pageSubmissions(rows, opts);
      return { items: page.items.map(strip), total: page.total };
    },
    async countSubmissions(formId) {
      return ofForm(formId).length;
    },
    async countsByForm() {
      const counts: Record<string, number> = {};
      for (const s of submissions) counts[s.formId] = (counts[s.formId] ?? 0) + 1;
      return counts;
    },
    async latestByForm() {
      const latest: Record<string, string> = {};
      for (const s of submissions) {
        const at = latest[s.formId];
        if (!at || s.createdAt > at) latest[s.formId] = s.createdAt;
      }
      return latest;
    },
    async deleteSubmission(formId, id) {
      const index = submissions.findIndex((s) => s.formId === formId && s.id === id);
      if (index === -1) return false;
      submissions.splice(index, 1);
      return true;
    },
    async deleteForm(formId) {
      const before = submissions.length;
      for (let i = submissions.length - 1; i >= 0; i--) {
        if (submissions[i]?.formId === formId) submissions.splice(i, 1);
      }
      for (const [id, record] of versions) if (record.formId === formId) versions.delete(id);
      overrides.delete(formId);
      counters.delete(formId);
      return before - submissions.length;
    },
    async hasUniqueKey(formId, uniqueKey) {
      return ofForm(formId).some((s) => s.uniqueKey === uniqueKey);
    },
    async getFormOverrides(formId) {
      return structuredClone(overrides.get(formId) ?? null);
    },
    async setFormOverrides(formId, next) {
      if (next)
        overrides.set(formId, { ...structuredClone(next), updatedAt: new Date().toISOString() });
      else overrides.delete(formId);
    },
    async listFormOverrides() {
      return structuredClone(Object.fromEntries(overrides));
    },
    async hitRateLimit(key, windowMs, now = Date.now()) {
      for (const [bucket, { expiresAt }] of rate) if (expiresAt <= now) rate.delete(bucket);
      const windowStart = Math.floor(now / windowMs) * windowMs;
      const bucket = `${key}:${windowStart}`;
      const count = (rate.get(bucket)?.count ?? 0) + 1;
      rate.set(bucket, { count, expiresAt: windowStart + windowMs });
      return count;
    },
    async revokeSession(id, expiresAt, now = Date.now()) {
      for (const [key, expires] of revoked) if (expires <= now) revoked.delete(key);
      revoked.set(id, expiresAt);
    },
    async isSessionRevoked(id) {
      return revoked.has(id);
    },
    async dump() {
      const now = Date.now();
      return structuredClone({
        formVersions: [...versions.values()],
        submissions: [...submissions]
          .sort((a, b) => a.formId.localeCompare(b.formId) || a.number - b.number)
          .map((row) => ({ ...row, updatedAt: row.updatedAt ?? row.createdAt })),
        counters: countersFor(submissions, Object.fromEntries(counters)),
        overrides: Object.fromEntries(overrides),
        revokedSessions: Object.fromEntries([...revoked].filter(([, at]) => at > now)),
      });
    },
    async restore(dump) {
      if (submissions.length > 0 || overrides.size > 0 || [...counters.values()].some(Boolean)) {
        throw new Error(RESTORE_NOT_EMPTY);
      }
      const copy = structuredClone(dump);
      const plan = planVersions(copy, [...versions.values()]);
      for (const version of plan.insert) versions.set(version.id, version);
      for (const row of copy.submissions) {
        submissions.push({ ...row, formVersionId: plan.idFor(row.formVersionId) });
      }
      for (const [formId, last] of Object.entries(countersFor(copy.submissions, copy.counters))) {
        counters.set(formId, last);
      }
      for (const [formId, stored] of Object.entries(copy.overrides)) overrides.set(formId, stored);
      for (const [id, at] of Object.entries(copy.revokedSessions)) revoked.set(id, at);
    },
    async close() {},
  };
}
