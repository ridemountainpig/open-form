import { Check, ChevronDown, Globe, Search } from 'lucide-react';
import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { timeZoneOffsetLabel } from '../../schema/index.ts';
import { useT } from './i18n.tsx';
import { cx, Popover } from './ui.tsx';

export function deviceTimeZone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

let supported: string[] | undefined;
function supportedZones(): string[] {
  if (!supported) {
    try {
      supported = Intl.supportedValuesOf('timeZone');
    } catch {
      supported = [];
    }
  }
  return supported;
}

const names = new Map<string, string>();
/** `'台北標準時間'` for Asia/Taipei in zh-TW; empty when the browser only knows an offset. */
function zoneName(zone: string, locale: string): string {
  const key = `${locale}|${zone}`;
  let name = names.get(key);
  if (name === undefined) {
    try {
      name =
        new Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'longGeneric' })
          .formatToParts(0)
          .find((part) => part.type === 'timeZoneName')?.value ?? '';
    } catch {
      name = '';
    }
    if (/^(GMT|UTC)([+-−]|$)/.test(name)) name = '';
    names.set(key, name);
  }
  return name;
}

type Zone = { zone: string; name: string; offset: string; search: string };

const fold = (text: string) => text.toLowerCase().replace(/[\s_]+/g, ' ');

/** A searchable picker over every IANA zone the browser knows. */
export function TimeZonePicker({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange(zone: string): void;
}) {
  const t = useT();
  const listId = useId();
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const device = deviceTimeZone();
  const suggested = useMemo(
    () => [...new Set([device, value, 'UTC'])].filter((z): z is string => Boolean(z)),
    [device, value],
  );

  const zones = useMemo(() => {
    if (!open) return [];
    const all = [...new Set([...supportedZones(), 'UTC', value, ...(device ? [device] : [])])];
    return all.sort().map((zone): Zone => {
      const name = zoneName(zone, t.locale);
      const offset = timeZoneOffsetLabel(zone);
      return { zone, name, offset, search: fold(`${zone} ${name} ${offset}`) };
    });
  }, [open, value, device, t.locale]);

  const groups = useMemo((): Array<{ name?: string; items: Zone[] }> => {
    const q = fold(query.trim());
    if (q) return [{ items: zones.filter((z) => z.search.includes(q)) }];
    return [
      {
        name: t('schedule.zoneSuggested'),
        items: suggested.flatMap((zone) => zones.find((z) => z.zone === zone) ?? []),
      },
      { name: t('schedule.zoneAll'), items: zones },
    ];
  }, [zones, query, suggested, t]);

  const items = groups.flatMap((g) => g.items);

  useEffect(() => {
    if (open)
      list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  const choose = (zone: string) => {
    onChange(zone);
    close();
    button.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      setActive((i) => Math.min(items.length - 1, Math.max(0, i + step)));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[active];
      if (item) choose(item.zone);
    }
  };

  let index = 0;
  return (
    <div className="min-w-0">
      <button
        ref={button}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => {
          if (open) return close();
          setActive(Math.max(0, suggested.indexOf(value)));
          setOpen(true);
        }}
        className="focus-ring flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 text-left text-[13px] text-zinc-800 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800/70"
      >
        <Globe className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
        <span className="min-w-0 truncate font-medium">{value}</span>
        <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums">
          {timeZoneOffsetLabel(value)}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
      </button>
      <Popover open={open} onClose={close} align="start" className="w-80 overflow-hidden">
        <div className="flex items-center gap-2 border-b border-zinc-100 px-2.5 dark:border-zinc-800">
          <Search className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
          <input
            type="text"
            role="combobox"
            aria-expanded
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={items[active] ? `${listId}-${active}` : undefined}
            aria-label={t('schedule.zoneSearch')}
            placeholder={t('schedule.zoneSearch')}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
          />
        </div>
        <div
          ref={list}
          id={listId}
          role="listbox"
          aria-label={t('schedule.zone')}
          className="max-h-72 overflow-y-auto p-1"
        >
          {items.length === 0 && (
            <p className="px-2 py-6 text-center text-[12.5px] text-zinc-500 dark:text-zinc-400">
              {t('schedule.zoneNone', { q: query.trim() })}
            </p>
          )}
          {groups.map(
            (group) =>
              group.items.length > 0 && (
                // biome-ignore lint/a11y/useSemanticElements: a listbox option group, not a fieldset
                <div key={group.name ?? 'results'} role="group" aria-label={group.name}>
                  {group.name && (
                    <p className="px-2 pt-2 pb-1 text-[10.5px] font-medium tracking-wider text-zinc-400 uppercase">
                      {group.name}
                    </p>
                  )}
                  {group.items.map((z) => {
                    const i = index++;
                    return (
                      <button
                        key={`${group.name}|${z.zone}`}
                        id={`${listId}-${i}`}
                        type="button"
                        role="option"
                        tabIndex={-1}
                        data-index={i}
                        aria-selected={z.zone === value}
                        onMouseDown={(e) => e.preventDefault()}
                        onMouseMove={() => i !== active && setActive(i)}
                        onClick={() => choose(z.zone)}
                        className={cx(
                          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none',
                          i === active && 'bg-zinc-100 dark:bg-zinc-800',
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-[13px] text-zinc-800 dark:text-zinc-200">
                            <span className="truncate">{z.zone}</span>
                            {z.zone === device && (
                              <span className="shrink-0 rounded bg-zinc-100 px-1 text-[10.5px] text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                {t('schedule.zoneDevice')}
                              </span>
                            )}
                          </span>
                          {z.name && (
                            <span className="block truncate text-[11.5px] text-zinc-400">
                              {z.name}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-zinc-400 tabular-nums">
                          {z.offset}
                        </span>
                        <Check
                          className={cx(
                            'size-3.5 shrink-0 text-zinc-500',
                            z.zone !== value && 'invisible',
                          )}
                          aria-hidden
                        />
                      </button>
                    );
                  })}
                </div>
              ),
          )}
        </div>
      </Popover>
    </div>
  );
}
