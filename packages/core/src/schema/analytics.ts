import type { FormSchema } from './types.ts';

/** A visit's steps reached are one integer of bits, exact in JavaScript up to 2^53. */
export const MAX_TRACKED_STEPS = 52;

export function stepBit(step: number): number {
  return Number.isInteger(step) && step >= 0 && step <= MAX_TRACKED_STEPS ? 2 ** step : 0;
}

function hasStep(steps: number, step: number): boolean {
  return Math.floor(steps / 2 ** step) % 2 === 1;
}

/** The only time a visit keeps: the UTC day it began. */
export function visitDay(now: number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Visits that went the same way, counted together. */
export type VisitGroup = {
  formVersionId: string;
  /** The `stepBit`s of every step the visit reached, added up. */
  steps: number;
  /** The step the respondent was on last. */
  lastStep: number | null;
  started: boolean;
  completed: boolean;
  count: number;
};

export type VisitStats = {
  groups: VisitGroup[];
  /** Seconds from opening the form to submitting it, one per completed visit. */
  durations: Array<{ formVersionId: string; seconds: number }>;
};

export type AnalyticsStep = {
  /** The step's index in the schema (`PageSchema.index`). */
  index: number;
  title?: string;
  /** Shown only for some answers, so not every visit passes through it. */
  conditional: boolean;
  reached: number;
  /** Visits that were on this step last and never submitted. */
  left: number;
};

export type AnalyticsVersion = {
  id: string;
  version: string;
  createdAt: string;
  visits: number;
  current: boolean;
};

export type FormAnalytics = {
  views: number;
  started: number;
  completed: number;
  medianSeconds: number | null;
  steps: AnalyticsStep[];
};

/** Funnel numbers for `schema`'s steps, from the visits on the versions in `versionIds` (all when absent). */
export function summarizeVisits(
  stats: VisitStats,
  schema: FormSchema,
  versionIds?: ReadonlySet<string>,
): FormAnalytics {
  const included = (id: string) => !versionIds || versionIds.has(id);
  const pages = schema.pages.length > 0 ? schema.pages : [{ index: 0, when: [] }];
  const steps: AnalyticsStep[] = pages.map((page) => ({
    index: page.index,
    // One question per step has no step title; its question names it instead.
    title:
      ('title' in page ? page.title : undefined) ??
      (schema.pages.length > 0
        ? schema.fields.find((field) => field.page === page.index && field.label)?.label
        : undefined),
    conditional: page.when.length > 0,
    reached: 0,
    left: 0,
  }));
  const byIndex = new Map(steps.map((step) => [step.index, step]));
  let views = 0;
  let started = 0;
  let completed = 0;
  for (const group of stats.groups) {
    if (!included(group.formVersionId)) continue;
    views += group.count;
    if (group.started) started += group.count;
    if (group.completed) completed += group.count;
    for (const step of steps) {
      if (hasStep(group.steps, step.index)) step.reached += group.count;
    }
    if (!group.completed && group.lastStep !== null) {
      const last = byIndex.get(group.lastStep);
      if (last) last.left += group.count;
    }
  }
  const seconds = stats.durations
    .filter((d) => included(d.formVersionId))
    .map((d) => d.seconds)
    .sort((a, b) => a - b);
  const mid = Math.floor(seconds.length / 2);
  const medianSeconds =
    seconds.length === 0
      ? null
      : seconds.length % 2
        ? (seconds[mid] as number)
        : Math.round(((seconds[mid - 1] as number) + (seconds[mid] as number)) / 2);
  return { views, started, completed, medianSeconds, steps };
}
