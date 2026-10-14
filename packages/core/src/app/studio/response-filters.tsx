import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  AtSign,
  Calendar,
  Check,
  CircleDot,
  Clock,
  Hash,
  Link,
  ListChecks,
  ListFilter,
  Phone,
  Plus,
  Search,
  Shapes,
  SquareCheck,
  TextAlignStart,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import {
  type FieldOption,
  type FieldType,
  type ResponseFilterOp,
  type ResponseFilterRule,
  responseFilterRuleProblem,
  responseFilterValueKind,
} from '../../schema/index.ts';
import { type Translate, useT } from './i18n.tsx';
import type { MessageKey } from './messages.ts';
import { Button, cx, Dropdown, Popover } from './ui.tsx';

/** Something the table can be filtered on: a question, or (no `field`) the submission time. */
export type FilterProperty = {
  field?: string;
  label: string;
  type?: FieldType;
  options?: FieldOption[];
};

export type FilterRule = ResponseFilterRule & { id: string };

export type FilterDraft = { match: 'all' | 'any'; rules: FilterRule[] };

export const EMPTY_FILTER: FilterDraft = { match: 'all', rules: [] };

/** The table's sort; no `field` sorts by submission time. */
export type ColumnSort = { field?: string; direction: 'asc' | 'desc' };

type Kind = 'text' | 'number' | 'select' | 'multi' | 'checkbox' | 'date' | 'submitted';

function kindOf(property: FilterProperty): Kind {
  if (property.field === undefined) return 'submitted';
  const choices = Boolean(property.options?.length);
  switch (property.type) {
    case 'number':
      return 'number';
    case 'select':
    case 'radio':
      return choices ? 'select' : 'text';
    case 'checkbox-group':
      return choices ? 'multi' : 'text';
    case 'checkbox':
      return 'checkbox';
    case 'date':
      return 'date';
    default:
      return 'text';
  }
}

const OPS: Record<Kind, ResponseFilterOp[]> = {
  text: ['contains', 'notContains', 'is', 'isNot', 'startsWith', 'endsWith', 'empty', 'notEmpty'],
  number: ['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'empty', 'notEmpty'],
  select: ['anyOf', 'noneOf', 'empty', 'notEmpty'],
  multi: ['anyOf', 'allOf', 'noneOf', 'empty', 'notEmpty'],
  checkbox: ['checked', 'unchecked'],
  date: ['on', 'before', 'after', 'onOrBefore', 'onOrAfter', 'between', 'empty', 'notEmpty'],
  submitted: ['pastDays', 'on', 'before', 'after', 'onOrBefore', 'onOrAfter', 'between'],
};

const SYMBOLS: Partial<Record<ResponseFilterOp, string>> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  lt: '<',
  gte: '≥',
  lte: '≤',
};

const MULTI_OPS: Partial<Record<ResponseFilterOp, MessageKey>> = {
  anyOf: 'filters.op.hasAnyOf',
  allOf: 'filters.op.hasAllOf',
  noneOf: 'filters.op.hasNoneOf',
};

const DAY_PRESETS = [1, 7, 30, 90];

const ICONS: Partial<Record<FieldType, ReactNode>> = {
  text: <Type />,
  email: <AtSign />,
  url: <Link />,
  tel: <Phone />,
  number: <Hash />,
  textarea: <TextAlignStart />,
  select: <CircleDot />,
  radio: <CircleDot />,
  checkbox: <SquareCheck />,
  'checkbox-group': <ListChecks />,
  date: <Calendar />,
  custom: <Shapes />,
};

function iconOf(property: FilterProperty): ReactNode {
  if (property.field === undefined) return <Clock />;
  return (property.type && ICONS[property.type]) ?? <Type />;
}

function opLabel(t: Translate, op: ResponseFilterOp, kind: Kind): string {
  const symbol = SYMBOLS[op];
  if (symbol) return symbol;
  const multi = kind === 'multi' ? MULTI_OPS[op] : undefined;
  return t(multi ?? (`filters.op.${op}` as MessageKey));
}

const sameProperty = (rule: { field?: string }, property: FilterProperty) =>
  rule.field === property.field;

export function propertyFor(
  rule: { field?: string },
  properties: FilterProperty[],
  t: Translate,
): FilterProperty {
  return (
    properties.find((p) => sameProperty(rule, p)) ?? {
      field: rule.field,
      label: rule.field ?? t('responses.submitted'),
    }
  );
}

let lastId = 0;

/** A new rule on `property`; ones that need no value (a checkbox, the past 7 days) apply at once. */
export function newRule(property: FilterProperty): FilterRule {
  const op = OPS[kindOf(property)][0] as ResponseFilterOp;
  const rule: FilterRule = { id: `rule-${++lastId}`, op };
  if (property.field !== undefined) rule.field = property.field;
  if (op === 'pastDays') rule.value = 7;
  return rule;
}

function withOp(rule: FilterRule, op: ResponseFilterOp): FilterRule {
  const before = responseFilterValueKind(rule.op);
  const after = responseFilterValueKind(op);
  const { id, field } = rule;
  const next: FilterRule = { id, op, ...(field !== undefined ? { field } : {}) };
  if (before === after) return { ...rule, op };
  // A single day carries over into a range as its start, and back.
  if ((before === 'date' || before === 'range') && (after === 'date' || after === 'range')) {
    next.value = rule.value;
  }
  if (after === 'days') next.value = 7;
  return next;
}

const readyRules = (draft: FilterDraft) =>
  draft.rules.filter((rule) => !responseFilterRuleProblem(rule));

/** Rules that are filled in; unfinished ones don't filter yet. */
export function readyCount(draft: FilterDraft): number {
  return readyRules(draft).length;
}

/** The `?sort=` value: choice questions sort in their options' order, like Notion's selects. */
export function sortQuery(
  sort: ColumnSort | null,
  field?: Pick<FilterProperty, 'type' | 'options'>,
): string {
  if (!sort) return '';
  const kind =
    sort.field !== undefined && field ? kindOf({ ...field, field: sort.field, label: '' }) : 'text';
  const values =
    kind === 'select' || kind === 'multi' ? field?.options?.map((o) => o.value) : undefined;
  return JSON.stringify({ ...sort, ...(values ? { values } : {}) });
}

/** The `?filter=` value for the rules that are ready to run, or '' when there are none. */
export function filterQuery(draft: FilterDraft, timeZone: string): string {
  const rules = readyRules(draft).map(({ id: _id, ...rule }) => rule);
  if (rules.length === 0) return '';
  return JSON.stringify({
    ...(draft.match === 'any' && rules.length > 1 ? { match: 'any' } : {}),
    rules,
    ...(rules.some((rule) => rule.field === undefined) ? { timeZone } : {}),
  });
}

function formatDay(day: unknown, locale: string): string {
  if (typeof day !== 'string' || !day) return '';
  const date = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return day;
  return date.toLocaleDateString(locale, { dateStyle: 'medium', timeZone: 'UTC' });
}

function summary(rule: FilterRule, property: FilterProperty, t: Translate): string {
  const kind = kindOf(property);
  const op = opLabel(t, rule.op, kind);
  if (responseFilterRuleProblem(rule)) return op;
  switch (responseFilterValueKind(rule.op)) {
    case 'text':
    case 'number':
      return `${op} ${rule.value}`;
    case 'options': {
      const label = (value: string) =>
        property.options?.find((o) => o.value === value)?.label ?? value;
      return `${op} ${(rule.values ?? []).map(label).join(', ')}`;
    }
    case 'date':
      return `${op} ${formatDay(rule.value, t.locale)}`;
    case 'range':
      return `${op} ${formatDay(rule.value, t.locale)} → ${formatDay(rule.to, t.locale)}`;
    case 'days':
      return t.n('filters.pastDays', rule.value as number);
    case 'none':
      return op;
  }
}

const INPUT =
  'focus-ring h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:[color-scheme:dark]';

const MENU_ITEM =
  'flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 [&_svg]:size-3.5 [&_svg]:shrink-0';

/** Arrow keys walk the `[data-item]` buttons in `list`; above the first one is the search box. */
function onListKey(event: KeyboardEvent, list: HTMLElement | null, input: HTMLElement | null) {
  if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
  event.preventDefault();
  const items = [...(list?.querySelectorAll<HTMLElement>('[data-item]') ?? [])];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = index + (event.key === 'ArrowDown' ? 1 : -1);
  if (next < 0) input?.focus();
  else items[Math.min(next, items.length - 1)]?.focus();
}

/** The "Filter" button: picks the question to add a rule on. */
export function AddFilter({
  properties,
  onPick,
  count = 0,
  compact = false,
}: {
  properties: FilterProperty[];
  onPick(property: FilterProperty): void;
  /** Rules in use, shown on the toolbar button. */
  count?: number;
  /** The quiet "+ Add filter" at the end of the filter bar. */
  compact?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const needle = query.trim().toLowerCase();
  const shown = needle
    ? properties.filter((p) => p.label.toLowerCase().includes(needle))
    : properties;

  useEffect(() => {
    if (!open) return;
    setQuery('');
    input.current?.focus({ preventScroll: true });
  }, [open]);

  const pick = (property: FilterProperty) => {
    setOpen(false);
    onPick(property);
  };

  return (
    <div className="relative">
      {compact ? (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="focus-ring flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-3.5"
        >
          <Plus aria-hidden />
          {t('filters.add')}
        </button>
      ) : (
        <Button onClick={() => setOpen((o) => !o)} aria-haspopup="dialog" aria-expanded={open}>
          <ListFilter aria-hidden />
          {t('filters.button')}
          {count > 0 && (
            <span className="grid min-w-4 place-items-center rounded-full bg-zinc-900 px-1 font-mono text-[10.5px] leading-4 text-white tabular-nums dark:bg-white dark:text-zinc-900">
              {count}
            </span>
          )}
        </Button>
      )}
      <Popover
        open={open}
        onClose={() => setOpen(false)}
        takeFocus={false}
        align="start"
        role="dialog"
        className="w-64 p-1"
      >
        <div className="relative mb-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <input
            ref={input}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && shown[0]) {
                e.preventDefault();
                pick(shown[0]);
              } else onListKey(e, list.current, input.current);
            }}
            placeholder={t('filters.searchProperties')}
            aria-label={t('filters.searchProperties')}
            className="h-8 w-full rounded-md bg-transparent pr-2 pl-8 text-[13px] outline-none placeholder:text-zinc-400"
          />
        </div>
        <div
          ref={list}
          className="max-h-72 overflow-y-auto overscroll-contain border-t border-zinc-100 pt-1 dark:border-zinc-800"
        >
          {shown.map((property) => (
            <button
              key={property.field ?? ''}
              type="button"
              data-item
              onClick={() => pick(property)}
              onKeyDown={(e) => onListKey(e, list.current, input.current)}
              className={MENU_ITEM}
            >
              <span className="text-zinc-400">{iconOf(property)}</span>
              <span className="min-w-0 flex-1 truncate">{property.label}</span>
            </button>
          ))}
          {shown.length === 0 && (
            <p className="px-2 py-3 text-center text-[13px] text-zinc-400">
              {t('filters.noProperties')}
            </p>
          )}
        </div>
      </Popover>
    </div>
  );
}

/** The row of rules under the toolbar, Notion style: one chip per rule. */
export function FilterBar({
  draft,
  properties,
  editing,
  onEdit,
  onChange,
  onAdd,
  leading,
}: {
  draft: FilterDraft;
  properties: FilterProperty[];
  /** The rule whose editor is open. */
  editing: string | null;
  onEdit(id: string | null): void;
  onChange(next: FilterDraft): void;
  onAdd(property: FilterProperty): void;
  /** Before the rules: the sort chip. */
  leading?: ReactNode;
}) {
  const t = useT();
  const update = (next: FilterRule) =>
    onChange({ ...draft, rules: draft.rules.map((r) => (r.id === next.id ? next : r)) });
  const remove = (id: string) => {
    onEdit(null);
    onChange({ ...draft, rules: draft.rules.filter((r) => r.id !== id) });
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {leading}
      {draft.rules.length > 1 && (
        <Dropdown
          label={t('filters.match')}
          showLabel
          value={draft.match}
          options={[
            { value: 'all', label: t('filters.matchAll') },
            { value: 'any', label: t('filters.matchAny') },
          ]}
          onChange={(match) => onChange({ ...draft, match })}
          className="shrink-0"
        />
      )}
      {draft.rules.map((rule) => (
        <FilterChip
          key={rule.id}
          rule={rule}
          property={propertyFor(rule, properties, t)}
          open={editing === rule.id}
          onToggle={() => onEdit(editing === rule.id ? null : rule.id)}
          onClose={() => onEdit(null)}
          onChange={update}
          onRemove={() => remove(rule.id)}
        />
      ))}
      <AddFilter properties={properties} onPick={onAdd} compact />
      {draft.rules.length > 0 && (
        <button
          type="button"
          onClick={() => {
            onEdit(null);
            onChange(EMPTY_FILTER);
          }}
          className="focus-ring ml-auto h-7 rounded-md px-2 text-[12.5px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          {t('filters.clear')}
        </button>
      )}
    </div>
  );
}

function FilterChip({
  rule,
  property,
  open,
  onToggle,
  onClose,
  onChange,
  onRemove,
}: {
  rule: FilterRule;
  property: FilterProperty;
  open: boolean;
  onToggle(): void;
  onClose(): void;
  onChange(rule: FilterRule): void;
  onRemove(): void;
}) {
  const t = useT();
  const kind = kindOf(property);
  const ready = !responseFilterRuleProblem(rule);
  return (
    <div className="relative min-w-0">
      <Pill dashed={!ready} onRemove={onRemove} removeLabel={t('filters.remove')}>
        <button
          type="button"
          onClick={onToggle}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={t('filters.edit', { label: property.label })}
          className={PILL_BUTTON}
        >
          <span className="text-zinc-400" aria-hidden>
            {iconOf(property)}
          </span>
          <span className="max-w-40 shrink-0 truncate text-zinc-500 dark:text-zinc-400">
            {property.label}:
          </span>
          <span className="max-w-64 min-w-0 truncate font-medium">
            {summary(rule, property, t)}
          </span>
        </button>
      </Pill>
      <Popover
        open={open}
        onClose={onClose}
        takeFocus={false}
        align="start"
        role="dialog"
        className="w-72 p-2"
      >
        <RuleEditor
          rule={rule}
          property={property}
          kind={kind}
          onChange={onChange}
          onRemove={onRemove}
          onDone={onClose}
        />
      </Popover>
    </div>
  );
}

const PILL_BUTTON =
  'focus-ring flex h-full min-w-0 items-center gap-1.5 rounded-full pr-1 pl-2.5 [&_svg]:size-3.5 [&_svg]:shrink-0';

/** A rounded chip: its own button, then an × that removes it. */
function Pill({
  dashed = false,
  onRemove,
  removeLabel,
  children,
}: {
  dashed?: boolean;
  onRemove(): void;
  removeLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        'flex h-7 max-w-full min-w-0 items-center rounded-full border pr-1 text-[12.5px] transition-colors',
        dashed
          ? 'border-dashed border-zinc-300 text-zinc-500 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
          : 'border-zinc-300 bg-zinc-100/70 text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800/70 dark:text-zinc-100 dark:hover:bg-zinc-800',
      )}
    >
      {children}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={removeLabel}
        className="focus-ring grid size-5 shrink-0 place-items-center rounded-full text-zinc-400 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-zinc-100 [&_svg]:size-3"
      >
        <X aria-hidden />
      </button>
    </div>
  );
}

/** The current sort, at the start of the bar: click to reverse it, × to go back to newest first. */
export function SortChip({
  sort,
  properties,
  onChange,
}: {
  sort: ColumnSort;
  properties: FilterProperty[];
  onChange(sort: ColumnSort | null): void;
}) {
  const t = useT();
  const property = propertyFor(sort, properties, t);
  const Arrow = sort.direction === 'asc' ? ArrowUp : ArrowDown;
  return (
    <Pill onRemove={() => onChange(null)} removeLabel={t('sort.remove')}>
      <button
        type="button"
        onClick={() => onChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })}
        title={t('sort.reverse')}
        className={PILL_BUTTON}
      >
        <Arrow className="text-zinc-400" aria-hidden />
        <span className="max-w-40 truncate text-zinc-500 dark:text-zinc-400">
          {property.label}:
        </span>
        <span className="font-medium">
          {t(sort.direction === 'asc' ? 'sort.asc' : 'sort.desc')}
        </span>
      </button>
    </Pill>
  );
}

/** A column heading that opens Notion's column menu: sort either way, or filter on it. */
export function ColumnMenu({
  property,
  sort,
  onSort,
  onFilter,
}: {
  property: FilterProperty;
  sort: ColumnSort | null;
  onSort(sort: ColumnSort | null): void;
  onFilter(property: FilterProperty): void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const active = sort && sameProperty(sort, property) ? sort.direction : null;
  const close = () => {
    setOpen(false);
    if (list.current?.contains(document.activeElement)) button.current?.focus();
  };
  const choose = (action: () => void) => {
    close();
    action();
  };
  const field = property.field !== undefined ? { field: property.field } : {};
  const item = (key: string, icon: ReactNode, label: string, action: () => void, on = false) => (
    <button
      key={key}
      type="button"
      role="menuitem"
      data-item
      onClick={() => choose(action)}
      onKeyDown={(e) => onListKey(e, list.current, null)}
      className={MENU_ITEM}
    >
      <span className="text-zinc-400">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {on && <Check className="text-zinc-500" aria-hidden />}
    </button>
  );
  return (
    <div className="relative -ml-1.5 inline-flex">
      <button
        ref={button}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t('sort.column', { label: property.label })}
        className={cx(
          'group focus-ring flex h-7 items-center gap-1 rounded-md px-1.5 font-medium whitespace-nowrap transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-3.5 [&_svg]:shrink-0',
          (open || active) && 'text-zinc-900 dark:text-zinc-100',
        )}
      >
        {property.label}
        {/* Faint until hovered, so every heading reads as sortable without shouting. */}
        {active === 'asc' ? (
          <ArrowUp aria-hidden />
        ) : active === 'desc' ? (
          <ArrowDown aria-hidden />
        ) : (
          <ArrowUpDown
            aria-hidden
            className={cx(
              'transition-colors',
              open
                ? 'text-zinc-500 dark:text-zinc-400'
                : 'text-zinc-300 group-hover:text-zinc-500 dark:text-zinc-600 dark:group-hover:text-zinc-400',
            )}
          />
        )}
      </button>
      <Popover open={open} onClose={close} align="start" className="w-48 p-1">
        <div ref={list} role="menu" aria-label={property.label}>
          {item(
            'asc',
            <ArrowUp />,
            t('sort.ascending'),
            () => onSort({ ...field, direction: 'asc' }),
            active === 'asc',
          )}
          {item(
            'desc',
            <ArrowDown />,
            t('sort.descending'),
            () => onSort({ ...field, direction: 'desc' }),
            active === 'desc',
          )}
          {active && item('remove', <X />, t('sort.remove'), () => onSort(null))}
          <div aria-hidden className="mx-1 my-1 border-t border-zinc-100 dark:border-zinc-800" />
          {item('filter', <ListFilter />, t('filters.button'), () => onFilter(property))}
        </div>
      </Popover>
    </div>
  );
}

function RuleEditor({
  rule,
  property,
  kind,
  onChange,
  onRemove,
  onDone,
}: {
  rule: FilterRule;
  property: FilterProperty;
  kind: Kind;
  onChange(rule: FilterRule): void;
  onRemove(): void;
  onDone(): void;
}) {
  const t = useT();
  const root = useRef<HTMLDivElement>(null);
  const valueKind = responseFilterValueKind(rule.op);

  // biome-ignore lint/correctness/useExhaustiveDependencies: focus follows the kind of value asked for
  useEffect(() => {
    const target =
      root.current?.querySelector<HTMLElement>('[data-value] input:not([type="checkbox"])') ??
      root.current?.querySelector<HTMLElement>('button');
    target?.focus({ preventScroll: true });
  }, [valueKind]);

  const onEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onDone();
    }
  };

  return (
    <div ref={root}>
      <div className="flex items-center gap-1.5">
        <span className="flex min-w-0 shrink items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 [&_svg]:size-3.5 [&_svg]:shrink-0">
          <span className="text-zinc-400" aria-hidden>
            {iconOf(property)}
          </span>
          <span className="truncate">{property.label}</span>
        </span>
        <Dropdown
          label={t('filters.operator')}
          value={rule.op}
          options={OPS[kind].map((op) => ({ value: op, label: opLabel(t, op, kind) }))}
          onChange={(op) => onChange(withOp(rule, op))}
          className="shrink-0"
        />
        <button
          type="button"
          onClick={onRemove}
          aria-label={t('filters.remove')}
          title={t('filters.remove')}
          className="focus-ring ml-auto grid size-7 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-red-600 dark:hover:bg-zinc-800 dark:hover:text-red-400 [&_svg]:size-3.5"
        >
          <Trash2 aria-hidden />
        </button>
      </div>
      {valueKind !== 'none' && (
        <div data-value className="mt-2">
          {valueKind === 'text' && (
            <input
              type="text"
              value={typeof rule.value === 'string' ? rule.value : ''}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              onKeyDown={onEnter}
              placeholder={t('filters.typeValue')}
              aria-label={property.label}
              className={INPUT}
            />
          )}
          {valueKind === 'number' && (
            <NumberInput
              value={typeof rule.value === 'number' ? rule.value : undefined}
              onChange={(value) => onChange({ ...rule, value })}
              onKeyDown={onEnter}
              label={property.label}
            />
          )}
          {valueKind === 'options' && (
            <OptionList
              options={property.options ?? []}
              values={rule.values ?? []}
              onChange={(values) => onChange({ ...rule, values })}
            />
          )}
          {valueKind === 'date' && (
            <input
              type="date"
              value={typeof rule.value === 'string' ? rule.value : ''}
              onChange={(e) => onChange({ ...rule, value: e.target.value || undefined })}
              onKeyDown={onEnter}
              aria-label={property.label}
              className={INPUT}
            />
          )}
          {valueKind === 'range' && (
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={typeof rule.value === 'string' ? rule.value : ''}
                max={rule.to}
                onChange={(e) => onChange({ ...rule, value: e.target.value || undefined })}
                onKeyDown={onEnter}
                aria-label={t('filters.from')}
                className={INPUT}
              />
              <span className="text-zinc-400" aria-hidden>
                →
              </span>
              <input
                type="date"
                value={rule.to ?? ''}
                min={typeof rule.value === 'string' ? rule.value : undefined}
                onChange={(e) => onChange({ ...rule, to: e.target.value || undefined })}
                onKeyDown={onEnter}
                aria-label={t('filters.to')}
                className={INPUT}
              />
            </div>
          )}
          {valueKind === 'days' && (
            <div className="flex items-center gap-1.5">
              {DAY_PRESETS.map((days) => (
                <button
                  key={days}
                  type="button"
                  aria-pressed={rule.value === days}
                  onClick={() => onChange({ ...rule, value: days })}
                  className={cx(
                    'focus-ring h-8 min-w-9 shrink-0 rounded-md border px-2 font-mono text-[12px] tabular-nums transition-colors',
                    rule.value === days
                      ? 'border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800',
                  )}
                >
                  {days}
                </button>
              ))}
              <NumberInput
                value={typeof rule.value === 'number' ? rule.value : undefined}
                onChange={(value) =>
                  onChange({
                    ...rule,
                    value: value === undefined ? undefined : Math.max(1, Math.round(value)),
                  })
                }
                onKeyDown={onEnter}
                label={t('filters.days')}
                min={1}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Keeps what's typed ("-", "1.") while the rule only gets finished numbers. */
function NumberInput({
  value,
  onChange,
  onKeyDown,
  label,
  min,
}: {
  value: number | undefined;
  onChange(value: number | undefined): void;
  onKeyDown(event: KeyboardEvent): void;
  label: string;
  min?: number;
}) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    setText((current) => {
      const typed = current.trim() === '' ? Number.NaN : Number(current);
      const same = Number.isFinite(typed) ? typed === value : value === undefined;
      return same ? current : String(value ?? '');
    });
  }, [value]);
  return (
    <input
      type="number"
      inputMode="decimal"
      min={min}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        const n = e.target.value.trim() === '' ? Number.NaN : Number(e.target.value);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
      onKeyDown={onKeyDown}
      aria-label={label}
      className={cx(INPUT, 'tabular-nums')}
    />
  );
}

function OptionList({
  options,
  values,
  onChange,
}: {
  options: FieldOption[];
  values: string[];
  onChange(values: string[]): void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const shown = needle ? options.filter((o) => o.label.toLowerCase().includes(needle)) : options;
  const chosen = new Set(values);
  const toggle = (value: string) =>
    onChange(chosen.has(value) ? values.filter((v) => v !== value) : [...values, value]);
  return (
    <div>
      {options.length > 7 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('filters.searchOptions')}
          aria-label={t('filters.searchOptions')}
          className={cx(INPUT, 'mb-1')}
        />
      )}
      <div className="max-h-60 overflow-y-auto overscroll-contain">
        {shown.map((option) => (
          <label key={option.value} className={cx(MENU_ITEM, 'cursor-pointer')}>
            <input
              type="checkbox"
              checked={chosen.has(option.value)}
              onChange={() => toggle(option.value)}
              className="focus-ring size-3.5 cursor-pointer rounded-sm accent-zinc-900 dark:accent-zinc-100"
            />
            <span className="min-w-0 flex-1 truncate">{option.label}</span>
          </label>
        ))}
        {shown.length === 0 && (
          <p className="px-2 py-3 text-center text-[13px] text-zinc-400">
            {t('filters.noOptions')}
          </p>
        )}
      </div>
    </div>
  );
}
