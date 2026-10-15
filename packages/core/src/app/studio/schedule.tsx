import appConfig from 'virtual:open-form/config';
import { X } from 'lucide-react';
import { type FormEvent, type ReactNode, useId, useState } from 'react';
import {
  parseSchedule,
  policyDateParts,
  policyInstant,
  type Schedule,
  type SubmissionOverrides,
} from '../../schema/index.ts';
import { clearOverrides, type SchemaInfo, saveSchedule } from './api.ts';
import { relativeTime } from './format.ts';
import { useT } from './i18n.tsx';
import type { MessageKey } from './messages.ts';
import { deviceTimeZone, TimeZonePicker } from './time-zone-picker.tsx';
import { Button, Card, cx, Kbd } from './ui.tsx';

const INPUT =
  'focus-ring h-8 min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-[13px] text-zinc-900 tabular-nums placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600 dark:[color-scheme:dark]';

type DateDraft = { date: string; time: string };

type Draft = {
  opens: DateDraft;
  closes: DateDraft;
  max: string;
  closed: boolean;
  zone: string;
  published: boolean;
};

const LABELS: Record<keyof SubmissionOverrides | 'timeZone' | 'published', MessageKey> = {
  opensAt: 'settings.opens',
  closesAt: 'settings.closes',
  maxResponses: 'settings.limit',
  closed: 'schedule.accepting',
  timeZone: 'schedule.zone',
  published: 'schedule.published',
};

/**
 * Dates are read in the zone in effect. When nothing set one, a schedule
 * without dates starts from this device's zone instead of the UTC fallback.
 */
function toDraft(info: SchemaInfo): Draft {
  const { schedule, timeZone } = info;
  const undated = !schedule.opensAt && !schedule.closesAt;
  const date = (value: string | null): DateDraft => {
    if (!value) return { date: '', time: '' };
    const parts = policyDateParts(value, timeZone);
    return { date: parts.date, time: parts.time ?? '' };
  };
  return {
    opens: date(schedule.opensAt),
    closes: date(schedule.closesAt),
    max: schedule.maxResponses === null ? '' : String(schedule.maxResponses),
    closed: schedule.closed,
    zone: (info.timeZoneFallback && undated && deviceTimeZone()) || timeZone,
    published: info.published,
  };
}

const sameDate = (a: DateDraft, b: DateDraft) => a.date === b.date && a.time === b.time;

const dateValue = (d: DateDraft) => (d.time ? `${d.date}T${d.time}` : d.date);

// An untouched date goes back exactly as it was, so a timestamp with seconds or
// an offset isn't rewritten as the minute the inputs can show. A new zone keeps
// the times shown and moves them, so every date is then sent as wall-clock time.
function toSchedule(draft: Draft, initial: Draft, current: Schedule): Schedule {
  const date = (d: DateDraft, was: DateDraft, value: string | null) => {
    if (sameDate(d, was) && draft.zone === initial.zone) return value;
    return d.date ? dateValue(d) : null;
  };
  const max = draft.max.trim();
  return {
    opensAt: date(draft.opens, initial.opens, current.opensAt),
    closesAt: date(draft.closes, initial.closes, current.closesAt),
    maxResponses: max === '' ? null : Number(max),
    closed: draft.closed,
  };
}

function Switch({
  checked,
  onChange,
  labelledBy,
}: {
  checked: boolean;
  onChange(value: boolean): void;
  labelledBy: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      onClick={() => onChange(!checked)}
      className={cx(
        'focus-ring relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
        checked ? 'bg-zinc-900 dark:bg-white' : 'bg-zinc-200 dark:bg-zinc-700',
      )}
    >
      <span
        aria-hidden
        className={cx(
          'size-4 rounded-full bg-white shadow-sm transition-transform dark:bg-zinc-900',
          checked ? 'translate-x-[18px]' : 'translate-x-0.5',
        )}
      />
    </button>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-start">
      <label htmlFor={htmlFor} className="pt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        {label}
      </label>
      <div className="min-w-0">
        {children}
        {hint && <p className="mt-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">{hint}</p>}
      </div>
    </div>
  );
}

const SUBTLE = 'text-[12px] text-zinc-500 dark:text-zinc-400';

// Date, time and clear live in one box so the clear button can't wrap away
// from the value it clears.
function DateInputs({
  id,
  value,
  onChange,
  hint,
}: {
  id: string;
  value: DateDraft;
  onChange(value: DateDraft): void;
  hint: string;
}) {
  const t = useT();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <div className="flex h-8 items-center rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-900 tabular-nums focus-within:ring-2 focus-within:ring-brand/40 focus-within:ring-offset-2 focus-within:ring-offset-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:[color-scheme:dark] dark:focus-within:ring-offset-zinc-950">
        <input
          id={id}
          type="date"
          className="h-full w-[8.75rem] min-w-0 bg-transparent pr-1 pl-2 outline-none"
          value={value.date}
          onChange={(e) =>
            onChange({ date: e.target.value, time: e.target.value ? value.time : '' })
          }
        />
        <span aria-hidden className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
        <input
          type="time"
          aria-label={t('schedule.time')}
          className="h-full w-[7rem] min-w-0 bg-transparent px-2 outline-none disabled:text-zinc-300 dark:disabled:text-zinc-600"
          value={value.time}
          disabled={!value.date}
          onChange={(e) => onChange({ ...value, time: e.target.value })}
        />
        <button
          type="button"
          aria-label={t('schedule.clear')}
          title={t('schedule.clear')}
          tabIndex={value.date ? 0 : -1}
          onClick={() => onChange({ date: '', time: '' })}
          className={cx(
            'mr-1 grid size-6 shrink-0 place-items-center rounded text-zinc-400 outline-none transition-colors hover:bg-zinc-100 hover:text-zinc-700 focus-visible:bg-zinc-100 focus-visible:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 dark:focus-visible:bg-zinc-800',
            !value.date && 'invisible',
          )}
        >
          <X className="size-3.5" />
        </button>
      </div>
      <span className={SUBTLE}>{hint}</span>
    </div>
  );
}

function ResponseProgress({ received, max }: { received: number; max: number }) {
  const t = useT();
  const full = received >= max;
  return (
    <div className="mt-2 max-w-[18rem]">
      <div className="h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
        <div
          className={cx(
            'h-full rounded-full transition-[width]',
            full ? 'bg-amber-500' : 'bg-zinc-900 dark:bg-zinc-100',
          )}
          style={{ width: `${Math.min(100, (received / max) * 100)}%` }}
        />
      </div>
      <p
        className={cx('mt-1.5 tabular-nums', SUBTLE, full && 'text-amber-700 dark:text-amber-400')}
      >
        {t('schedule.progress', { n: received, max })}
        {full && ` · ${t('status.full')}`}
      </p>
    </div>
  );
}

/**
 * When the form takes responses and how many. Remount (via `key`) when the
 * saved schedule changes so the draft starts from it.
 */
export function ScheduleSection({
  formId,
  info,
  onSaved,
}: {
  formId: string;
  info: SchemaInfo;
  onSaved(): void;
}) {
  const t = useT();
  const ids = useId();
  const dev = appConfig.dev;
  const { schedule, overrides } = info;
  const [initial] = useState(() => toDraft(info));
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const device = deviceTimeZone();
  const changed: Array<keyof typeof LABELS> = [
    ...(Object.keys(overrides?.submissions ?? {}) as Array<keyof SubmissionOverrides>),
    ...(overrides?.timeZone ? (['timeZone'] as const) : []),
    ...(overrides?.published !== undefined ? (['published'] as const) : []),
  ];
  const next = toSchedule(draft, initial, schedule);
  const problem = dirty ? scheduleProblem(next, draft.zone) : undefined;
  const max = next.maxResponses;

  const when = (d: DateDraft, edge: 'start' | 'end', empty: string) => {
    if (!d.date) return empty;
    try {
      return relativeTime(policyInstant(dateValue(d), draft.zone, edge), t.locale);
    } catch {
      return '';
    }
  };

  const update = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(undefined);
  };

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return;
    void run(async () => {
      await saveSchedule(formId, next, { timeZone: draft.zone, published: draft.published, dev });
      // The draft started from the overridden values; once they're in code, the
      // overrides would only shadow later edits.
      if (dev && overrides) await clearOverrides(formId);
    });
  };

  return (
    <Card className="p-5">
      <form onSubmit={submit}>
        <h2 className="text-sm font-semibold">{t('settings.submissions')}</h2>

        <div className="mt-2 divide-y divide-zinc-100 dark:divide-zinc-800">
          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <span id={`${ids}-published`} className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('schedule.published')}
            </span>
            <div className="flex items-center gap-3">
              <Switch
                checked={draft.published}
                onChange={(published) => update({ published })}
                labelledBy={`${ids}-published`}
              />
              {!draft.published && <span className={SUBTLE}>{t('schedule.unpublishedHint')}</span>}
            </div>
          </div>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-1.5 py-3 sm:grid-cols-[9rem_minmax(0,1fr)] sm:items-center">
            <span id={`${ids}-accepting`} className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('schedule.accepting')}
            </span>
            <div className="flex items-center gap-3">
              <Switch
                checked={!draft.closed}
                onChange={(on) => update({ closed: !on })}
                labelledBy={`${ids}-accepting`}
              />
              {draft.closed && <span className={SUBTLE}>{t('schedule.pausedHint')}</span>}
            </div>
          </div>

          <Field label={t('settings.opens')} htmlFor={`${ids}-opens`}>
            <DateInputs
              id={`${ids}-opens`}
              value={draft.opens}
              onChange={(opens) => update({ opens })}
              hint={when(draft.opens, 'start', t('schedule.noStart'))}
            />
          </Field>
          <Field
            label={t('settings.closes')}
            htmlFor={`${ids}-closes`}
            hint={t('schedule.timeHint')}
          >
            <DateInputs
              id={`${ids}-closes`}
              value={draft.closes}
              onChange={(closes) => update({ closes })}
              hint={when(draft.closes, 'end', t('schedule.noEnd'))}
            />
          </Field>
          <Field
            label={t('schedule.zone')}
            htmlFor={`${ids}-zone`}
            hint={
              <>
                {t('schedule.zoneHint')}
                {device && device !== draft.zone && (
                  <>
                    {' '}
                    {t('schedule.yourZone', { zone: device })}{' '}
                    <button
                      type="button"
                      onClick={() => update({ zone: device })}
                      className="focus-ring rounded-sm font-medium text-zinc-800 underline decoration-zinc-300 underline-offset-2 hover:decoration-zinc-500 dark:text-zinc-200 dark:decoration-zinc-600"
                    >
                      {t('schedule.useZone')}
                    </button>
                  </>
                )}
              </>
            }
          >
            <TimeZonePicker
              id={`${ids}-zone`}
              value={draft.zone}
              onChange={(zone) => update({ zone })}
            />
          </Field>
          <Field label={t('settings.limit')} htmlFor={`${ids}-max`}>
            <input
              id={`${ids}-max`}
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              placeholder={t('settings.unlimited')}
              className={cx(INPUT, 'w-[8.75rem]')}
              value={draft.max}
              onChange={(e) => update({ max: e.target.value })}
            />
            {max && Number.isInteger(max) && max > 0 ? (
              <ResponseProgress received={info.responses} max={max} />
            ) : (
              <p className={cx('mt-1.5', SUBTLE)}>
                {t('schedule.received', { n: info.responses })}
              </p>
            )}
          </Field>
        </div>

        {changed.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-[12.5px] text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
            <span>
              {t('schedule.overridden', {
                list: new Intl.ListFormat(t.locale).format(changed.map((key) => t(LABELS[key]))),
              })}
            </span>
            <Button
              variant="ghost"
              className="h-7 text-amber-800 dark:text-amber-300"
              disabled={busy}
              onClick={() => void run(() => clearOverrides(formId))}
            >
              {t('schedule.restore')}
            </Button>
          </div>
        )}

        {(problem ?? error) && (
          <p role="alert" className="mt-3 text-[12.5px] text-red-600 dark:text-red-400">
            {problem ?? error}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
          <p className="min-w-0 flex-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
            {/* Inline, not inline-flex: an empty dot would set the label's baseline at its bottom edge. */}
            {dirty && (
              <span className="mr-2 font-medium text-zinc-800 dark:text-zinc-200">
                <span
                  aria-hidden
                  className="mr-1.5 inline-block size-1.5 rounded-full bg-amber-500 align-middle"
                />
                {t('schedule.unsaved')}
              </span>
            )}
            {dev ? (
              <>
                {t('schedule.savesToCode')} <Kbd>forms/{formId}/index.tsx</Kbd>
              </>
            ) : (
              t('schedule.savesLive')
            )}
          </p>
          <div className="flex gap-1.5">
            {dirty && (
              <Button variant="ghost" disabled={busy} onClick={() => setDraft(initial)}>
                {t('common.cancel')}
              </Button>
            )}
            <Button type="submit" variant="primary" disabled={!dirty || busy || Boolean(problem)}>
              {t('schedule.save')}
            </Button>
          </div>
        </div>
      </form>
    </Card>
  );
}

function scheduleProblem(next: Schedule, timeZone: string): string | undefined {
  try {
    parseSchedule(next, timeZone);
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
}
