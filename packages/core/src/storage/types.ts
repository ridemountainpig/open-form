import type {
  FormOverrides,
  FormSchema,
  FormValues,
  ResponseFilter,
  ResponseSort,
} from '../schema/index.ts';

export type FormVersionRecord = {
  id: string;
  formId: string;
  version: string;
  schema: FormSchema;
  createdAt: string;
};

export type StoredSubmission = {
  id: string;
  formId: string;
  /** Per-form sequence number ("Response #147"); never renumbered or reused after a delete. */
  number: number;
  formVersionId: string;
  data: FormValues;
  visitorHash: string | null;
  /** The language the respondent saw, for multilingual forms. */
  locale?: string | null;
  createdAt: string;
};

export type CreateSubmissionInput = {
  formId: string;
  formVersionId: string;
  data: FormValues;
  visitorHash?: string | null;
  locale?: string | null;
  /** Enforced unique per form, e.g. `email:alex@example.com` or `device:<hash>`. */
  uniqueKey?: string | null;
};

export type CreateSubmissionResult =
  | { ok: true; submission: StoredSubmission }
  | { ok: false; reason: 'full' | 'duplicate' };

export type ListSubmissionsOptions = {
  limit?: number;
  offset?: number;
  /** Case-insensitive substring match against the answers (not the field names). */
  search?: string;
  /** Studio's filter rules, checked by `responseFilterTest`; applies together with `search`. */
  filter?: ResponseFilter;
  /** The current time for relative rules ("in the past 7 days"). Defaults to now. */
  now?: number;
  /** By response number (submission order). */
  order?: 'asc' | 'desc';
  /** Studio's column sort, keyed by `responseSortKey`; replaces `order`. Ties stay newest first. */
  sort?: ResponseSort;
};

/** Settings changed in Studio on a running server; they win over the form's code. */
export type StoredOverrides = FormOverrides & { updatedAt: string };

/** For `open-form db status`. */
export type StorageInfo = {
  /** e.g. `PostgreSQL 16.4`, `SQLite 3.50.4`. */
  engine: string;
  /** Where inside the database Open Form's tables are, when that isn't obvious. */
  location?: string;
  /** Migrations applied. */
  schemaVersion: number;
};

export type SubmissionPage = {
  items: StoredSubmission[];
  total: number;
};

/**
 * Persistence for runtime data. Async so remote databases (Postgres) can
 * implement it; the SQLite adapter just resolves synchronously.
 */
export type StorageAdapter = {
  ensureFormVersion(
    formId: string,
    version: string,
    schema: FormSchema,
  ): Promise<FormVersionRecord>;
  getFormVersion(id: string): Promise<FormVersionRecord | null>;
  listFormVersions(formId: string): Promise<FormVersionRecord[]>;
  /** Checks `maxResponses` and the unique key atomically with the insert. */
  createSubmission(
    input: CreateSubmissionInput,
    constraints?: { maxResponses?: number },
  ): Promise<CreateSubmissionResult>;
  getSubmission(formId: string, id: string): Promise<StoredSubmission | null>;
  listSubmissions(formId: string, opts?: ListSubmissionsOptions): Promise<SubmissionPage>;
  countSubmissions(formId: string): Promise<number>;
  countsByForm(): Promise<Record<string, number>>;
  /** formId → newest submission's `createdAt`. Optional; Studio sorts by it when present. */
  latestByForm?(): Promise<Record<string, string>>;
  deleteSubmission(formId: string, id: string): Promise<boolean>;
  /**
   * Erases everything stored for a form — responses, schema versions, Studio
   * overrides and its response numbering — and resolves how many responses it held.
   */
  deleteForm(formId: string): Promise<number>;
  hasUniqueKey(formId: string, uniqueKey: string): Promise<boolean>;
  getFormOverrides(formId: string): Promise<StoredOverrides | null>;
  /** `null` drops them, so the form follows its code again. */
  setFormOverrides(formId: string, overrides: FormOverrides | null): Promise<void>;
  listFormOverrides(): Promise<Record<string, StoredOverrides>>;
  /** Fixed-window counter: increments and returns the count for the current window. */
  hitRateLimit(key: string, windowMs: number, now?: number): Promise<number>;
  /** Ends a Studio session before it expires (sign-out); kept until `expiresAt` (epoch ms). */
  revokeSession(id: string, expiresAt: number, now?: number): Promise<void>;
  isSessionRevoked(id: string): Promise<boolean>;
  /** Optional: what `open-form db status` reports. */
  info?(): Promise<StorageInfo>;
  close(): Promise<void>;
};
