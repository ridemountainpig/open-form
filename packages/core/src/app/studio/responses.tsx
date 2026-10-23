import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Columns3,
  Copy,
  Download,
  Inbox,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import {
  AddFilter,
  ColumnMenu,
  type ColumnSort,
  EMPTY_FILTER,
  FilterBar,
  type FilterDraft,
  type FilterProperty,
  filterQuery,
  newRule,
  readyCount,
  SortChip,
  sortQuery,
} from './response-filters.tsx';
import { useReadOnly } from './session.tsx';
import {
  Button,
  Card,
  cx,
  Dropdown,
  EmptyState,
  ErrorNotice,
  Popover,
  Segmented,
  Skeleton,
  useConfirm,
} from './ui.tsx';

const PAGE_SIZE = 50;
const MAX_COLUMNS = 5;
// New responses show up without a reload while the list is open.
const REFRESH_MS = 5000;

const columnsKey = (formId: string) => `open-form:columns:${formId}`;

function storedColumns(formId: string): string[] | null {
  try {
    const raw = localStorage.getItem(columnsKey(formId));
    const keys: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(keys) && keys.every((k) => typeof k === 'string') ? keys : null;
  } catch {
    return null;
  }
}

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
  const readOnly = useReadOnly();
  const yesNo = [t('common.yes'), t('common.no')] as const;
  const [query, setQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const search = useDebounced(query.trim(), 250);
  const [filterDraft, setFilterDraft] = useState<FilterDraft>(EMPTY_FILTER);
  const [editing, setEditing] = useState<string | null>(null);
  // Days of "Submitted" rules are the viewer's days, like the times in the table.
  const timeZone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, []);
  const filter = useDebounced(filterQuery(filterDraft, timeZone), 250);
  const narrowed = Boolean(search || filter);
  const fields = useMemo(() => fieldIndex(info?.schema), [info]);
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const order = sortQuery(sort, sort?.field === undefined ? undefined : fields.get(sort.field));
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());
  // Every response matching the search and filters, picked from the banner over
  // the table. Only for the form, search and filters it was gathered for.
  const [gathered, setGathered] = useState<{
    formId: string;
    search: string;
    filter: string;
    ids: ReadonlySet<string>;
  } | null>(null);
  const everything =
    gathered?.formId === formId && gathered.search === search && gathered.filter === filter
      ? gathered.ids
      : null;
  const [gathering, setGathering] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  // The columns picked for this form, kept in the browser; null is the default set.
  const [chosenColumns, setChosenColumns] = useState(() => storedColumns(formId));
  const anchor = useRef<number | null>(null);
  const shown = useRef({ formId, search, filter });
  shown.current = { formId, search, filter };

  // biome-ignore lint/correctness/useExhaustiveDependencies: another form starts with no search or filters
  useEffect(() => {
    setQuery('');
    setFilterDraft(EMPTY_FILTER);
    setEditing(null);
    setSort(null);
  }, [formId]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search or order starts at the first page
  useEffect(() => setOffset(0), [formId, search, filter, order]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new search is a new set of responses
  useEffect(() => setGathered(null), [formId, search, filter]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: ticks belong to the page they were made on
  useEffect(() => {
    setSelected(new Set());
    anchor.current = null;
  }, [formId, offset, search, filter, order]);

  const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
  if (search) params.set('q', search);
  if (filter) params.set('filter', filter);
  if (order) params.set('sort', order);
  const page = useResource<SubmissionPage>(`${formPath(formId)}/submissions?${params}`, {
    scope: `${formPath(formId)}/submissions`,
    refresh: REFRESH_MS,
  });
  const items = page.data?.items ?? [];
  const allColumns = page.data?.columns ?? [];
  const submitted: FilterProperty = { label: t('responses.submitted') };
  const properties: FilterProperty[] = [
    submitted,
    ...allColumns.map((c) => ({
      field: c.key,
      label: c.header,
      type: c.type ?? fields.get(c.key)?.type,
      options: fields.get(c.key)?.options,
    })),
  ];
  // The picked columns, else the first questions every respondent sees: conditional
  // ones are often empty. Not drawn from the answers on screen, so a search
  // doesn't move columns around. Sorted and filtered questions always show.
  const defaultColumns = useMemo(() => {
    const always = allColumns.filter((c) => !fields.get(c.key)?.when.length);
    return [...new Set([...always, ...allColumns])].slice(0, MAX_COLUMNS).map((c) => c.key);
  }, [allColumns, fields]);
  const picked = new Set([
    ...(chosenColumns ?? defaultColumns),
    sort?.field,
    ...filterDraft.rules.map((rule) => rule.field),
  ]);
  const columns = allColumns.filter((c) => picked.has(c.key));
  const pickColumns = (keys: string[] | null) => {
    setChosenColumns(keys);
    try {
      if (keys) localStorage.setItem(columnsKey(formId), JSON.stringify(keys));
      else localStorage.removeItem(columnsKey(formId));
    } catch {}
  };
  const total = page.data?.total ?? 0;
  const ticked = (id: string) => (everything ? everything.has(id) : selected.has(id));
  // Only what's ticked on screen: live updates can push a ticked row onto another page.
  const chosen = items.filter((item) => ticked(item.id));
  const allChosen = items.length > 0 && chosen.length === items.length;
  const count = everything ? everything.size : chosen.length;

  // Keeps the tab's count in step with responses that arrive while the list is open.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new page of data can disagree
  useEffect(() => {
    if (page.data && !narrowed && info && page.data.total !== info.responses) reloadInfo();
  }, [page.data]);

  // Responses newer than any seen on the first page, newest first, get a brief highlight.
  // Only that view is a baseline: other pages, searches and sorts show older ones too.
  const newest = useRef<number | null>(null);
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set());
  // biome-ignore lint/correctness/useExhaustiveDependencies: compared once per page of data
  useEffect(() => {
    if (!page.data || narrowed || offset > 0 || sort) return;
    const top = Math.max(0, ...page.data.items.map((item) => item.number));
    if (newest.current !== null) {
      const since = newest.current;
      const added = page.data.items.filter((item) => item.number > since);
      if (added.length) setFresh(new Set(added.map((item) => item.id)));
    }
    newest.current = Math.max(newest.current ?? 0, top);
  }, [page.data]);

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

  const addFilter = (property: FilterProperty) => {
    const rule = newRule(property);
    setFilterDraft((draft) => ({ ...draft, rules: [...draft.rules, rule] }));
    setEditing(rule.id);
  };

  const clearFilters = () => {
    setFilterDraft(EMPTY_FILTER);
    setEditing(null);
  };

  const selectEverything = async () => {
    const asked = { formId, search, filter };
    setGathering(true);
    try {
      const ids = await submissionIds(asked.formId, asked.search, asked.filter);
      const now = shown.current;
      if (now.formId === asked.formId && now.search === asked.search && now.filter === asked.filter)
        setGathered({ ...asked, ids });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('common.error'));
    } finally {
      setGathering(false);
    }
  };

  const removeChosen = async () => {
    if (
      !count ||
      !(await confirm({
        title: t.n('responses.confirmDeleteMany', count),
        message: t('common.cannotUndo'),
        confirmLabel: t('common.delete'),
      }))
    ) {
      return;
    }
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
        <div className="relative w-full sm:w-auto sm:max-w-72 sm:min-w-40 sm:flex-1">
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
        <AddFilter properties={properties} onPick={addFilter} count={readyCount(filterDraft)} />
        {/* Phones have no column headings to sort from. */}
        <div className="sm:hidden">
          <Dropdown
            label={t('sort.label')}
            showLabel
            value={sort ? String(properties.findIndex((p) => p.field === sort.field)) : 'newest'}
            options={[
              { value: 'newest', label: t('sort.newest') },
              ...properties.map((p, index) => ({ value: String(index), label: p.label })),
            ]}
            onChange={(value) => {
              const property = properties[Number(value)];
              setSort(
                value === 'newest' || !property
                  ? null
                  : {
                      ...(property.field !== undefined && { field: property.field }),
                      direction: 'asc',
                    },
              );
            }}
          />
        </div>
        <span className="text-[13px] text-zinc-500 tabular-nums dark:text-zinc-400">
          {page.data &&
            (narrowed && info
              ? t.n('responses.countOf', info.responses, { shown: total })
              : t.n('responses.count', total))}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ColumnPicker
            columns={allColumns}
            shown={columns.map((c) => c.key)}
            custom={chosenColumns !== null}
            onChange={pickColumns}
          />
          <ExportMenu
            formId={formId}
            count={info?.responses}
            matching={narrowed && page.data ? total : undefined}
            narrow={{ q: search, filter }}
          />
        </div>
      </div>

      {(filterDraft.rules.length > 0 || sort) && (
        <FilterBar
          draft={filterDraft}
          properties={properties}
          editing={editing}
          onEdit={setEditing}
          onChange={setFilterDraft}
          onAdd={addFilter}
          leading={sort && <SortChip sort={sort} properties={properties} onChange={setSort} />}
        />
      )}

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
            title={narrowed ? t('responses.noMatches') : t('responses.empty')}
          >
            {filter ? (
              <>
                {t('responses.noMatchesFiltered')}
                <span className="mt-3 block">
                  <Button onClick={clearFilters}>{t('filters.clear')}</Button>
                </span>
              </>
            ) : search ? (
              t('responses.noMatchesHint', { q: search })
            ) : (
              t('responses.emptyHint')
            )}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            {(everything || (allChosen && total > items.length)) && (
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-[13px] text-zinc-600 dark:border-zinc-800 dark:bg-zinc-800/40 dark:text-zinc-300">
                {everything ? (
                  <>
                    <span>
                      {filter
                        ? t('responses.allFilteredSelected', { n: everything.size })
                        : search
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
                        : filter
                          ? t('responses.selectAllFiltered', { n: total })
                          : search
                            ? t('responses.selectAllMatching', { n: total, q: search })
                            : t('responses.selectAll', { n: total })}
                    </button>
                  </>
                )}
              </div>
            )}
            <ul className="divide-y divide-zinc-100 sm:hidden dark:divide-zinc-800/70">
              {items.map((item, index) => {
                const [lead, ...rest] = columns
                  .map((c) => formatValue(item.data[c.key], fields.get(c.key), yesNo))
                  .filter(Boolean);
                return (
                  // biome-ignore lint/a11y/useKeyWithClickEvents: the number inside is the keyboard way in
                  <li
                    key={item.id}
                    onClick={(e) => {
                      if (!(e.target as Element).closest('[data-tick]')) open(item.id);
                    }}
                    className={cx(
                      'flex cursor-pointer items-start gap-3 px-4 py-3 active:bg-zinc-50 dark:active:bg-zinc-800/40',
                      ticked(item.id) && 'bg-zinc-50 dark:bg-zinc-800/40',
                      fresh.has(item.id) && 'studio-new-row',
                    )}
                  >
                    {!readOnly && (
                      <label className="-m-2 flex cursor-pointer p-2" data-tick>
                        <input
                          type="checkbox"
                          className={CHECKBOX}
                          checked={ticked(item.id)}
                          onChange={(e) => tick(index, e.target.checked, withShift(e))}
                          aria-label={t('responses.select', { n: item.number })}
                        />
                      </label>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <button
                          type="button"
                          className="focus-ring rounded-sm font-mono tabular-nums"
                          onClick={(e) => {
                            e.stopPropagation();
                            open(item.id);
                          }}
                          aria-label={t('responses.open', { n: item.number })}
                        >
                          #{item.number}
                        </button>
                        <span title={fullDate(item.createdAt, t.locale)}>
                          {timeAgo(item.createdAt, t.locale)}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium">{lead ?? '—'}</p>
                      {rest.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {rest.join(' · ')}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            <table className="hidden w-full text-left text-[13px] sm:table">
              <thead>
                <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                  {!readOnly && (
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
                  )}
                  <th
                    scope="col"
                    className={cx('w-14 py-2.5 pr-2 font-medium', readOnly && 'pl-4')}
                  >
                    #
                  </th>
                  <th scope="col" className="py-1.5 pr-4 font-medium">
                    <ColumnMenu
                      property={submitted}
                      sort={sort}
                      onSort={setSort}
                      onFilter={addFilter}
                    />
                  </th>
                  {columns.map((c) => (
                    <th key={c.key} scope="col" className="py-1.5 pr-4 font-medium">
                      <ColumnMenu
                        property={
                          properties.find((p) => p.field === c.key) ?? {
                            field: c.key,
                            label: c.header,
                          }
                        }
                        sort={sort}
                        onSort={setSort}
                        onFilter={addFilter}
                      />
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
                      fresh.has(item.id) && 'studio-new-row',
                    )}
                    aria-selected={item.id === responseId}
                  >
                    {!readOnly && (
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
                    )}
                    <td
                      className={cx(
                        'py-2.5 pr-2 font-mono text-xs text-zinc-400 tabular-nums',
                        readOnly && 'pl-4',
                      )}
                    >
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
          {...neighbors(items, responseId, open)}
        />
      )}
      {confirmDialog}
    </div>
  );
}

/** The rows above and below the open response, for stepping through this page. */
function neighbors(
  items: SubmissionPage['items'],
  responseId: string,
  open: (id: string) => void,
): { onPrev?(): void; onNext?(): void } {
  const index = items.findIndex((item) => item.id === responseId);
  if (index === -1) return {};
  const prev = items[index - 1];
  const next = items[index + 1];
  return {
    onPrev: prev && (() => open(prev.id)),
    onNext: next && (() => open(next.id)),
  };
}

function ResponseDrawer({
  formId,
  responseId,
  onClose,
  onDeleted,
  onPrev,
  onNext,
}: {
  formId: string;
  responseId: string;
  onClose(): void;
  onDeleted(): void;
  onPrev?(): void;
  onNext?(): void;
}) {
  // Scoped: stepping to the next response keeps this one up until it loads.
  const { data, error } = useResource<SubmissionDetail>(
    `${formPath(formId)}/submissions/${encodeURIComponent(responseId)}`,
    { live: false, scope: `${formPath(formId)}/submission` },
  );
  const [deleting, setDeleting] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const closeRef = useRef<HTMLButtonElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const t = useT();
  const readOnly = useReadOnly();
  const yesNo = [t('common.yes'), t('common.no')] as const;
  // The callbacks are new on every render of the list; the drawer only focuses when it opens.
  const keys = useRef({ onClose, onPrev, onNext });
  keys.current = { onClose, onPrev, onNext };

  useEffect(() => {
    closeRef.current?.focus();
    // A layer above (the command palette) handles its own Escape first.
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"]');
      const step =
        e.key === 'ArrowUp' || e.key === 'k'
          ? keys.current.onPrev
          : e.key === 'ArrowDown' || e.key === 'j'
            ? keys.current.onNext
            : undefined;
      if (e.key === 'Escape') {
        e.preventDefault();
        keys.current.onClose();
      } else if (step && !typing) {
        e.preventDefault();
        step();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new response starts at its top
  useEffect(() => {
    body.current?.scrollTo({ top: 0 });
  }, [responseId]);

  const submission = data?.submission;
  // While the next response loads, the last one stays on screen but can't be acted on.
  const current = submission?.id === responseId ? submission : undefined;
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
    const submission = current;
    if (
      !submission ||
      !(await confirm({
        title: t('responses.confirmDelete', { n: submission.number }),
        message: t('common.cannotUndo'),
        confirmLabel: t('common.delete'),
      }))
    ) {
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
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              onClick={onPrev}
              disabled={!onPrev}
              aria-label={t('responses.prev')}
              title={`${t('responses.prev')} (↑)`}
              className="px-2"
            >
              <ChevronUp />
            </Button>
            <Button
              variant="ghost"
              onClick={onNext}
              disabled={!onNext}
              aria-label={t('responses.next')}
              title={`${t('responses.next')} (↓)`}
              className="px-2"
            >
              <ChevronDown />
            </Button>
            <Button
              ref={closeRef}
              variant="ghost"
              onClick={onClose}
              aria-label={t('common.close')}
              className="px-2"
            >
              <X />
            </Button>
          </div>
        </div>
        <div ref={body} className="flex-1 overflow-y-auto px-5 py-4">
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
          <Button onClick={() => copyAll(allText)} disabled={!current}>
            {copiedAll ? <Check /> : <Copy />}
            {copiedAll ? t('responses.copied') : t('responses.copyAll')}
          </Button>
          {!readOnly && (
            <Button variant="danger" onClick={remove} disabled={!current || deleting}>
              <Trash2 />
              {t('common.delete')}
            </Button>
          )}
        </div>
      </div>
      {confirmDialog}
    </div>
  );
}

/**
 * Every format behind one button; the toolbar keeps its room for search and filters.
 * While a search or filter narrows the table, the file holds the same responses
 * unless "All" is picked.
 */
function ExportMenu({
  formId,
  count,
  matching,
  narrow,
}: {
  formId: string;
  count: number | undefined;
  /** How many responses the search and filters match; undefined when nothing narrows them. */
  matching: number | undefined;
  narrow: { q: string; filter: string };
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  // "All" holds for the search and filters it was picked under; new ones start at Matching.
  const criteria = `${narrow.q}\n${narrow.filter}`;
  const [allFor, setAllFor] = useState<string | null>(null);
  const everything = allFor === criteria;
  const setEverything = (all: boolean) => setAllFor(all ? criteria : null);
  const narrowed = matching !== undefined && !everything;
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const headingId = useId();

  const close = useCallback(() => {
    setOpen(false);
    if (root.current?.contains(document.activeElement)) {
      root.current.querySelector<HTMLElement>('button')?.focus();
    }
  }, []);

  useEffect(() => {
    if (open) list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [open]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    const step = event.key === 'ArrowDown' ? 1 : -1;
    items[(index + step + items.length) % items.length]?.focus();
  };

  return (
    <div ref={root} className="relative">
      <Button onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <Download aria-hidden />
        {t('responses.export')}
        <ChevronDown className="-mr-1 text-zinc-400" aria-hidden />
      </Button>
      <Popover open={open} onClose={close} takeFocus={false} className="w-72 p-1">
        <div className="px-2 pt-1.5 pb-1">
          {matching !== undefined && (
            <div className="mb-2">
              <Segmented
                label={t('responses.export')}
                value={everything ? 'all' : 'matching'}
                onChange={(value) => setEverything(value === 'all')}
                options={[
                  { value: 'matching', label: t('responses.exportScope.matching') },
                  { value: 'all', label: t('responses.exportScope.all') },
                ]}
              />
            </div>
          )}
          <p id={headingId} className="text-[12px] font-medium text-zinc-500 dark:text-zinc-400">
            {narrowed
              ? t.n('responses.exportMatching', matching)
              : count === undefined
                ? t('responses.export')
                : t.n('responses.exportAll', count)}
          </p>
        </div>
        <div ref={list} role="menu" aria-labelledby={headingId} onKeyDown={onKeyDown}>
          {EXPORT_FORMATS.map(({ format, label }) => (
            <a
              key={format}
              role="menuitem"
              href={exportPath(formId, format, narrowed ? narrow : undefined)}
              download
              onClick={close}
              className="flex flex-col rounded-md px-2 py-1.5 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
            >
              <span className="text-[13px] font-medium text-zinc-800 dark:text-zinc-100">
                {label}
              </span>
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
                {t(`responses.exportHint.${format}`)}
              </span>
            </a>
          ))}
        </div>
      </Popover>
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

/** Which questions the table shows; the choice is kept per form in this browser. */
function ColumnPicker({
  columns,
  shown,
  custom,
  onChange,
}: {
  columns: SubmissionPage['columns'];
  shown: readonly string[];
  custom: boolean;
  onChange(keys: string[] | null): void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  if (columns.length === 0) return null;
  const toggle = (key: string, on: boolean) => {
    const next = new Set(shown);
    if (on) next.add(key);
    else next.delete(key);
    onChange(columns.filter((c) => next.has(c.key)).map((c) => c.key));
  };
  return (
    <div className="relative">
      <Button onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
        <Columns3 aria-hidden />
        <span className="max-sm:sr-only">{t('responses.columns')}</span>
      </Button>
      <Popover open={open} onClose={close} role="dialog" className="w-72 p-1">
        <p className="px-2 pt-1.5 pb-1 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          {t('responses.columnsHint')}
        </p>
        <div className="max-h-80 overflow-y-auto">
          {columns.map((c) => (
            <label
              key={c.key}
              className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                className={CHECKBOX}
                checked={shown.includes(c.key)}
                onChange={(e) => toggle(c.key, e.target.checked)}
              />
              <span className="truncate">{c.header}</span>
            </label>
          ))}
        </div>
        {custom && (
          <div className="mt-1 border-t border-zinc-100 px-1 pt-1 dark:border-zinc-800">
            <Button
              variant="ghost"
              className="w-full justify-start px-1"
              onClick={() => onChange(null)}
            >
              {t('responses.columnsReset')}
            </Button>
          </div>
        )}
      </Popover>
    </div>
  );
}
