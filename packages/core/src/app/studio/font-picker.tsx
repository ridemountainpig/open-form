import { Check, LoaderCircle, Plus, Search, X } from 'lucide-react';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  addThemeFont,
  type DesignTarget,
  type FontFilter,
  type GoogleFont,
  searchFonts,
  type ThemeFont,
} from './api.ts';
import { formatBytes } from './format.ts';
import { useT } from './i18n.tsx';
import { Button, cx, Kbd } from './ui.tsx';

const CATEGORIES = [
  { key: 'all', filter: {} },
  { key: 'sans', filter: { category: 'Sans Serif' } },
  { key: 'serif', filter: { category: 'Serif' } },
  { key: 'display', filter: { category: 'Display' } },
  { key: 'handwriting', filter: { category: 'Handwriting' } },
  { key: 'mono', filter: { category: 'Monospace' } },
  { key: 'cjk', filter: { cjk: true } },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]['key'];

const CATEGORY_KEYS: Record<string, CategoryKey> = {
  'Sans Serif': 'sans',
  Serif: 'serif',
  Display: 'display',
  Handwriting: 'handwriting',
  Monospace: 'mono',
};

const message = (err: unknown) =>
  err instanceof ApiError || err instanceof Error ? err.message : String(err);

// Studio is the author's own tool, so its previews may come from Google; the
// form itself only ever gets the copy written into the theme.
function previewHref(fonts: GoogleFont[], text: string): string {
  const families = fonts.map((f) => {
    const name = encodeURIComponent(f.family).replace(/%20/g, '+');
    return `family=${name}${f.italicOnly ? ':ital@1' : ''}`;
  });
  return `https://fonts.googleapis.com/css2?${families.join('&')}&text=${encodeURIComponent(text)}&display=swap`;
}

/** Load each result's preview glyphs once; keep them until the picker closes. */
function usePreviewFonts(fonts: GoogleFont[] | null, text: string) {
  const [settled, setSettled] = useState(text);
  const links = useRef(new Map<string, HTMLLinkElement>());

  useEffect(() => {
    const timer = setTimeout(() => setSettled(text), 300);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (!fonts?.length) return;
    const href = previewHref(fonts, settled);
    if (links.current.has(href)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
    links.current.set(href, link);
  }, [fonts, settled]);

  useEffect(() => {
    const current = links.current;
    return () => {
      for (const link of current.values()) link.remove();
      current.clear();
    };
  }, []);
}

/** Search Google Fonts and download one into the theme's `fonts/` folder. */
export function FontPicker({
  target,
  folder,
  installed,
  onPicked,
  onClose,
}: {
  target: DesignTarget;
  /** Where the files go, e.g. `themes/brand/fonts/`. */
  folder: string;
  installed: ThemeFont[];
  /** A font the theme now serves; `added` is false when it was already there. */
  onPicked(font: ThemeFont, added: boolean): void;
  onClose(): void;
}) {
  const t = useT();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryKey>('all');
  const [sample, setSample] = useState('');
  const [fonts, setFonts] = useState<GoogleFont[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const text = sample.trim() || t('fonts.sample');
  usePreviewFonts(fonts, text);

  useEffect(() => {
    input.current?.focus();
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `retry` forces a refetch
  useEffect(() => {
    const ctrl = new AbortController();
    const filter: FontFilter = {
      q: query,
      ...CATEGORIES.find((c) => c.key === category)?.filter,
    };
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError(null);
        searchFonts(filter, ctrl.signal).then(
          (res) => {
            setFonts(res.fonts);
            setLoading(false);
          },
          (err: unknown) => {
            if (ctrl.signal.aborted) return;
            setError(message(err));
            setLoading(false);
          },
        );
      },
      query ? 200 : 0,
    );
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query, category, retry]);

  const pick = async (font: GoogleFont) => {
    const existing = installed.find((f) => f.family === font.family);
    if (existing) return onPicked(existing, false);
    setBusy(font.family);
    setFailure(null);
    try {
      const res = await addThemeFont(target, font.family);
      onPicked(res.font, true);
    } catch (err) {
      setFailure(t('fonts.failed', { family: font.family, error: message(err) }));
      setBusy(null);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      onClose();
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape anywhere in the dialog closes it
    <div className="fixed inset-0 z-50" onKeyDown={onKeyDown}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('common.close')}
        className="studio-backdrop absolute inset-0 bg-zinc-950/25 dark:bg-black/50"
        onClick={() => !busy && onClose()}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="font-picker-title"
        className="studio-palette relative mx-auto mt-[8vh] flex h-[min(84dvh,640px)] w-[calc(100%-2rem)] max-w-[600px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="border-b border-zinc-200 px-4 pt-3.5 pb-3 dark:border-zinc-800">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h2 id="font-picker-title" className="text-[14px] font-semibold">
                {t('fonts.title')}
              </h2>
              <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                {t('fonts.subtitleBefore')}
                <Kbd>{folder}</Kbd>
                {t('fonts.subtitleAfter')}
              </p>
            </div>
            <button
              type="button"
              aria-label={t('common.close')}
              disabled={Boolean(busy)}
              onClick={onClose}
              className="focus-ring -mr-1 grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-2.5 focus-within:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-600">
            <Search className="size-3.5 shrink-0 text-zinc-400" aria-hidden />
            <input
              ref={input}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('fonts.search')}
              aria-label={t('fonts.search')}
              spellCheck={false}
              className="h-8 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400"
            />
          </div>
          <fieldset className="mt-2.5 flex flex-wrap gap-1">
            <legend className="sr-only">{t('fonts.category')}</legend>
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                aria-pressed={category === c.key}
                onClick={() => setCategory(c.key)}
                className={cx(
                  'focus-ring h-6 rounded-full px-2.5 text-[11.5px] font-medium transition-colors',
                  category === c.key
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'bg-zinc-100 text-zinc-600 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100',
                )}
              >
                {t(`fonts.cat.${c.key}`)}
              </button>
            ))}
          </fieldset>
        </div>

        <div
          className={cx(
            'min-h-0 flex-1 overflow-y-auto p-1.5 transition-opacity',
            loading && fonts && 'opacity-60',
          )}
          aria-busy={loading}
        >
          {error ? (
            <div className="px-4 py-10 text-center">
              <p className="text-[13px] font-medium">{t('fonts.error')}</p>
              <p className="mt-1 text-[12px] break-words text-zinc-500">{error}</p>
              <Button className="mt-3" onClick={() => setRetry((r) => r + 1)}>
                {t('fonts.retry')}
              </Button>
            </div>
          ) : !fonts ? (
            <ul className="space-y-1 p-1">
              {[0, 1, 2, 3, 4, 5].map((n) => (
                <li
                  key={n}
                  className="h-[68px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800/60"
                />
              ))}
            </ul>
          ) : fonts.length === 0 ? (
            <p className="px-4 py-10 text-center text-[13px] text-zinc-500">
              {t('fonts.empty', { q: query.trim() })}
            </p>
          ) : (
            <ul>
              {fonts.map((font) => (
                <li key={font.family}>
                  <FontRow
                    font={font}
                    text={text}
                    installed={installed.find((f) => f.family === font.family)}
                    busy={busy === font.family}
                    disabled={Boolean(busy)}
                    onPick={() => void pick(font)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="border-t border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
          {failure && (
            <p role="alert" className="mb-2 text-[12px] break-words text-red-600 dark:text-red-400">
              {failure}
            </p>
          )}
          <div className="flex items-center gap-3">
            <input
              value={sample}
              onChange={(e) => setSample(e.target.value)}
              placeholder={t('fonts.previewText')}
              aria-label={t('fonts.previewText')}
              className="focus-ring h-7 min-w-0 flex-1 rounded-md border border-zinc-200 bg-white px-2 text-[12px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
            />
            <a
              href="https://fonts.google.com"
              target="_blank"
              rel="noreferrer"
              className="focus-ring shrink-0 rounded-sm text-[11.5px] text-zinc-500 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-800 dark:decoration-zinc-600 dark:hover:text-zinc-200"
            >
              {t('fonts.poweredBy')}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function FontRow({
  font,
  text,
  installed,
  busy,
  disabled,
  onPick,
}: {
  font: GoogleFont;
  text: string;
  installed: ThemeFont | undefined;
  busy: boolean;
  disabled: boolean;
  onPick(): void;
}) {
  const t = useT();
  const kind = CATEGORY_KEYS[font.category];
  const meta = [
    kind ? t(`fonts.cat.${kind}`) : font.category,
    font.axis ? t('fonts.variable') : t.n('fonts.weights', font.weights.length || 1),
  ];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onPick}
      aria-label={
        installed
          ? t('fonts.useLabel', { family: font.family })
          : t('fonts.addLabel', { family: font.family })
      }
      className="group focus-ring flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-zinc-50 disabled:cursor-default disabled:hover:bg-transparent dark:hover:bg-zinc-800/60"
    >
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="truncate text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
            {font.family}
          </span>
          <span className="shrink-0 text-[11px] text-zinc-400">{meta.join(' · ')}</span>
          {font.cjk && (
            <span
              title={t('fonts.cjkHint')}
              className="shrink-0 rounded bg-zinc-100 px-1 py-px text-[10.5px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {t('fonts.cjkSize')}
            </span>
          )}
        </span>
        <span
          className="mt-0.5 block truncate text-[22px] leading-tight text-zinc-900 dark:text-zinc-100"
          style={{
            fontFamily: `"${font.family}", var(--font-sans)`,
            fontStyle: font.italicOnly ? 'italic' : undefined,
          }}
        >
          {text}
        </span>
      </span>
      <span
        className={cx(
          'flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium [&_svg]:size-3.5',
          busy || installed
            ? 'text-zinc-600 dark:text-zinc-300'
            : 'text-zinc-400 group-hover:bg-zinc-900 group-hover:text-white group-focus-visible:bg-zinc-900 group-focus-visible:text-white dark:group-hover:bg-white dark:group-hover:text-zinc-900 dark:group-focus-visible:bg-white dark:group-focus-visible:text-zinc-900',
        )}
      >
        {busy ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            {t('fonts.adding')}
          </>
        ) : installed ? (
          <>
            <Check aria-hidden />
            {t('fonts.inTheme', { size: formatBytes(installed.bytes, t.locale) })}
          </>
        ) : (
          <>
            <Plus aria-hidden />
            {t('fonts.add')}
          </>
        )}
      </span>
    </button>
  );
}
