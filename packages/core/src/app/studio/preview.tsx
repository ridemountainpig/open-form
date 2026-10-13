import appConfig from 'virtual:open-form/config';
import {
  CalendarClock,
  Eye,
  Languages,
  Lock,
  Monitor,
  PencilLine,
  RotateCw,
  Smartphone,
  Tablet,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { PreviewNotice } from '../../react/index.ts';
import {
  explainCondition,
  type FormSchema,
  LOCALE_NAMES,
  type Locale,
  schemaNames,
} from '../../schema/index.ts';
import { reportCurrent } from '../lib/forms.ts';
import {
  type ElementNames,
  type InspectPick,
  type InspectTarget,
  sameTarget,
  sendInspect,
  sendInspectSelect,
  sendPreviewCommand,
  shiftPick,
  usePreviewNav,
  usePreviewPicks,
} from '../lib/preview-channel.ts';
import { type SchemaInfo, useResource } from './api.ts';
import { type Comment, EditPanel } from './edit-panel.tsx';
import { useFormDetail } from './form-detail.tsx';
import { useT } from './i18n.tsx';
import { Button, cx, Dropdown, Segmented } from './ui.tsx';

const DEVICES = [
  { id: 'desktop', width: null, icon: Monitor },
  { id: 'tablet', width: 768, icon: Tablet },
  { id: 'mobile', width: 390, icon: Smartphone },
] as const;

type DeviceId = (typeof DEVICES)[number]['id'];

const STORAGE_KEY = 'open-form:preview-device';

function initialDevice(): DeviceId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (DEVICES.some((d) => d.id === stored)) return stored as DeviceId;
  } catch {}
  return 'desktop';
}

const NOTICE_ICONS = {
  closed: Lock,
  'not-open': CalendarClock,
  full: UsersRound,
  duplicate: UserCheck,
} as const;

/** The screens respondents can get instead of the form: any form can be closed, the rest follow its policy. */
function noticesOf(info: SchemaInfo | undefined): PreviewNotice[] {
  if (!info) return [];
  const notices: PreviewNotice[] = [{ state: 'closed' }];
  if (info.opensAt && Date.parse(info.opensAt) > Date.now()) {
    notices.push({ state: 'not-open', opensAt: info.opensAt });
  }
  if (info.schedule.maxResponses !== null) notices.push({ state: 'full' });
  // A field's duplicate is only found on submit, and shows as an error there.
  if (info.config.submissions?.uniqueBy === 'device') notices.push({ state: 'duplicate' });
  return notices;
}

/** Labels the preview needs to describe conditions in words, sent with each jump. */
function labelsOf(schema: FormSchema | undefined) {
  const fields: Record<string, string> = {};
  const options: Record<string, Record<string, string>> = {};
  for (const field of schema?.fields ?? []) {
    if (field.label) fields[field.name] ??= field.label;
    if (field.options) {
      options[field.name] ??= Object.fromEntries(field.options.map((o) => [o.value, o.label]));
    }
  }
  return { fields, options };
}

const NO_NAMES: ElementNames = {};

const targetOf = (pick: InspectPick): InspectTarget => ({
  loc: pick.loc,
  ...(pick.text !== undefined ? { text: pick.text } : {}),
  ...(pick.path ? { path: pick.path } : {}),
});

const typing = (target: EventTarget | null) =>
  target instanceof HTMLElement &&
  (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function Preview() {
  const { formId, info } = useFormDetail();
  const t = useT();
  const [device, setDevice] = useState<DeviceId>(initialDevice);
  const [language, setLanguage] = useState<Locale | ''>('');
  const frame = useRef<HTMLIFrameElement>(null);
  const shown = usePreviewNav(frame) ?? { step: 0, inspecting: false, done: false, notice: null };
  const current = DEVICES.find((d) => d.id === device) ?? DEVICES[0];
  const schema = info?.schema;
  const languages = info?.languages?.available ?? [];
  const names = useMemo(() => schemaNames(schema), [schema]);
  const labels = useMemo(() => labelsOf(schema), [schema]);
  const hasConditions = Boolean(schema?.fields.some((f) => f.when.length > 0));

  // Each step is named by its title, else its first question — "Step 3" says nothing.
  const steps = useMemo(
    () =>
      (schema?.pages ?? []).map((page) => {
        const fields = schema?.fields.filter((f) => f.page === page.index) ?? [];
        const first = fields.find((f) => f.label);
        return {
          index: page.index,
          name: page.title ?? first?.label ?? t('preview.step', { n: page.index + 1 }),
          fields: fields.map((f) => ({
            name: f.name,
            label: f.label ?? f.name,
            conditional: f.when.length > 0,
          })),
          condition: page.when.length ? explainCondition(page.when, names, t.locale) : null,
        };
      }),
    [schema, names, t],
  );

  // Edit mode (dev only: the dev server stamps source locations on the form).
  // Both belong to the form they were made on, never to the next one shown here.
  const [editingForm, setEditingForm] = useState<string | null>(null);
  const editing = editingForm === formId;
  const [picked, setPicked] = useState<{ formId: string; pick: InspectPick } | null>(null);
  const selection = picked?.formId === formId ? picked.pick : null;
  // The selection now, for saves that finish after the user picked something else.
  const latest = useRef(selection);
  latest.current = selection;
  const elements =
    useResource<{ elements: ElementNames }>(
      appConfig.dev && editing ? `/api/studio/source?form=${encodeURIComponent(formId)}` : null,
    ).data?.elements ?? NO_NAMES;
  const comments = useResource<{ comments: Comment[] }>(
    appConfig.dev ? `/api/studio/comments?form=${encodeURIComponent(formId)}` : null,
  );
  const commentList = comments.data?.comments ?? [];

  const select = useCallback(
    (next: InspectPick | null) => {
      latest.current = next;
      setPicked(next && { formId, pick: next });
      reportCurrent({
        formId,
        view: 'preview',
        selection: next && {
          loc: next.loc,
          field: next.field,
          text: next.part?.shown ?? next.text,
        },
      });
    },
    [formId],
  );
  const leave = useCallback(() => {
    setEditingForm(null);
    select(null);
  }, [select]);
  const onMissing = useCallback(
    (target: InspectTarget) => {
      const current = latest.current;
      if (current && sameTarget(targetOf(current), target)) select(null);
    },
    [select],
  );

  useEffect(() => {
    sendInspect(frame.current, editing, elements);
  }, [editing, elements]);
  useEffect(() => {
    if (editing) sendInspectSelect(frame.current, selection && targetOf(selection));
  }, [editing, selection]);
  // A reloaded preview (restart, another language) picks up where Edit mode is.
  const onReady = useCallback(() => {
    if (!editing) return;
    sendInspect(frame.current, true, elements);
    sendInspectSelect(frame.current, selection && targetOf(selection));
  }, [editing, elements, selection]);
  usePreviewPicks(frame, { onReady, onPick: select, onExit: leave, onMissing });

  // Escape clears the selection, then leaves Edit mode — as it does inside the preview.
  useEffect(() => {
    if (!editing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented || typing(event.target)) return;
      if (selection) select(null);
      else leave();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editing, selection, select, leave]);

  const onTextChanged = (at: InspectPick, from: string, to: string) => {
    const current = latest.current;
    if (!current || current.text !== from || !sameTarget(targetOf(current), targetOf(at))) return;
    const part = current.part && {
      ...current.part,
      ...(current.part.shown === from ? { shown: to } : {}),
    };
    select({ ...current, text: to, ...(part ? { part } : {}) });
  };
  // The line moved whatever is selected by then, not only what the note was on.
  const onCommented = (file: string, line: number, shifted: boolean) => {
    const current = latest.current;
    if (current && shifted) select(shiftPick(current, file, line));
  };

  const jump = (step: number) => sendPreviewCommand(frame.current, { type: 'goto', step, labels });
  const restart = () => frame.current?.contentWindow?.location.reload();

  const src = `/f/${encodeURIComponent(formId)}?preview=1${language ? `&lang=${language}` : ''}`;

  const pick = (id: DeviceId) => {
    setDevice(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {}
  };

  const sourceLocale = info?.config.locale ?? appConfig.locale;

  // The steps, then the screen respondents see after submitting.
  const items: RailEntry[] = [
    ...steps.map((step) => ({
      key: String(step.index),
      mark: String(step.index + 1),
      eyebrow: t('preview.step', { n: step.index + 1 }),
      name: step.name,
      meta: t.n('preview.questions', step.fields.length),
      hint: null,
      fields: step.fields,
      condition: step.condition,
      active: !shown.done && !shown.notice && shown.step === step.index,
      go: () => jump(step.index),
    })),
    {
      key: 'done',
      mark: '✓',
      eyebrow: null,
      name: t('preview.doneStep'),
      meta: null,
      hint: t('preview.doneHint'),
      fields: [],
      condition: null,
      active: Boolean(shown.done),
      go: () => sendPreviewCommand(frame.current, { type: 'done' }),
    },
  ];
  const notices = useMemo(() => noticesOf(info), [info]);
  const noticeItems: RailEntry[] = notices.map((notice) => {
    const Icon = NOTICE_ICONS[notice.state];
    return {
      key: `notice-${notice.state}`,
      mark: <Icon className="size-3.5" aria-hidden />,
      eyebrow: t('preview.notices'),
      name: t(`preview.notice.${notice.state}`),
      meta: null,
      hint: t(`preview.noticeHint.${notice.state}`),
      fields: [],
      condition: null,
      active: shown.notice === notice.state,
      go: () => sendPreviewCommand(frame.current, { type: 'notice', ...notice }),
    };
  });
  const tooltip = (item: RailEntry) =>
    [
      item.name,
      item.condition && t('preview.conditional', { condition: item.condition }),
      item.hint,
    ]
      .filter(Boolean)
      .join('\n');
  const revealable = steps.length <= 1 && hasConditions && !shown.inspecting;
  const peekId = useId();

  const railItem = (item: RailEntry) => (
    <li key={item.key} className={editing ? 'group relative' : undefined}>
      <button
        type="button"
        onClick={item.go}
        aria-current={item.active ? 'step' : undefined}
        // Collapsed, the step shows its details on hover instead.
        title={editing ? undefined : tooltip(item)}
        aria-label={editing ? item.name : undefined}
        aria-describedby={editing ? `${peekId}-${item.key}` : undefined}
        className={cx(
          'focus-ring flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors',
          item.active
            ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
            : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
          editing && 'justify-center',
        )}
      >
        <span
          className={cx(
            'relative grid size-6 shrink-0 place-items-center rounded-md font-mono text-[11px] tabular-nums',
            item.active ? 'bg-white/15 dark:bg-zinc-900/10' : 'bg-zinc-100 dark:bg-zinc-800',
          )}
        >
          {item.mark}
          {item.condition && editing && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-current"
            />
          )}
        </span>
        <span className={cx('min-w-0 flex-1', editing && 'hidden')}>
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] leading-5 font-medium">{item.name}</span>
            {item.condition && (
              <span
                className={cx(
                  'ml-auto shrink-0 rounded px-1 py-px text-[10.5px] font-medium',
                  item.active
                    ? 'bg-white/20 dark:bg-zinc-900/15'
                    : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
                )}
              >
                {t('preview.conditionalTag')}
              </span>
            )}
          </span>
          {item.meta && (
            <span className="block text-[11.5px] leading-4 opacity-60">{item.meta}</span>
          )}
        </span>
      </button>
      {editing && <StepPeek id={`${peekId}-${item.key}`} item={item} />}
    </li>
  );

  return (
    <div className="@container">
      <div
        className={cx(
          'grid items-start gap-4 @3xl:gap-5',
          editing
            ? '@3xl:grid-cols-[2.75rem_minmax(0,1fr)]'
            : '@3xl:grid-cols-[12.5rem_minmax(0,1fr)]',
        )}
      >
        {/* Beside the preview, like open-slide's page rail; just the numbers while editing. */}
        <nav aria-label={t('preview.steps')} className="hidden @3xl:sticky @3xl:top-6 @3xl:block">
          {/* As tall as the toolbar, so the first step lines up with the top of the preview. */}
          <h3
            className={cx(
              'mb-4 flex h-[2.125rem] items-center text-[11px] font-semibold whitespace-nowrap text-zinc-500 uppercase',
              // Collapsed, the label centers over the numbers and drops its letter-spacing to fit.
              editing ? 'justify-center' : 'px-2 tracking-wider',
            )}
          >
            {t('preview.steps')}
          </h3>
          <ol className="space-y-0.5">{items.map(railItem)}</ol>
          {noticeItems.length > 0 && (
            <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
              <h4
                className={cx(
                  'mb-1.5 px-2 text-[11px] font-semibold tracking-wider whitespace-nowrap text-zinc-500 uppercase',
                  editing && 'sr-only',
                )}
              >
                {t('preview.notices')}
              </h4>
              <ul className="space-y-0.5">{noticeItems.map(railItem)}</ul>
            </div>
          )}
          <div
            className={cx(
              'mt-4 space-y-2 border-t border-zinc-200 px-2 pt-4 text-[11.5px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400',
              editing && 'hidden',
            )}
          >
            {steps.some((s) => s.condition) && <p>{t('preview.stepsHint')}</p>}
            <p>{t('preview.realSubmissions')}</p>
          </div>
        </nav>

        <div className="min-w-0">
          <div className="mb-4 flex min-h-[2.125rem] flex-wrap items-center gap-2">
            <fieldset className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
              <legend className="sr-only">{t('preview.device')}</legend>
              {DEVICES.map(({ id, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={device === id}
                  aria-label={t(`device.${id}`)}
                  onClick={() => pick(id)}
                  className={cx(
                    'focus-ring flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium transition-colors',
                    device === id
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span className="hidden @2xl:inline" aria-hidden="true">
                    {t(`device.${id}`)}
                  </span>
                </button>
              ))}
            </fieldset>
            {languages.length > 1 && (
              <Dropdown<Locale | ''>
                label={t('preview.language')}
                className="w-44"
                value={language}
                onChange={setLanguage}
                options={[
                  { value: '', label: t('preview.languageAuto'), icon: <Languages /> },
                  ...languages.map((code) => ({
                    value: code,
                    label: LOCALE_NAMES[code],
                    icon: <Languages />,
                  })),
                ]}
              />
            )}
            <div className="ml-auto flex items-center gap-1">
              {appConfig.dev && (
                <span title={t('edit.editHint')}>
                  <Segmented<'preview' | 'edit'>
                    label={t('edit.mode')}
                    value={editing ? 'edit' : 'preview'}
                    onChange={(mode) => (mode === 'edit' ? setEditingForm(formId) : leave())}
                    options={[
                      { value: 'preview', label: t('edit.preview'), icon: <Eye aria-hidden /> },
                      {
                        value: 'edit',
                        label: t('edit.edit'),
                        icon: <PencilLine aria-hidden />,
                        detail:
                          commentList.length > 0 ? (
                            <span className="rounded-full bg-current/15 px-1.5 text-[10.5px] tabular-nums">
                              {commentList.length}
                            </span>
                          ) : null,
                      },
                    ]}
                  />
                </span>
              )}
              <Button
                variant="ghost"
                onClick={restart}
                aria-label={t('preview.restart')}
                title={t('preview.restart')}
              >
                <RotateCw />
              </Button>
            </div>
          </div>

          <nav aria-label={t('preview.steps')} className="mb-3 @3xl:hidden">
            <ol className="flex gap-1.5 overflow-x-auto pb-1">
              {[...items, ...noticeItems].map((item) => (
                <li
                  key={item.key}
                  className={cx(
                    'min-w-0 shrink-0',
                    item === noticeItems[0] &&
                      'ml-1.5 border-l border-zinc-200 pl-3 dark:border-zinc-800',
                  )}
                >
                  <button
                    type="button"
                    onClick={item.go}
                    aria-current={item.active ? 'step' : undefined}
                    title={tooltip(item)}
                    className={cx(
                      'focus-ring flex h-8 max-w-60 items-center gap-2 rounded-lg border px-2.5 text-[12.5px] transition-colors',
                      item.active
                        ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                        : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                    )}
                  >
                    <span className="font-mono text-[11px] tabular-nums opacity-60">
                      {item.mark}
                    </span>
                    <span className="truncate">{item.name}</span>
                    {item.condition && (
                      <span className="shrink-0 rounded bg-current/15 px-1 py-px text-[10.5px] font-medium">
                        {t('preview.conditionalTag')}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ol>
          </nav>

          <div
            className={cx(
              'grid items-start gap-4 @3xl:gap-5',
              editing && '@4xl:grid-cols-[minmax(0,1fr)_20rem]',
            )}
          >
            <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.06)_1px,transparent_0)] [background-size:16px_16px] p-3 sm:p-6 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)]">
              {(shown.inspecting || revealable) && (
                <div className="flex max-w-full items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 text-[12px] text-zinc-600 shadow-[0_1px_2px_rgb(0_0_0/0.04)] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  <Eye className="size-3.5 shrink-0" aria-hidden />
                  {shown.inspecting ? (
                    <>
                      <span className="truncate">
                        {t(shown.notice ? 'preview.noticeShowing' : 'preview.inspecting')}
                      </span>
                      <button
                        type="button"
                        onClick={restart}
                        className="focus-ring shrink-0 rounded-sm font-medium text-zinc-900 underline underline-offset-2 hover:no-underline dark:text-zinc-100"
                      >
                        {t('preview.exitInspect')}
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => jump(0)}
                      className="focus-ring rounded-sm font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                    >
                      {t('preview.reveal')}
                    </button>
                  )}
                </div>
              )}
              <div
                className={cx(
                  'w-full overflow-hidden bg-white shadow-[0_8px_40px_-12px_rgb(0_0_0/0.25)] transition-[max-width] duration-300 ease-out dark:bg-zinc-950',
                  current.width
                    ? 'rounded-[20px] border border-zinc-200 dark:border-zinc-800'
                    : 'rounded-lg',
                )}
                style={{ maxWidth: current.width ?? '100%' }}
              >
                <iframe
                  ref={frame}
                  key={src}
                  title={t('preview.frameTitle', { id: formId })}
                  src={src}
                  className="block h-[min(78dvh,880px)] w-full"
                />
              </div>
            </div>
            {editing && (
              <aside
                aria-label={t('edit.panel')}
                className="flex max-h-[80dvh] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white @4xl:sticky @4xl:top-6 @4xl:max-h-[calc(100dvh-3rem)] dark:border-zinc-800 dark:bg-zinc-900"
              >
                <EditPanel
                  selection={selection}
                  names={elements}
                  sourceLocale={sourceLocale}
                  comments={{ list: commentList, reload: comments.reload }}
                  onSelect={select}
                  onTextChanged={onTextChanged}
                  onCommented={onCommented}
                  onClose={leave}
                />
              </aside>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const LISTED = 8;

type RailEntry = RailItem & {
  key: string;
  mark: ReactNode;
  active: boolean;
  go(): void;
};

type RailItem = {
  eyebrow: string | null;
  name: string;
  meta: string | null;
  hint: string | null;
  condition: string | null;
  fields: Array<{ name: string; label: string; conditional: boolean }>;
};

/** A collapsed step's details, beside it while it is hovered or focused from the keyboard. */
function StepPeek({ id, item }: { id: string; item: RailItem }) {
  const t = useT();
  const listed = item.fields.slice(0, LISTED);
  return (
    <div
      id={id}
      role="tooltip"
      className="pointer-events-none invisible absolute top-0 left-full z-30 ml-2 w-64 -translate-x-1 rounded-lg border border-zinc-200 bg-white p-3 opacity-0 shadow-lg transition-[opacity,translate,visibility] duration-150 group-hover:visible group-hover:translate-x-0 group-hover:opacity-100 group-hover:delay-75 group-has-[:focus-visible]:visible group-has-[:focus-visible]:translate-x-0 group-has-[:focus-visible]:opacity-100 motion-reduce:transition-none dark:border-zinc-800 dark:bg-zinc-900"
    >
      {item.eyebrow && <p className="text-[11px] font-medium text-zinc-400">{item.eyebrow}</p>}
      <p className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">{item.name}</p>
      {item.meta && <p className="text-[12px] text-zinc-500 dark:text-zinc-400">{item.meta}</p>}
      {item.hint && (
        <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {item.hint}
        </p>
      )}
      {item.condition && (
        <p className="mt-2 rounded-md bg-zinc-100 px-2 py-1 text-[11.5px] leading-snug text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {t('preview.conditional', { condition: item.condition })}
        </p>
      )}
      {listed.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-zinc-100 pt-2 dark:border-zinc-800">
          {listed.map((field) => (
            <li
              key={field.name}
              className="flex items-baseline gap-1.5 text-[12px] text-zinc-700 dark:text-zinc-300"
            >
              <span className="size-1 shrink-0 translate-y-[-2px] rounded-full bg-zinc-300 dark:bg-zinc-600" />
              <span className="min-w-0 truncate">{field.label}</span>
              {field.conditional && (
                <span className="ml-auto shrink-0 rounded bg-zinc-100 px-1 text-[10.5px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  {t('preview.conditionalTag')}
                </span>
              )}
            </li>
          ))}
          {item.fields.length > LISTED && (
            <li className="pl-2.5 text-[11.5px] text-zinc-400">
              {t('preview.more', { n: item.fields.length - LISTED })}
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
