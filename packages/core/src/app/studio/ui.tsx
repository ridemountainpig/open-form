import { Check, ChevronDown } from 'lucide-react';
import {
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import type { FormStatus } from './api.ts';
import { useT } from './i18n.tsx';

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-zinc-900 text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-200',
  secondary:
    'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800',
  ghost:
    'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100',
  danger:
    'border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-zinc-900 dark:text-red-400 dark:hover:bg-red-950/40',
};

const BUTTON_BASE =
  'focus-ring inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md px-3 text-[13px] font-medium whitespace-nowrap transition-colors active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5';

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ComponentProps<'button'> & { variant?: Variant }) {
  return (
    <button type="button" className={cx(BUTTON_BASE, VARIANTS[variant], className)} {...props} />
  );
}

export function ButtonLink({
  variant = 'secondary',
  className,
  ...props
}: ComponentProps<'a'> & { variant?: Variant }) {
  return <a className={cx(BUTTON_BASE, VARIANTS[variant], className)} {...props} />;
}

export function ButtonRouterLink({
  variant = 'secondary',
  className,
  ...props
}: LinkProps & { variant?: Variant }) {
  return <Link className={cx(BUTTON_BASE, VARIANTS[variant], className)} {...props} />;
}

type Tone = 'green' | 'amber' | 'zinc' | 'ink' | 'red' | 'indigo';

const TONES: Record<Tone, string> = {
  green:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/15 dark:bg-emerald-500/10 dark:text-emerald-400 dark:ring-emerald-400/20',
  amber:
    'bg-amber-50 text-amber-700 ring-amber-600/15 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-400/20',
  zinc: 'bg-zinc-100 text-zinc-600 ring-zinc-500/15 dark:bg-zinc-800 dark:text-zinc-400 dark:ring-zinc-400/15',
  ink: 'bg-white text-zinc-800 ring-zinc-300 dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-600',
  red: 'bg-red-50 text-red-700 ring-red-600/15 dark:bg-red-500/10 dark:text-red-400 dark:ring-red-400/20',
  indigo:
    'bg-indigo-50 text-indigo-700 ring-indigo-600/15 dark:bg-indigo-500/10 dark:text-indigo-300 dark:ring-indigo-400/20',
};

export function Badge({ tone = 'zinc', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset',
        TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONE: Record<FormStatus | 'error', Tone> = {
  open: 'green',
  'not-open': 'indigo',
  closed: 'zinc',
  full: 'amber',
  unpublished: 'ink',
  error: 'red',
};

export function StatusBadge({ status }: { status: FormStatus | 'error' }) {
  const t = useT();
  const label = t(`status.${status}`);
  const tone = STATUS_TONE[status];
  return (
    <Badge tone={tone}>
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
      {label}
    </Badge>
  );
}

export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cx(
        'rounded-xl border border-zinc-200/80 bg-white shadow-[0_1px_2px_rgb(0_0_0/0.03)] dark:border-zinc-800 dark:bg-zinc-900/60',
        className,
      )}
      {...props}
    />
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  title,
}: {
  label: string;
  disabled?: boolean;
  title?: string;
  value: T | null;
  options: Array<{ value: T; label: string; icon?: ReactNode; detail?: ReactNode }>;
  onChange(value: T): void;
}) {
  return (
    <fieldset
      disabled={disabled}
      title={title}
      className="inline-flex rounded-lg border border-zinc-200 bg-white p-0.5 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <legend className="sr-only">{label}</legend>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'focus-ring flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium whitespace-nowrap transition-colors [&_svg]:size-3.5',
            value === o.value
              ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
              : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
          )}
        >
          {o.icon}
          {o.label}
          {o.detail}
        </button>
      ))}
    </fieldset>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <code className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[12px] text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
      {children}
    </code>
  );
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      {icon && (
        <div className="mb-4 grid size-11 place-items-center rounded-xl bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 [&_svg]:size-5">
          {icon}
        </div>
      )}
      <h3 className="text-[15px] font-semibold">{title}</h3>
      {children && (
        <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {children}
        </div>
      )}
    </div>
  );
}

export function ErrorNotice({ error }: { error: Error }) {
  const t = useT();
  return (
    <Card className="border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/20">
      <p className="text-sm font-medium text-red-700 dark:text-red-400">{t('common.error')}</p>
      <pre className="mt-2 font-mono text-xs leading-relaxed whitespace-pre-wrap text-red-700/90 dark:text-red-300/90">
        {error.message}
      </pre>
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('animate-pulse rounded-md bg-zinc-200/70 dark:bg-zinc-800/70', className)} />
  );
}

const DOT: Record<FormStatus | 'error', string> = {
  open: 'bg-emerald-500',
  'not-open': 'bg-indigo-500',
  closed: 'bg-zinc-400',
  full: 'bg-amber-500',
  unpublished: 'border border-zinc-400 dark:border-zinc-500',
  error: 'bg-red-500',
};

export function StatusDot({ status }: { status: FormStatus | 'error' }) {
  const t = useT();
  return (
    <span
      className={cx('size-1.5 shrink-0 rounded-full', DOT[status])}
      title={t(`status.${status}`)}
      role="img"
      aria-label={t(`status.${status}`)}
    />
  );
}

/** Icon, title and count on the left, actions on the right — the top of every Studio page. */
export function PageHeader({
  icon,
  title,
  count,
  aside,
}: {
  icon?: ReactNode;
  title: ReactNode;
  count?: number;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-6 flex min-h-8 flex-wrap items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {icon && (
          <span className="text-zinc-400 [&_svg]:size-[18px]" aria-hidden="true">
            {icon}
          </span>
        )}
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {count !== undefined && (
          <span className="font-mono text-xs text-zinc-400 tabular-nums">
            {String(count).padStart(2, '0')}
          </span>
        )}
      </div>
      {aside}
    </div>
  );
}

export type MenuOption<T extends string> = {
  value: T;
  label: string;
  icon?: ReactNode;
  /** Muted text after the label, e.g. a count. */
  detail?: string;
};

/** A small popover menu that picks one option, e.g. the theme or language switch. */
export function ChoiceMenu<T extends string>({
  label,
  trigger,
  value,
  options,
  onSelect,
  placement = 'top',
  display = 'icon',
}: {
  label: string;
  trigger: ReactNode;
  value: T;
  options: Array<MenuOption<T>>;
  onSelect(value: T): void;
  placement?: 'top' | 'bottom';
  /** `icon`: a small square icon button; `button`: a bordered button showing `trigger`. */
  display?: 'icon' | 'button';
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    list.current?.querySelector<HTMLElement>('[aria-checked="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [
      ...(list.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
    ];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      setOpen(false);
      root.current?.querySelector<HTMLElement>('button')?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[(index + step + items.length) % items.length]?.focus();
    }
  };

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={
          display === 'icon'
            ? 'focus-ring grid size-7 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-4'
            : 'focus-ring flex h-8 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-[13px] font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800 [&_svg]:size-3.5 [&_svg]:text-zinc-400'
        }
      >
        {trigger}
      </button>
      {open && (
        <div
          ref={list}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cx(
            'absolute right-0 z-50 min-w-40 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900',
            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5',
          )}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              onClick={() => {
                onSelect(option.value);
                setOpen(false);
              }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 [&_svg]:size-3.5"
            >
              {option.icon}
              <span className="flex-1">{option.label}</span>
              {option.detail && (
                <span className="font-mono text-[11px] text-zinc-400 tabular-nums">
                  {option.detail}
                </span>
              )}
              <Check
                className={cx('text-zinc-500', option.value !== value && 'invisible')}
                aria-hidden
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const POPOVER_GAP = 4;
const VIEWPORT_EDGE = 8;
const DROPDOWN_MAX_HEIGHT = 384;

/**
 * A panel anchored under its parent. It is `fixed` and placed from the parent's
 * box, so scrolling ancestors (the sidebar folder list) can't clip it; it flips
 * above when there's no room below. Closes on Escape and on clicks outside the
 * parent, so the parent's own toggle button still works.
 */
export function Popover({
  open,
  onClose,
  children,
  className,
  role,
  takeFocus = true,
  align = 'end',
}: {
  open: boolean;
  onClose(): void;
  children: ReactNode;
  className?: string;
  role?: 'menu' | 'dialog';
  /** Move focus into the panel on open. Off when an input outside must keep it. */
  takeFocus?: boolean;
  /** Which edge of the parent the panel lines up with. */
  align?: 'start' | 'end';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reposition = useRef<(() => void) | null>(null);
  // The page around the anchor can move it without a scroll or resize (a
  // toolbar that wraps), and that comes with a render, so follow it.
  useLayoutEffect(() => reposition.current?.());
  useLayoutEffect(() => {
    const panel = ref.current;
    const anchor = panel?.parentElement;
    if (!open || !panel || !anchor) return;
    const place = () => {
      const box = anchor.getBoundingClientRect();
      const { offsetWidth: width, offsetHeight: height } = panel;
      const { clientWidth, clientHeight } = document.documentElement;
      const left = align === 'end' ? box.right - width : box.left;
      const below = box.bottom + POPOVER_GAP;
      const above = box.top - POPOVER_GAP - height;
      const flip = below + height > clientHeight - VIEWPORT_EDGE && above >= VIEWPORT_EDGE;
      panel.style.left = `${Math.max(VIEWPORT_EDGE, Math.min(left, clientWidth - width - VIEWPORT_EDGE))}px`;
      panel.style.top = `${flip ? above : below}px`;
    };
    reposition.current = place;
    place();
    const resize = new ResizeObserver(place);
    resize.observe(panel);
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      reposition.current = null;
      resize.disconnect();
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align]);
  useEffect(() => {
    if (!open) return;
    const anchor = ref.current?.parentElement;
    const onDown = (event: PointerEvent) => {
      if (!anchor?.contains(event.target as Node)) onClose();
    };
    // A list open inside the panel (a Dropdown) closes first on its own Escape.
    const onKey = (event: globalThis.KeyboardEvent) =>
      event.key === 'Escape' && !event.defaultPrevented && onClose();
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    if (takeFocus) {
      ref.current?.querySelector<HTMLElement>('button, input')?.focus({ preventScroll: true });
    }
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose, takeFocus]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      role={role}
      className={cx(
        'fixed z-50 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  /** Muted text after the label. */
  detail?: string;
  icon?: ReactNode;
  /** Options with the same group are listed under that heading. */
  group?: string;
};

/**
 * Studio's select: a button showing the current choice and a listbox panel.
 * Used everywhere instead of `<select>` so every picker looks and behaves alike.
 */
export function Dropdown<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
  placement = 'bottom',
  align = 'left',
  showLabel = false,
  id,
}: {
  id?: string;
  label: string;
  value: T;
  options: Array<DropdownOption<T>>;
  onChange(value: T): void;
  className?: string;
  placement?: 'top' | 'bottom';
  align?: 'left' | 'right';
  /** Show `label` before the value inside the trigger. */
  showLabel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  // Fixed, like Popover: inside a scrolling panel an absolute list gets clipped
  // and has to be scrolled into view along with the panel.
  useLayoutEffect(() => {
    const panel = list.current;
    const anchor = button.current;
    if (!open || !panel || !anchor) return;
    const place = () => {
      const box = anchor.getBoundingClientRect();
      const { clientWidth, clientHeight } = document.documentElement;
      const below = clientHeight - box.bottom - POPOVER_GAP - VIEWPORT_EDGE;
      const above = box.top - POPOVER_GAP - VIEWPORT_EDGE;
      const wanted = Math.min(panel.scrollHeight, DROPDOWN_MAX_HEIGHT);
      const up =
        placement === 'top' ? above >= wanted || above > below : below < wanted && above > below;
      panel.style.maxHeight = `${Math.min(DROPDOWN_MAX_HEIGHT, up ? above : below)}px`;
      panel.style.minWidth = `${box.width}px`;
      const left = align === 'right' ? box.right - panel.offsetWidth : box.left;
      panel.style.left = `${Math.max(VIEWPORT_EDGE, Math.min(left, clientWidth - panel.offsetWidth - VIEWPORT_EDGE))}px`;
      panel.style.top = `${up ? box.top - POPOVER_GAP - panel.offsetHeight : box.bottom + POPOVER_GAP}px`;
    };
    place();
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, align, placement]);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    const panel = list.current;
    const selected = panel?.querySelector<HTMLElement>('[aria-selected="true"]');
    (selected ?? panel?.querySelector<HTMLElement>('[role="option"]'))?.focus({
      preventScroll: true,
    });
    if (panel && selected && selected.offsetTop + selected.offsetHeight > panel.clientHeight) {
      panel.scrollTop = selected.offsetTop - (panel.clientHeight - selected.offsetHeight) / 2;
    }
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const choose = (next: T) => {
    onChange(next);
    setOpen(false);
    button.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[Math.min(items.length - 1, Math.max(0, index + step))]?.focus();
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      (event.key === 'Home' ? items[0] : items.at(-1))?.focus();
    }
  };

  const groups: Array<{ name?: string; items: Array<DropdownOption<T>> }> = [];
  for (const option of options) {
    const last = groups.at(-1);
    if (last && last.name === option.group) last.items.push(option);
    else groups.push({ name: option.group, items: [option] });
  }

  return (
    <div ref={root} className={cx('relative min-w-0', className)}>
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={showLabel ? undefined : label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="focus-ring flex h-8 w-full min-w-0 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-left text-[12.5px] text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/70 [&_svg]:size-3.5 [&_svg]:shrink-0"
      >
        {current?.icon && <span className="text-zinc-400">{current.icon}</span>}
        {showLabel && <span className="shrink-0 text-zinc-500">{label}</span>}
        <span className="min-w-0 flex-1 truncate font-medium">{current?.label ?? '—'}</span>
        <ChevronDown className="text-zinc-400" aria-hidden />
      </button>
      {open && (
        <div
          ref={list}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          onKeyDown={onKeyDown}
          className="fixed z-50 w-max max-w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        >
          {groups.map((group, g) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: groups are positional
            // biome-ignore lint/a11y/useSemanticElements: a listbox option group, not a fieldset
            <div key={g} role="group" aria-label={group.name}>
              {g > 0 && !group.name && (
                <div
                  aria-hidden
                  className="mx-1 my-1 border-t border-zinc-100 dark:border-zinc-800"
                />
              )}
              {group.name && (
                <p className="px-2 pt-2 pb-1 text-[10.5px] font-medium tracking-wider text-zinc-400 uppercase">
                  {group.name}
                </p>
              )}
              {group.items.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="option"
                  aria-selected={option.value === value}
                  onClick={() => choose(option.value)}
                  className="flex min-h-8 w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] whitespace-nowrap text-zinc-700 outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800 [&_svg]:size-3.5 [&_svg]:shrink-0"
                >
                  {option.icon && <span className="text-zinc-400">{option.icon}</span>}
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  {option.detail && (
                    <span className="min-w-0 max-w-[50%] truncate text-[11.5px] text-zinc-400">
                      {option.detail}
                    </span>
                  )}
                  <Check
                    className={cx('text-zinc-500', option.value !== value && 'invisible')}
                    aria-hidden
                  />
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
