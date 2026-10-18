import {
  ArrowDownAZ,
  ArrowUpRight,
  ChevronDown,
  Clock,
  FileText,
  FolderInput,
  Inbox,
  Layers,
  LayoutGrid,
  ListFilter,
  Search,
  TriangleAlert,
  X,
} from 'lucide-react';
import { type DragEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { FormStatus, FormSummary } from './api.ts';
import { FORM_DND_TYPE, useStudioData } from './data.tsx';
import { canDeleteForms, DeleteFormButton } from './delete-form.tsx';
import { FolderIconChip, UnfiledIcon, useMoveForm } from './folders.tsx';
import { useT } from './i18n.tsx';
import { UNFILED } from './sidebar.tsx';
import { Thumbnail } from './thumbnail.tsx';
import {
  Button,
  Card,
  ChoiceMenu,
  EmptyState,
  ErrorNotice,
  Kbd,
  PageHeader,
  Skeleton,
  StatusDot,
} from './ui.tsx';

type SortKey = 'updated' | 'activity' | 'responses' | 'name';
const SORT_KEYS: SortKey[] = ['updated', 'activity', 'responses', 'name'];
const SORT_STORAGE = 'open-form:forms-sort';

function initialSort(): SortKey {
  try {
    const stored = localStorage.getItem(SORT_STORAGE) as SortKey | null;
    if (stored && SORT_KEYS.includes(stored)) return stored;
  } catch {}
  return 'updated';
}

const STATUSES: FormStatus[] = ['open', 'not-open', 'closed', 'full', 'unpublished'];
type StatusFilter = FormStatus | 'all';
const statusOf = (form: FormSummary) => (form.error ? undefined : (form.status ?? 'open'));

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const time = (iso: string | undefined) => (iso ? Date.parse(iso) : 0);

function sortForms(forms: FormSummary[], key: SortKey): FormSummary[] {
  const byName = (a: FormSummary, b: FormSummary) => collator.compare(a.title, b.title);
  const by = {
    updated: (a: FormSummary, b: FormSummary) =>
      time(b.updatedAt) - time(a.updatedAt) || byName(a, b),
    activity: (a: FormSummary, b: FormSummary) =>
      time(b.lastResponseAt) - time(a.lastResponseAt) || byName(a, b),
    responses: (a: FormSummary, b: FormSummary) => b.responses - a.responses || byName(a, b),
    name: byName,
  }[key];
  return [...forms].sort(by);
}

export function FormsList() {
  const t = useT();
  const [params, setParams] = useSearchParams();
  const { forms: resource, folders } = useStudioData();
  const { data, error, loading } = resource;
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(initialSort);
  const filter = params.get('f');
  const status = (STATUSES as string[]).includes(params.get('status') ?? '')
    ? (params.get('status') as FormStatus)
    : 'all';
  const folder =
    filter && filter !== UNFILED
      ? folders.manifest.folders.find((f) => f.id === filter)
      : undefined;

  const pickStatus = (next: StatusFilter) =>
    setParams(
      (current) => {
        const updated = new URLSearchParams(current);
        if (next === 'all') updated.delete('status');
        else updated.set('status', next);
        return updated;
      },
      { replace: true },
    );

  const pickSort = (key: SortKey) => {
    setSort(key);
    try {
      localStorage.setItem(SORT_STORAGE, key);
    } catch {}
  };

  const inView = useMemo(() => {
    const all = data?.forms ?? [];
    if (filter === UNFILED) return all.filter((f) => !folders.folderOf(f.id));
    if (filter) return all.filter((f) => folders.folderOf(f.id)?.id === filter);
    return all;
  }, [data, filter, folders]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matched = inView.filter(
      (f) =>
        (status === 'all' || statusOf(f) === status) &&
        (!q || [f.title, f.id, f.description ?? ''].some((text) => text.toLowerCase().includes(q))),
    );
    return sortForms(matched, sort);
  }, [inView, status, query, sort]);

  const counts = useMemo(() => {
    const byStatus = {
      open: 0,
      'not-open': 0,
      closed: 0,
      full: 0,
      unpublished: 0,
    } satisfies Record<FormStatus, number>;
    for (const form of inView) {
      const s = statusOf(form);
      if (s) byStatus[s] += 1;
    }
    return byStatus;
  }, [inView]);
  const filtered = Boolean(query.trim()) || status !== 'all';
  const statusLabel = (s: StatusFilter) => (s === 'all' ? t('forms.status.all') : t(`status.${s}`));

  const responses = inView.reduce((sum, f) => sum + f.responses, 0);
  const title =
    filter === UNFILED ? t('folders.unfiled') : (folder?.name ?? (filter ? '…' : t('nav.forms')));
  const icon =
    filter === UNFILED ? (
      <UnfiledIcon />
    ) : folder ? (
      <FolderIconChip icon={folder.icon} />
    ) : (
      <LayoutGrid />
    );

  return (
    <div>
      <PageHeader
        icon={icon}
        title={title}
        count={data ? (filtered ? shown.length : inView.length) : undefined}
        aside={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap">
            {inView.length > 0 && (
              <span className="mr-1 hidden text-[13px] text-zinc-500 tabular-nums lg:inline dark:text-zinc-400">
                {t.n('responses.count', responses)}
              </span>
            )}
            <ChoiceMenu<StatusFilter>
              label={t('forms.status')}
              display="button"
              placement="bottom"
              className="min-w-0 flex-1 sm:flex-none"
              trigger={
                <>
                  {status === 'all' ? <ListFilter /> : <StatusDot status={status} />}
                  <span className="truncate">{statusLabel(status)}</span>
                  <ChevronDown className="ml-auto" />
                </>
              }
              value={status}
              onSelect={pickStatus}
              options={[
                {
                  value: 'all',
                  label: statusLabel('all'),
                  icon: <ListFilter />,
                  detail: String(inView.length),
                },
                ...STATUSES.map((s) => ({
                  value: s,
                  label: statusLabel(s),
                  icon: <StatusDot status={s} />,
                  detail: String(counts[s]),
                })),
              ]}
            />
            <ChoiceMenu<SortKey>
              label={t('forms.sort')}
              display="button"
              placement="bottom"
              className="min-w-0 flex-1 sm:flex-none"
              trigger={
                <>
                  {sort === 'name' ? <ArrowDownAZ /> : <Clock />}
                  <span className="truncate">{t(`forms.sort.${sort}`)}</span>
                  <ChevronDown className="ml-auto" />
                </>
              }
              value={sort}
              onSelect={pickSort}
              options={SORT_KEYS.map((key) => ({
                value: key,
                label: t(`forms.sort.${key}`),
                icon: key === 'name' ? <ArrowDownAZ /> : <Clock />,
              }))}
            />
            <div className="relative w-full sm:w-60">
              <Search
                className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
                placeholder={t('forms.search')}
                aria-label={t('forms.search')}
                className="focus-ring h-8 w-full rounded-md border border-zinc-200 bg-white pr-8 pl-8 text-[13px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  aria-label={t('forms.clearSearch')}
                  onClick={() => setQuery('')}
                  className="focus-ring absolute top-1/2 right-1.5 grid size-5 -translate-y-1/2 place-items-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              )}
            </div>
          </div>
        }
      />

      {error && <ErrorNotice error={error} />}

      {loading && !data && (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="aspect-[16/10] w-full rounded-lg" />
              <Skeleton className="mt-3 h-4 w-2/3" />
              <Skeleton className="mt-2 h-3 w-1/3" />
            </div>
          ))}
        </div>
      )}

      {data && data.forms.length === 0 && (
        <Card>
          <EmptyState icon={<FileText />} title={t('forms.empty')}>
            {t('forms.emptyHint.before')}
            <Kbd>forms/</Kbd>
            {t('forms.emptyHint.middle')}
            <em>{t('forms.emptyHint.example')}</em>
            {t('forms.emptyHint.or')}
            <Kbd>open-form create my-form</Kbd>
            {t('forms.emptyHint.after')}
          </EmptyState>
        </Card>
      )}

      {data && data.forms.length > 0 && inView.length === 0 && (
        <Card>
          <EmptyState icon={<FolderInput />} title={t('forms.emptyFolder')}>
            {folders.editable ? t('forms.emptyFolderHint') : null}
          </EmptyState>
        </Card>
      )}

      {inView.length > 0 && shown.length === 0 && (
        <Card>
          <EmptyState
            icon={query.trim() ? <Search /> : <ListFilter />}
            title={
              query.trim()
                ? t('forms.noMatches', { q: query.trim() })
                : t('forms.noStatus', { status: statusLabel(status) })
            }
          >
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {query.trim() && (
                <Button onClick={() => setQuery('')}>{t('forms.clearSearch')}</Button>
              )}
              {status !== 'all' && (
                <Button onClick={() => pickStatus('all')}>{t('forms.showAll')}</Button>
              )}
            </div>
          </EmptyState>
        </Card>
      )}

      {shown.length > 0 && (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((form) => (
            <FormTile key={form.id} form={form} showFolder={!filter} />
          ))}
        </div>
      )}
    </div>
  );
}

/** A small off-screen pill used as the drag image, so the cursor carries the form's name. */
function dragChip(title: string): HTMLElement {
  const chip = document.createElement('div');
  chip.textContent = title;
  Object.assign(chip.style, {
    position: 'fixed',
    top: '-9999px',
    left: '-9999px',
    padding: '6px 10px',
    borderRadius: '8px',
    font: '500 13px system-ui, sans-serif',
    background: 'white',
    color: '#18181b',
    border: '1px solid #e4e4e7',
    boxShadow: '0 8px 24px -8px rgb(0 0 0 / 0.25)',
    whiteSpace: 'nowrap',
  });
  document.body.append(chip);
  return chip;
}

function FormTile({ form, showFolder }: { form: FormSummary; showFolder: boolean }) {
  const t = useT();
  const { folders } = useStudioData();
  const moveForm = useMoveForm();
  const [dragging, setDragging] = useState(false);
  const folder = folders.folderOf(form.id);

  const onDragStart = (e: DragEvent) => {
    e.dataTransfer.setData(FORM_DND_TYPE, form.id);
    e.dataTransfer.effectAllowed = 'move';
    const chip = dragChip(form.title);
    e.dataTransfer.setDragImage(chip, 14, 14);
    setTimeout(() => chip.remove(), 0);
    setDragging(true);
  };

  return (
    <article
      className={`group relative min-w-0 transition-opacity ${dragging ? 'opacity-40' : ''}`}
      draggable={folders.editable}
      onDragStart={folders.editable ? onDragStart : undefined}
      onDragEnd={() => setDragging(false)}
    >
      <Thumbnail
        src={`/f/${encodeURIComponent(form.id)}?thumb=1`}
        className="transition-[border-color,box-shadow] group-hover:border-zinc-300 group-hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)] dark:group-hover:border-zinc-700"
      >
        {form.error && (
          <div className="flex h-full flex-col justify-center gap-2 bg-red-50/60 p-5 dark:bg-red-950/20">
            <TriangleAlert className="size-4 text-red-500" aria-hidden />
            <p className="line-clamp-4 font-mono text-[11.5px] leading-relaxed text-red-700 dark:text-red-400">
              {form.error}
            </p>
          </div>
        )}
      </Thumbnail>
      <div className="mt-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[14px] font-medium">
            <StatusDot status={form.error ? 'error' : (form.status ?? 'open')} />
            <Link
              to={`/studio/${form.id}`}
              draggable={false}
              className="focus-ring truncate rounded-sm after:absolute after:inset-0"
            >
              {form.title}
            </Link>
          </h2>
          <p className="mt-1 flex items-center gap-3 text-xs text-zinc-500 tabular-nums dark:text-zinc-400">
            <span className="truncate font-mono">{form.id}</span>
            <Link
              to={`/studio/${form.id}/responses`}
              draggable={false}
              className="focus-ring relative z-10 -mx-1 flex shrink-0 items-center gap-1 rounded px-1 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={t('forms.viewResponses', { n: form.responses })}
              title={t('forms.viewResponsesShort')}
            >
              <Inbox className="size-3.5" aria-hidden />
              {form.responses}
              {form.maxResponses !== undefined && ` / ${form.maxResponses}`}
            </Link>
            {form.pages !== undefined && form.pages > 1 && (
              <span className="flex shrink-0 items-center gap-1">
                <Layers className="size-3.5" aria-hidden />
                {form.pages}
              </span>
            )}
            {folder && showFolder && (
              <span className="flex min-w-0 items-center gap-1" title={folder.name}>
                <FolderIconChip icon={folder.icon} className="size-3.5" />
                <span className="truncate">{folder.name}</span>
              </span>
            )}
          </p>
        </div>
        <div className="relative z-10 flex shrink-0 items-center">
          {(folders.editable || canDeleteForms) && (
            <div className="flex items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
              {canDeleteForms && (
                <DeleteFormButton
                  form={{ id: form.id, title: form.title, responses: form.responses }}
                />
              )}
              {folders.editable && (
                <ChoiceMenu<string>
                  label={t('forms.moveTo')}
                  placement="bottom"
                  trigger={<FolderInput />}
                  value={folder?.id ?? UNFILED}
                  onSelect={(id) => moveForm(form.id, id === UNFILED ? null : id)}
                  options={[
                    { value: UNFILED, label: t('folders.unfiled'), icon: <UnfiledIcon /> },
                    ...folders.manifest.folders.map((f) => ({
                      value: f.id,
                      label: f.name,
                      icon: <FolderIconChip icon={f.icon} />,
                    })),
                  ]}
                />
              )}
            </div>
          )}
          {form.status !== 'unpublished' && (
            <a
              href={`/f/${form.id}`}
              target="_blank"
              rel="noreferrer"
              draggable={false}
              className="focus-ring grid size-7 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              aria-label={t('forms.openLive', { title: form.title })}
              title={t('forms.openLiveShort')}
            >
              <ArrowUpRight className="size-4" aria-hidden />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
