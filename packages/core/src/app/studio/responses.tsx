import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Inbox,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { isLocale, LOCALE_NAMES } from '../../schema/index.ts';
import {
  ApiError,
  deleteSubmission,
  deleteSubmissions,
  EXPORT_FORMATS,
  exportPath,
  formPath,
  type SubmissionDetail,
  type SubmissionPage,
  submissionIds,
  useResource,
} from './api.ts';
import { useFormDetail } from './form-detail.tsx';
import { fieldIndex, formatValue, fullDate, timeAgo } from './format.ts';
import { useT } from './i18n.tsx';
import { Button, ButtonLink, Card, cx, EmptyState, ErrorNotice, Skeleton } from './ui.tsx';

const PAGE_SIZE = 50;
const MAX_COLUMNS = 5;

const CHECKBOX =
  'focus-ring size-3.5 cursor-pointer rounded-sm accent-zinc-900 dark:accent-zinc-100';

/** Shift-click (or Shift-Space) ticks every row between it and the last one ticked. */
const withShift = (event: ChangeEvent<HTMLInputElement>) =>
  'shiftKey' in event.nativeEvent && event.nativeEvent.shiftKey === true;

/** Copies `text`; `copied` stays true for a moment so the button can say so. */
function useCopy(): [copied: boolean, copy: (text: string) => void] {
  const t = useT();
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => setCopied(true))
      .catch(() => toast.error(t('responses.copyFailed')));
  };
  return [copied, copy];
}

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export function Responses() {
  const { formId, info, reloadInfo } = useFormDetail();
  const { responseId } = useParams();
  const navigate = useNavigate();
  const t = useT();
  const yesNo = [t('common.yes'), t('common.no')] as const;
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const search = useDebounced(query.trim(), 250);
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // Every response matching the search, picked from the banner over the table.
  // Only for the form and search it was gathered for.
  const [gathered, setGathered] = useState<{
    formId: string;
    search: string;
    ids: ReadonlySet<string>;
  } | null>(null);
  const everything =
    gathered?.formId === formId && gathered.search === search ? gathered.ids : null;
  const [gathering, setGathering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const anchor = useRef<number | null>(null);
  const shown = useRef({ formId, search });
  shown.current = { formId, search };

  // biome-ignore lint/correctness/useExhaustiveDependencies: another form starts with no search
  useEffect(() => setQuery(''), [formId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search starts at the first page
  useEffect(() => setOffset(0), [formId, search]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search is a new set of responses
  useEffect(() => setGathered(null), [formId, search]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ticks belong to the page they were made on
  useEffect(() => {
    setSelected(new Set());
    anchor.current = null;
  }, [formId, offset, search]);

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (search) params.set('q', search);
  const page = useResource<SubmissionPage>(`${formPath(formId)}/submissions?${params}`, {
    scope: `${formPath(formId)}/submissions`,
  });
  const fields = useMemo(() => fieldIndex(info?.schema), [info]);
  const items = page.data?.items ?? [];
  // Prefer columns that have answers on this page; conditional fields are often empty.
  const allColumns = page.data?.columns ?? [];
  const filled = allColumns.filter((c) =>
    items.some((item) => formatValue(item.data[c.key]) !== ''),
  );
  const columns = (filled.length ? filled : allColumns).slice(0, MAX_COLUMNS);
  const total = page.data?.total ?? 0;
  const ticked = (id: string) => (everything ? everything.has(id) : selected.has(id));
  // Only what's ticked on screen: live updates can push a ticked row onto another page.
  const chosen = items.filter((item) => ticked(item.id));
  const allChosen = items.length > 0 && chosen.length === items.length;
  const count = everything ? everything.size : chosen.length;

  // Deleting the last responses on the last page leaves it empty; step back.
  useEffect(() => {
    if (page.data && offset > 0 && offset >= page.data.total) {
      setOffset(Math.max(0, Math.ceil(page.data.total / PAGE_SIZE) - 1) * PAGE_SIZE);
    }
  }, [page.data, offset]);

  const open = (id: string) => navigate(`/studio/${formId}/responses/${id}`);
  const close = () => navigate(`/studio/${formId}/responses`);

  const onDeleted = () => {
    close();
    page.reload();
    reloadInfo();
  };

  const tick = (index: number, on: boolean, range: boolean) => {
    const from = range && anchor.current !== null ? Math.min(anchor.current, index) : index;
    const to = range && anchor.current !== null ? Math.max(anchor.current, index) : index;
    // Changing one row of "everything" narrows the selection back to this page.
    const start = everything ? chosen.map((item) => item.id) : null;
    setGathered(null);
    setSelected((prev) => {
      const next = new Set(start ?? prev);
      for (const item of items.slice(from, to + 1)) {
        if (on) next.add(item.id);
        else next.delete(item.id);
      }
      return next;
    });
    anchor.current = index;
  };

  const clearSelection = () => {
    setSelected(new Set());
    setGathered(null);
    anchor.current = null;
  };

  const tickPage = () => {
    if (allChosen) return clearSelection();
    setGathered(null);
    setSelected(new Set(items.map((item) => item.id)));
    anchor.current = null;
  };

  const selectEverything = async () => {
    const asked = { formId, search };
    setGathering(true);
    try {
      const ids = await submissionIds(asked.formId, asked.search);
      const now = shown.current;
      if (now.formId === asked.formId && now.search === asked.search)
        setGathered({ ...asked, ids });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setGathering(false);
    }
  };

  const removeChosen = async () => {
    if (!count || !window.confirm(t.n('responses.confirmDeleteMany', count))) return;
    const ids = everything ? [...everything] : chosen.map((item) => item.id);
    setDeleting(true);
    try {
      const { deleted } = await deleteSubmissions(formId, ids);
      toast.success(t.n('responses.deleted', deleted));
      clearSelection();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setDeleting(false);
      // Batches that went through before a failure are gone either way.
      page.reload();
      reloadInfo();
    }
  };

  const bannerLink =
    'focus-ring rounded-sm font-medium text-zinc-900 underline underline-offset-2 hover:no-underline disabled:opacity-60 dark:text-zinc-100';

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-72">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('responses.search')}
            aria-label={t('responses.search')}
            className="focus-ring h-8 w-full rounded-md border border-zinc-200 bg-white pr-3 pl-8 text-[13px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
          />
        </div>
        <span className="text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {page.data && t.n('responses.count', total)}
        </span>
        <div className="ml-auto flex gap-2">
          {EXPORT_FORMATS.map(({ format, label }) => (
            <ButtonLink key={format} href={exportPath(formId, format)} download>
              <Download />
              {label}
            </ButtonLink>
          ))}
        </div>
      </div>

      {page.error && <ErrorNotice error={page.error} />}

      <Card className="overflow-hidden">
        {page.loading && !page.data ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={search ? t('responses.noMatches') : t('responses.empty')}
          >
            {search ? t('responses.noMatchesHint', { q: search }) : t('responses.emptyHint')}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            {(everything || (allChosen && total > items.length)) && (
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-[13px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
                {everything ? (
                  <>
                    <span>
                      {search
                        ? t('responses.allMatchingSelected', { n: everything.size, q: search })
                        : t('responses.allSelected', { n: everything.size })}
                    </span>
                    <button type="button" onClick={clearSelection} className={bannerLink}>
                      {t('responses.clearSelection')}
                    </button>
                  </>
                ) : (
                  <>
                    <span>{t.n('responses.pageSelected', items.length)}</span>
                    <button
                      type="button"
                      onClick={selectEverything}
                      disabled={gathering}
                      className={bannerLink}
                    >
                      {gathering
                        ? t('responses.selecting')
                        : search
                          ? t('responses.selectAllMatching', { n: total, q: search })
                          : t('responses.selectAll', { n: total })}
                    </button>
                  </>
                )}
              </div>
            )}
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  <th scope="col" className="w-10 py-2.5 pr-1 pl-4 font-medium">
                    <input
                      ref={(box) => {
                        if (box) box.indeterminate = chosen.length > 0 && !allChosen;
                      }}
                      type="checkbox"
                      className={cx(CHECKBOX, 'block')}
                      checked={allChosen}
                      onChange={tickPage}
                      aria-label={t('responses.selectPage')}
                    />
                  </th>
                  <th scope="col" className="w-14 py-2.5 pr-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-2.5 pr-4 font-medium whitespace-nowrap">
                    {t('responses.submitted')}
                  </th>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      scope="col"
                      className="py-2.5 pr-4 font-medium whitespace-nowrap"
                    >
                      {c.header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr
                    key={item.id}
                    // The tick cell selects; the rest of the row opens the response.
                    onClick={(e) => {
                      if (!(e.target as Element).closest('[data-tick]')) open(item.id);
                    }}
                    className={cx(
                      'cursor-pointer border-b border-zinc-100 transition-colors last:border-0 hover:bg-zinc-50 dark:border-zinc-800/70 dark:hover:bg-zinc-800/40',
                      ticked(item.id) && 'bg-zinc-50 dark:bg-zinc-800/40',
                    )}
                    aria-selected={item.id === responseId}
                  >
                    <td className="p-0" data-tick>
                      <label className="flex cursor-pointer items-center py-2.5 pr-1 pl-4">
                        <input
                          type="checkbox"
                          className={CHECKBOX}
                          checked={ticked(item.id)}
                          onChange={(e) => tick(index, e.target.checked, withShift(e))}
                          aria-label={t('responses.select', { n: item.number })}
                        />
                      </label>
                    </td>
                    <td className="py-2.5 pr-2 font-mono text-xs text-zinc-400 tabular-nums">
                      <button
                        type="button"
                        className="focus-ring rounded-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          open(item.id);
                        }}
                        aria-label={t('responses.open', { n: item.number })}
                      >
                        {item.number}
                      </button>
                    </td>
                    <td
                      className="py-2.5 pr-4 whitespace-nowrap text-zinc-500 dark:text-zinc-400"
                      title={fullDate(item.createdAt, t.locale)}
                    >
                      {timeAgo(item.createdAt, t.locale)}
                    </td>
                    {columns.map((c) => (
                      <td key={c.key} className="max-w-56 truncate py-2.5 pr-4">
                        {formatValue(item.data[c.key], fields.get(c.key), yesNo) || (
                          <span className="text-zinc-300 dark:text-zinc-700">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {total > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-end gap-2 text-[13px] text-zinc-500 tabular-nums">
          {t('responses.range', {
            from: offset + 1,
            to: Math.min(offset + PAGE_SIZE, total),
            total,
          })}
          <Button
            variant="ghost"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            aria-label={t('responses.prevPage')}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            disabled={offset + PAGE_SIZE >= total}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            aria-label={t('responses.nextPage')}
          >
            <ChevronRight />
          </Button>
        </div>
      )}

      {count > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center px-4">
          <div
            role="toolbar"
            aria-label={t.n('responses.selected', count)}
            className="studio-actionbar pointer-events-auto flex items-center gap-1 rounded-xl border border-zinc-200 bg-white p-1 pl-3 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
          >
            <span className="mr-2 text-[13px] font-medium whitespace-nowrap tabular-nums">
              {t.n('responses.selected', count)}
            </span>
            <Button variant="ghost" onClick={clearSelection}>
              {t('responses.clearSelection')}
            </Button>
            <Button variant="danger" onClick={removeChosen} disabled={deleting || gathering}>
              <Trash2 />
              {deleting ? t('responses.deleting') : t('common.delete')}
            </Button>
          </div>
        </div>
      )}

      {responseId && (
        <ResponseDrawer
          formId={formId}
          responseId={responseId}
          onClose={close}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
}

function ResponseDrawer({
  formId,
  responseId,
  onClose,
  onDeleted,
}: {
  formId: string;
  responseId: string;
  onClose(): void;
  onDeleted(): void;
}) {
  const { data, error } = useResource<SubmissionDetail>(
    `${formPath(formId)}/submissions/${encodeURIComponent(responseId)}`,
    { live: false },
  );
  const [deleting, setDeleting] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const t = useT();
  const yesNo = [t('common.yes'), t('common.no')] as const;
  // `onClose` is new on every render of the list; the drawer only focuses when it opens.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    closeRef.current?.focus();
    // A layer above (the command palette) handles its own Escape first.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      e.preventDefault();
      close.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submission = data?.submission;
  const fields = data?.schema?.fields ?? [];
  const seen = new Set<string>();
  const rows: Array<{ key: string; label: string; value: string }> = [];
  for (const field of fields) {
    if (seen.has(field.name) || !submission || !(field.name in submission.data)) continue;
    seen.add(field.name);
    rows.push({
      key: field.name,
      label: field.label ?? field.name,
      value: formatValue(submission.data[field.name], field, yesNo),
    });
  }
  for (const [key, value] of Object.entries(submission?.data ?? {})) {
    if (!seen.has(key)) rows.push({ key, label: key, value: formatValue(value, undefined, yesNo) });
  }

  const [copiedAll, copyAll] = useCopy();
  // Question over answer, a blank line between: reads well pasted anywhere, multi-line answers too.
  const allText = submission
    ? [
        `${t('responses.title', { n: submission.number })} · ${fullDate(submission.createdAt, t.locale)}`,
        ...rows.map((row) => `${row.label}\n${row.value || '—'}`),
      ].join('\n\n')
    : '';

  const remove = async () => {
    if (!submission || !window.confirm(t('responses.confirmDelete', { n: submission.number }))) {
      return;
    }
    setDeleting(true);
    try {
      await deleteSubmission(formId, submission.id);
      onDeleted();
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        toast(t('responses.alreadyDeleted', { n: submission.number }));
        onDeleted();
      } else {
        toast.error(error instanceof Error ? error.message : t('common.error'));
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label={t('responses.close')}
        tabIndex={-1}
        className="studio-backdrop absolute inset-0 bg-zinc-950/20 backdrop-blur-[1px] dark:bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="response-title"
        className="studio-drawer relative flex h-full w-full max-w-md flex-col border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div>
            <h2 id="response-title" className="text-base font-semibold tracking-tight">
              {submission
                ? t('responses.title', { n: submission.number })
                : t('responses.titleBare')}
            </h2>
            {submission && (
              <p className="mt-0.5 text-xs text-zinc-500">
                {fullDate(submission.createdAt, t.locale)}
                {submission.locale && isLocale(submission.locale) && (
                  <span> · {LOCALE_NAMES[submission.locale]}</span>
                )}
                {data?.version && <span className="font-mono"> · v{data.version}</span>}
              </p>
            )}
          </div>
          <Button ref={closeRef} variant="ghost" onClick={onClose} aria-label={t('common.close')}>
            <X />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && <ErrorNotice error={error} />}
          {!data && !error && (
            <div className="space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="mt-2 h-5 w-48" />
                </div>
              ))}
            </div>
          )}
          <dl className="space-y-4">
            {rows.map((row) => (
              <div key={row.key} className="group">
                <dt className="flex min-h-6 items-center justify-between gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  {row.label}
                  {row.value && (
                    <CopyButton
                      text={row.value}
                      label={t('responses.copy', { field: row.label })}
                    />
                  )}
                </dt>
                <dd className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {row.value || <span className="text-zinc-400">—</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="flex justify-between gap-2 border-t border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <Button onClick={() => copyAll(allText)} disabled={!submission}>
            {copiedAll ? <Check /> : <Copy />}
            {copiedAll ? t('responses.copied') : t('responses.copyAll')}
          </Button>
          <Button variant="danger" onClick={remove} disabled={!submission || deleting}>
            <Trash2 />
            {t('common.delete')}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const t = useT();
  const [copied, copy] = useCopy();
  const name = copied ? t('responses.copied') : label;
  return (
    <button
      type="button"
      onClick={() => copy(text)}
      aria-label={name}
      title={name}
      className={cx(
        'focus-ring grid size-6 shrink-0 place-items-center rounded-md text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-3.5',
        // Shown on hover where there is hover; always on touch screens.
        copied
          ? 'text-zinc-900 dark:text-zinc-100'
          : 'opacity-0 group-hover:opacity-100 [@media(hover:none)]:opacity-100',
      )}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
    </button>
  );
}
