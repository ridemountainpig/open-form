import {
  CornerDownLeft,
  FileText,
  Inbox,
  Languages,
  LayoutGrid,
  Palette,
  Search,
} from 'lucide-react';
import { type KeyboardEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useThemeCatalog } from '../lib/themes.ts';
import { useStudioData } from './data.tsx';
import { FolderIconChip, UnfiledIcon } from './folders.tsx';
import { STUDIO_LANGUAGES, useSetLocale, useT } from './i18n.tsx';
import { setStudioScheme, useStudioScheme } from './scheme.ts';
import { SCHEME_ICON, UNFILED } from './sidebar.tsx';
import { cx } from './ui.tsx';

type Command = {
  id: string;
  label: string;
  /** Muted text after the label, e.g. the form id. */
  detail?: string;
  icon?: ReactNode;
  /** Extra words that should match, e.g. English aliases in any UI language. */
  keywords?: string[];
  active?: boolean;
  run(): void;
};

type Group = {
  id: string;
  heading: string;
  items: Command[];
  /** Only shown once the user types — too long to list up front. */
  searchOnly?: boolean;
};

/**
 * Lower is better; null = no match. Prefix beats word start beats substring
 * beats an in-order subsequence ("cnfp" → "conference-pass").
 */
export function score(query: string, haystack: string): number | null {
  const q = query.toLowerCase();
  const h = haystack.toLowerCase();
  if (!q) return 0;
  if (h.startsWith(q)) return 0;
  const at = h.indexOf(q);
  if (at > 0) return /[\s\-_/·—]/.test(h[at - 1] ?? '') ? 1 : 2;
  let i = 0;
  let gaps = 0;
  for (const ch of h) {
    if (ch === q[i]) i += 1;
    else if (i > 0) gaps += 1;
    if (i === q.length) return 3 + gaps / 100;
  }
  return null;
}

function best(query: string, item: Command): number | null {
  let result: number | null = null;
  const consider = (s: number | null) => {
    if (s !== null && (result === null || s < result)) result = s;
  };
  for (const text of [item.label, item.detail ?? '']) consider(score(query, text));
  // Keywords (descriptions, aliases) match as substrings only: fuzzy matching
  // across a whole sentence finds something for almost any query.
  for (const text of item.keywords ?? []) {
    const s = score(query, text);
    if (s !== null && s < 3) consider(s + 0.5);
  }
  return result;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT();
  const navigate = useNavigate();
  const setLocale = useSetLocale();
  const scheme = useStudioScheme();
  const { forms, folders } = useStudioData();
  const themes = useThemeCatalog();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setCursor(0);
    requestAnimationFrame(() => input.current?.focus());
  }, [open]);

  // The palette is the top layer: its Escape mustn't also close a drawer under it.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  const groups = useMemo<Group[]>(() => {
    const go = (to: string) => () => navigate(to);
    const allForms = forms.data?.forms ?? [];
    return [
      {
        id: 'forms',
        heading: t('palette.forms'),
        items: allForms.map((f) => ({
          id: `form:${f.id}`,
          label: f.title,
          detail: f.id,
          icon: <FileText />,
          keywords: [f.description ?? ''],
          run: go(`/studio/${f.id}`),
        })),
      },
      {
        id: 'responses',
        heading: t('palette.responses'),
        searchOnly: true,
        items: allForms.map((f) => ({
          id: `responses:${f.id}`,
          label: t('palette.responsesOf', { form: f.title }),
          detail: f.id,
          icon: <Inbox />,
          keywords: ['responses', 'submissions'],
          run: go(`/studio/${f.id}/responses`),
        })),
      },
      {
        id: 'folders',
        heading: t('palette.folders'),
        items: [
          {
            id: 'folder:all',
            label: t('nav.forms'),
            icon: <LayoutGrid />,
            keywords: ['all', 'forms', 'home'],
            run: go('/studio'),
          },
          {
            id: 'folder:unfiled',
            label: t('folders.unfiled'),
            icon: <UnfiledIcon />,
            keywords: ['unfiled', 'draft'],
            run: go(`/studio?f=${UNFILED}`),
          },
          ...folders.manifest.folders.map((folder) => ({
            id: `folder:${folder.id}`,
            label: folder.name,
            icon: <FolderIconChip icon={folder.icon} />,
            keywords: ['folder'],
            run: go(`/studio?f=${folder.id}`),
          })),
        ],
      },
      {
        id: 'themes',
        heading: t('palette.themes'),
        items: [
          {
            id: 'themes',
            label: t('nav.themes'),
            icon: <Palette />,
            keywords: ['themes', 'design', 'gallery'],
            run: go('/studio/themes'),
          },
          ...themes.map((theme) => ({
            id: `theme:${theme.id}`,
            label: theme.name,
            detail: theme.id,
            icon: <Palette />,
            keywords: ['theme'],
            run: go(`/studio/themes/${theme.id}`),
          })),
        ],
        searchOnly: false,
      },
      {
        id: 'appearance',
        heading: t('appearance.label'),
        items: (['light', 'dark', 'system'] as const).map((value) => ({
          id: `scheme:${value}`,
          label: t('palette.scheme', { scheme: t(`appearance.${value}`) }),
          icon: SCHEME_ICON[value],
          keywords: ['theme', 'appearance', 'mode', value],
          active: scheme === value,
          run: () => setStudioScheme(value),
        })),
      },
      {
        id: 'language',
        heading: t('language.label'),
        items: STUDIO_LANGUAGES.map((lang) => ({
          id: `lang:${lang.value}`,
          label: lang.label,
          icon: <Languages />,
          keywords: ['language', 'locale', lang.value],
          active: t.locale === lang.value,
          run: () => setLocale(lang.value),
        })),
      },
    ];
  }, [forms.data, themes, folders.manifest, scheme, t, navigate, setLocale]);

  const visible = useMemo(() => {
    const q = query.trim();
    return groups
      .filter((g) => q || !g.searchOnly)
      .map((g) => {
        if (!q) return g;
        const ranked = g.items
          .map((item) => ({ item, s: best(q, item) }))
          .filter((x): x is { item: Command; s: number } => x.s !== null)
          .sort((a, b) => a.s - b.s);
        return { ...g, items: ranked.map((x) => x.item), top: ranked[0]?.s ?? Infinity };
      })
      .filter((g) => g.items.length > 0)
      .sort((a, b) => ('top' in a && 'top' in b ? (a.top as number) - (b.top as number) : 0));
  }, [groups, query]);

  const flat = visible.flatMap((g) => g.items);
  const current = flat[Math.min(cursor, flat.length - 1)];

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new query starts at the top
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (!current) return;
    list.current
      ?.querySelector(`[data-id="${CSS.escape(current.id)}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [current]);

  if (!open) return null;

  const run = (item: Command) => {
    onClose();
    item.run();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || (event.ctrlKey && event.key === 'n')) {
      event.preventDefault();
      setCursor((c) => (flat.length ? (c + 1) % flat.length : 0));
    } else if (event.key === 'ArrowUp' || (event.ctrlKey && event.key === 'p')) {
      event.preventDefault();
      setCursor((c) => (flat.length ? (c - 1 + flat.length) % flat.length : 0));
    } else if (event.key === 'Enter' && current) {
      event.preventDefault();
      run(current);
    }
  };

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('common.close')}
        className="studio-backdrop absolute inset-0 bg-zinc-950/25 dark:bg-black/50"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.button')}
        className="studio-palette relative mx-auto mt-[14vh] w-[calc(100%-2rem)] max-w-[560px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2.5 border-b border-zinc-200 px-3.5 dark:border-zinc-800">
          <Search className="size-4 shrink-0 text-zinc-400" aria-hidden />
          <input
            ref={input}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            role="combobox"
            aria-expanded="true"
            aria-controls="studio-palette-list"
            aria-activedescendant={current ? `cmd-${current.id}` : undefined}
            className="h-12 min-w-0 flex-1 bg-transparent text-[14.5px] outline-none placeholder:text-zinc-400"
          />
        </div>
        <div
          ref={list}
          id="studio-palette-list"
          role="listbox"
          aria-label={t('search.button')}
          className="max-h-[min(56vh,380px)] overflow-y-auto p-1.5"
        >
          {visible.length === 0 && (
            <p className="px-3 py-8 text-center text-[13px] text-zinc-500">
              {t('palette.empty', { q: query.trim() })}
            </p>
          )}
          {visible.map((group) => (
            // biome-ignore lint/a11y/useSemanticElements: an ARIA listbox group, not a form fieldset
            <div key={group.id} role="group" aria-label={group.heading} className="mb-1 last:mb-0">
              <p className="px-2 pt-2 pb-1 text-[10.5px] font-medium tracking-wider text-zinc-400 uppercase">
                {group.heading}
              </p>
              {group.items.map((item) => (
                <div
                  key={item.id}
                  id={`cmd-${item.id}`}
                  data-id={item.id}
                  role="option"
                  tabIndex={-1}
                  aria-selected={item === current}
                  onMouseMove={() => item !== current && setCursor(flat.indexOf(item))}
                  onClick={() => run(item)}
                  onKeyDown={() => {}}
                  className={cx(
                    'flex h-9 cursor-pointer items-center gap-2.5 rounded-md px-2 text-[13.5px] text-zinc-700 dark:text-zinc-300 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-zinc-400',
                    item === current &&
                      'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100',
                  )}
                >
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                  {item.detail && (
                    <span className="truncate font-mono text-[11.5px] text-zinc-400">
                      {item.detail}
                    </span>
                  )}
                  {item.active && (
                    <span
                      className="ml-auto size-1.5 rounded-full bg-zinc-900 dark:bg-zinc-100"
                      aria-hidden
                    />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-zinc-200 px-3.5 py-2 text-[11px] text-zinc-400 dark:border-zinc-800">
          <span className="flex items-center gap-1">
            <Kbd>↑↓</Kbd> {t('palette.navigate')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>
              <CornerDownLeft className="size-3" aria-hidden />
            </Kbd>{' '}
            {t('palette.select')}
          </span>
          <span className="flex items-center gap-1">
            <Kbd>esc</Kbd> {t('common.close')}
          </span>
        </div>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-grid h-[18px] min-w-[18px] place-items-center rounded border border-zinc-200 px-1 font-mono text-[10px] dark:border-zinc-700">
      {children}
    </kbd>
  );
}

/** ⌘K / Ctrl+K anywhere in Studio. */
export function usePaletteShortcut(toggle: () => void): void {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.repeat) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle]);
}
