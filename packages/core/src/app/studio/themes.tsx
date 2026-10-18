import {
  ArrowLeft,
  Check,
  ClipboardCopy,
  Monitor,
  Palette,
  Plus,
  RotateCw,
  SlidersHorizontal,
  Smartphone,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DEFAULT_COLORS,
  effectivePalettes,
  type ThemeColorKey,
  type ThemeTokens,
} from '../../schema/index.ts';
import { sendPreviewCommand, usePreviewNav } from '../lib/preview-channel.ts';
import { DRAFT_MESSAGE, READY_MESSAGE } from '../lib/theme-preview.ts';
import {
  addStarterRequest,
  type ThemeGallery as GalleryData,
  type StarterTheme,
  type ThemeDetail,
  themeUrl,
  useResource,
} from './api.ts';
import { ContrastList, DesignPanel, fontName } from './design-panel.tsx';
import { useT } from './i18n.tsx';
import { Markdown } from './markdown.tsx';
import { Thumbnail } from './thumbnail.tsx';
import {
  Badge,
  Button,
  cx,
  ErrorNotice,
  Kbd,
  PageHeader,
  Popover,
  Segmented,
  Skeleton,
} from './ui.tsx';

function useCopy(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);
  const copy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => {},
    );
  }, []);
  return [copied, copy];
}

/** Copy a starter into themes/ and open it. */
function useAddStarter(): [string | null, (starter: string) => Promise<void>] {
  const t = useT();
  const navigate = useNavigate();
  const [busy, setBusy] = useState<string | null>(null);
  const add = useCallback(
    async (starter: string) => {
      setBusy(starter);
      try {
        const { id } = await addStarterRequest(starter);
        toast.success(t('themes.added', { id }));
        navigate(`/studio/themes/${encodeURIComponent(id)}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    },
    [navigate, t],
  );
  return [busy, add];
}

const SWATCHES: ThemeColorKey[] = ['background', 'surface', 'primary', 'foreground'];

function StarterList({ exclude }: { exclude: Set<string> }) {
  const t = useT();
  const { data } = useResource<{ starters: StarterTheme[] }>('/api/studio/themes/_starters', {
    live: false,
  });
  const [busy, add] = useAddStarter();
  if (!data) return <Skeleton className="h-40 w-full" />;
  return (
    <ul className="-mx-1 max-h-72 overflow-y-auto">
      {data.starters.map((starter) => (
        <li key={starter.id} className="flex items-center gap-2.5 rounded-md px-1 py-1.5">
          <span
            aria-hidden
            className="flex h-7 w-10 shrink-0 overflow-hidden rounded border border-zinc-900/10 dark:border-white/15"
          >
            {SWATCHES.map((key) => (
              <span
                key={key}
                className="flex-1"
                style={{ background: starter.colors[key] ?? DEFAULT_COLORS.light[key] }}
              />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium">{starter.name}</span>
            <span
              className="block truncate text-[11.5px] text-zinc-500"
              title={starter.description}
            >
              {starter.description}
            </span>
          </span>
          <Button
            variant="ghost"
            disabled={busy !== null || exclude.has(starter.id)}
            onClick={() => void add(starter.id)}
          >
            {exclude.has(starter.id) ? <Check aria-hidden /> : <Plus aria-hidden />}
            {exclude.has(starter.id) ? t('themes.inProject') : t('themes.addStarter')}
          </Button>
        </li>
      ))}
    </ul>
  );
}

/** New themes start from a starter, or are made by the agent from a description. */
function NewTheme({ existing }: { existing: Set<string> }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState('');
  const [copied, copy] = useCopy();
  const id = useId();
  return (
    <div className="relative">
      <Button aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <Plus aria-hidden />
        {t('themes.new')}
      </Button>
      <Popover open={open} onClose={() => setOpen(false)} takeFocus={false} className="w-96 p-3">
        <p className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
          {t('themes.starters')}
        </p>
        <p className="mt-0.5 mb-2 text-[11.5px] leading-relaxed text-zinc-500">
          {t('themes.startersHint')}
        </p>
        {open && <StarterList exclude={existing} />}
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <label
            htmlFor={id}
            className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200"
          >
            {t('themes.orDescribe')}
          </label>
          <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">
            {t('themes.newHint')}
          </p>
          <textarea
            id={id}
            rows={3}
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            placeholder={t('themes.newPlaceholder')}
            className="focus-ring mt-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12.5px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
          />
          <Button
            variant="primary"
            className="mt-2"
            disabled={!request.trim()}
            onClick={() => copy(t('themes.newPrompt', { request: request.trim() }))}
          >
            {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
            {copied ? t('design.copied') : t('design.copyPrompt')}
          </Button>
        </div>
      </Popover>
    </div>
  );
}

export function ThemeGallery() {
  const t = useT();
  const { data, error, loading } = useResource<GalleryData>('/api/studio/themes');
  const themes = data?.themes ?? [];
  const existing = useMemo(() => new Set(themes.map((th) => th.id)), [themes]);
  return (
    <div>
      <PageHeader
        icon={<Palette />}
        title={t('nav.themes')}
        count={data ? themes.length : undefined}
        aside={<NewTheme existing={existing} />}
      />
      {error && <ErrorNotice error={error} />}
      {data && themes.length > 0 && (
        <p className="-mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('themes.referenceNote')}
        </p>
      )}
      {loading && !data && (
        <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Skeleton className="aspect-[16/10] w-full rounded-lg" />
              <Skeleton className="mt-3 h-4 w-1/2" />
              <Skeleton className="mt-2 h-3 w-full" />
            </div>
          ))}
        </div>
      )}
      {data && themes.length === 0 && (
        <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 dark:border-zinc-700">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <Palette className="size-5 text-zinc-400" aria-hidden />
            <p className="mt-4 text-[14px] font-semibold">{t('themes.emptyTitle')}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('themes.emptyBefore')}
              <Kbd>/create-theme</Kbd>
              {t('themes.emptyAfter')}
            </p>
            <div className="mt-5 w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-3 text-left dark:border-zinc-800 dark:bg-zinc-900">
              <p className="mb-2 text-[12.5px] font-medium">{t('themes.starters')}</p>
              <StarterList exclude={existing} />
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
        {themes.map((theme) => (
          <article key={theme.id} className="group relative min-w-0">
            <Thumbnail
              src={`/theme-preview/${encodeURIComponent(theme.id)}?thumb=1&lang=${t.locale}`}
              className="transition-[border-color,box-shadow] group-hover:border-zinc-300 group-hover:shadow-[0_6px_24px_-12px_rgb(0_0_0/0.25)] dark:group-hover:border-zinc-700"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <h2 className="text-[14px] font-medium">
                <Link
                  to={`/studio/themes/${theme.id}`}
                  className="focus-ring rounded-sm after:absolute after:inset-0"
                >
                  {theme.name}
                </Link>
              </h2>
              {!theme.hasDoc && <Badge tone="amber">{t('themes.noDocBadge')}</Badge>}
            </div>
            {theme.description && (
              <p className="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                {theme.description}
              </p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}

type Scheme = 'auto' | 'light' | 'dark';

export function ThemeDetailPage() {
  const { themeId = '' } = useParams();
  const detail = useResource<ThemeDetail>(themeUrl(themeId));
  const t = useT();
  const [adjusting, setAdjusting] = useState(false);
  const [scheme, setScheme] = useState<Scheme>('auto');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const shown = usePreviewNav(frame);
  const info = detail.data;
  const tokens = draft ?? info?.tokens;

  // A different theme starts from its saved tokens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the theme changes
  useEffect(() => setDraft(null), [themeId]);
  useFontStylesheets(info?.fonts);

  const src = useMemo(() => {
    const params = new URLSearchParams({ lang: t.locale });
    if (scheme !== 'auto') params.set('scheme', scheme);
    return `/theme-preview/${encodeURIComponent(themeId)}?${params}`;
  }, [scheme, themeId, t.locale]);

  const forcedScheme = tokens?.colorScheme;

  const postDraft = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { type: DRAFT_MESSAGE, themeId, tokens: draft },
      window.location.origin,
    );
  }, [draft, themeId]);

  useEffect(postDraft, [postDraft]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if ((event.data as { type?: string })?.type === READY_MESSAGE) postDraft();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [postDraft]);

  if (detail.error) return <ErrorNotice error={detail.error} />;

  const pages = shown
    ? [
        ...Array.from({ length: shown.total }, (_, i) => ({
          value: String(i),
          label: t('preview.step', { n: i + 1 }),
        })),
        { value: 'done', label: t('themes.done') },
      ]
    : [];

  return (
    <div>
      <Link
        to="/studio/themes"
        className="focus-ring inline-flex items-center gap-1 rounded-sm text-[13px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t('nav.themes')}
      </Link>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {info ? (
            <h1 className="text-xl font-semibold tracking-tight">{info.name}</h1>
          ) : (
            <Skeleton className="h-8 w-56" />
          )}
          {info?.description && (
            <p className="mt-1 max-w-2xl text-[13.5px] leading-relaxed text-zinc-600 dark:text-zinc-400">
              {info.description}
            </p>
          )}
          {info && <p className="mt-1.5 font-mono text-[11.5px] text-zinc-400">{info.file}</p>}
        </div>
        {info && (
          <Button
            variant={adjusting ? 'secondary' : 'primary'}
            aria-pressed={adjusting}
            onClick={() => setAdjusting((a) => !a)}
          >
            <SlidersHorizontal aria-hidden />
            {t('themes.adjust')}
          </Button>
        )}
      </div>

      <div
        className={cx(
          'mt-6',
          adjusting && 'lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-6',
        )}
      >
        <div className="@container min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <Segmented<Scheme>
              label={t('themes.colorScheme')}
              // A theme with `colorScheme` looks the same everywhere.
              disabled={Boolean(forcedScheme)}
              title={
                forcedScheme
                  ? t('themes.alwaysScheme', { scheme: t(`appearance.${forcedScheme}`) })
                  : undefined
              }
              value={scheme}
              onChange={setScheme}
              options={[
                { value: 'auto', label: t('themes.auto') },
                { value: 'light', label: t('appearance.light') },
                { value: 'dark', label: t('appearance.dark') },
              ]}
            />
            <Segmented<'desktop' | 'mobile'>
              label={t('preview.device')}
              value={device}
              onChange={setDevice}
              options={[
                { value: 'desktop', label: t('device.desktop'), icon: <Monitor aria-hidden /> },
                { value: 'mobile', label: t('device.mobile'), icon: <Smartphone aria-hidden /> },
              ]}
            />
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {shown && (
              <Segmented<string>
                label={t('themes.pages')}
                value={shown.done ? 'done' : String(shown.position)}
                options={pages}
                onChange={(page) =>
                  sendPreviewCommand(
                    frame.current,
                    page === 'done'
                      ? { type: 'done' }
                      : { type: 'goto', step: Number(page), quiet: true },
                  )
                }
              />
            )}
            <Button
              variant="ghost"
              aria-label={t('preview.restart')}
              title={t('preview.restart')}
              onClick={() => frame.current?.contentWindow?.location.reload()}
            >
              <RotateCw />
            </Button>
            <p className="min-w-0 flex-1 basis-64 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('themes.sampleNote')}
            </p>
          </div>
          <div className="flex justify-center rounded-xl border border-zinc-200 bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.06)_1px,transparent_0)] [background-size:16px_16px] p-3 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)]">
            <div
              className={cx(
                'w-full overflow-hidden bg-white shadow-[0_8px_40px_-12px_rgb(0_0_0/0.25)] transition-[max-width] duration-300 dark:bg-zinc-950',
                device === 'mobile' ? 'rounded-[20px]' : 'rounded-lg',
              )}
              style={{ maxWidth: device === 'mobile' ? 390 : '100%' }}
            >
              <iframe
                key={src}
                ref={frame}
                title={t('preview.frameTitle', { id: themeId })}
                src={src}
                className="block h-[min(72dvh,780px)] w-full"
              />
            </div>
          </div>

          {info && tokens ? (
            <ThemeSpec info={info} tokens={tokens} />
          ) : (
            <Skeleton className="mt-8 h-72 w-full" />
          )}
        </div>

        {adjusting && info && (
          <>
            <button
              type="button"
              aria-label={t('common.close')}
              onClick={() => setAdjusting(false)}
              className="fixed inset-0 z-30 cursor-default bg-black/20 lg:hidden"
            />
            <aside
              aria-label={t('themes.adjustTitle', { name: info.name })}
              className="fixed inset-y-0 right-0 z-40 flex w-[min(100vw,400px)] flex-col border-l border-zinc-200 bg-white shadow-xl lg:sticky lg:top-6 lg:z-auto lg:max-h-[calc(100dvh-3rem)] lg:w-auto lg:rounded-xl lg:border lg:shadow-none dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <h2 className="truncate text-[13.5px] font-semibold">
                  {t('themes.adjustTitle', { name: info.name })}
                </h2>
                <button
                  type="button"
                  aria-label={t('common.close')}
                  onClick={() => setAdjusting(false)}
                  className="focus-ring ml-auto grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
                <DesignPanel
                  target={{ kind: 'theme', id: info.id }}
                  detail={info}
                  draft={draft}
                  onDraft={setDraft}
                  onFontsChanged={detail.reload}
                />
              </div>
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

/** Load the theme's own web fonts into Studio so the spec shows them, not a fallback. */
function useFontStylesheets(fonts: ThemeDetail['fonts'] | undefined) {
  const hrefs = (fonts ?? []).flatMap((f) => (f.href ? [f.href] : [])).join('\n');
  useEffect(() => {
    if (!hrefs) return;
    const links = hrefs.split('\n').map((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      return link;
    });
    return () => {
      for (const link of links) link.remove();
    };
  }, [hrefs]);
}

/** THEME.md as written, beside what the theme's tokens actually say. */
function ThemeSpec({ info, tokens }: { info: ThemeDetail; tokens: ThemeTokens }) {
  return (
    <div className="mt-8 grid gap-5 @3xl:grid-cols-[minmax(0,1fr)_17.5rem]">
      <div className="min-w-0 space-y-4 @3xl:order-last">
        <UseIt themeId={info.id} />
        <ColorFacts tokens={tokens} />
        <TypeFacts tokens={tokens} />
        <ShapeFacts tokens={tokens} layout={info.layout} />
      </div>
      <article className="min-w-0 self-start rounded-xl border border-zinc-200 p-5 sm:p-6 dark:border-zinc-800">
        {info.doc ? <Markdown source={info.doc} skipTitle /> : <NoDoc info={info} />}
      </article>
    </div>
  );
}

function Fact({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

const KEY_COLORS: ThemeColorKey[] = [
  'primary',
  'background',
  'surface',
  'foreground',
  'muted',
  'border',
  'error',
];

function ColorFacts({ tokens }: { tokens: ThemeTokens }) {
  const t = useT();
  const palettes = useMemo(() => effectivePalettes(tokens), [tokens]);
  return (
    <Fact title={t('design.colors')}>
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[11px] text-zinc-400">
            <th className="pb-1.5 text-left font-normal">
              <span className="sr-only">{t('design.palette')}</span>
            </th>
            {palettes.map((p) => (
              <th key={p.scheme} className="pb-1.5 text-left font-normal">
                {t(`appearance.${p.scheme}`)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {KEY_COLORS.map((key) => (
            <tr key={key}>
              <th
                scope="row"
                className="py-1 pr-2 text-left font-normal text-zinc-600 dark:text-zinc-400"
              >
                {t(`color.${key}`)}
              </th>
              {palettes.map((p) => (
                <td key={p.scheme} className="py-1">
                  <span className="flex min-w-0 items-center gap-1.5" title={p.colors[key]}>
                    <span
                      className="size-4 shrink-0 rounded border border-zinc-900/10 dark:border-white/15"
                      style={{ background: p.colors[key] }}
                    />
                    <span className="truncate font-mono text-[10.5px] text-zinc-500">
                      {p.colors[key]}
                    </span>
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 space-y-2">
        {palettes.map((p) => (
          <ContrastList key={p.scheme} tokens={tokens} scheme={p.scheme} />
        ))}
      </div>
    </Fact>
  );
}

// Theme fonts end with the form's CJK stack, which the runtime sets per language.
const CJK_FONTS = {
  '--of-cjk': '"PingFang TC", "Noto Sans TC", "Hiragino Sans", "Noto Sans CJK JP", sans-serif',
  '--of-cjk-serif': '"Songti TC", "Noto Serif TC", "Hiragino Mincho ProN", serif',
} as CSSProperties;

function TypeFacts({ tokens }: { tokens: ThemeTokens }) {
  const t = useT();
  const rows = [
    {
      key: 'headings',
      stack: tokens.headingFont ?? tokens.font,
      sample: 'Aa 永',
      size: 'text-[28px] leading-tight',
    },
    { key: 'body', stack: tokens.font, sample: t('themes.spec.sample'), size: 'text-[15px]' },
  ] as const;
  return (
    <Fact title={t('design.type')}>
      <div className="space-y-3" style={CJK_FONTS}>
        {rows.map((row) => (
          <div key={row.key} className="min-w-0">
            <p
              className={cx(row.size, 'text-zinc-900 dark:text-zinc-100')}
              style={{ fontFamily: row.stack }}
            >
              {row.sample}
            </p>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500" title={row.stack}>
              {t(`themes.spec.${row.key}`)} ·{' '}
              {row.stack ? fontName(row.stack, t) : t('themes.spec.default')}
            </p>
          </div>
        ))}
      </div>
    </Fact>
  );
}

function ShapeFacts({ tokens, layout }: { tokens: ThemeTokens; layout?: string }) {
  const t = useT();
  const rows: Array<[string, string | undefined]> = [
    [t('design.radius'), tokens.radius],
    [t('design.buttonRadius'), tokens.buttonRadius],
    [t('design.width'), tokens.width],
    [t('design.spacing'), tokens.spacing && t(`design.${tokens.spacing}`)],
    [
      t('design.frame'),
      tokens.layout && t(tokens.layout === 'plain' ? 'design.framePlain' : 'design.frameCard'),
    ],
    [t('themes.spec.layout'), layout],
  ];
  return (
    <Fact title={t('design.shape')}>
      <div className="mb-3 flex items-center gap-2" aria-hidden>
        <span
          className="h-7 flex-1 border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950"
          style={{ borderRadius: tokens.radius ?? '10px' }}
        />
        <span
          className="h-7 w-16 bg-zinc-900 dark:bg-zinc-100"
          style={{ borderRadius: tokens.buttonRadius ?? tokens.radius ?? '10px' }}
        />
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px]">
        {rows.map(([label, value]) => (
          <Fragment key={label}>
            <dt className="text-zinc-600 dark:text-zinc-400">{label}</dt>
            <dd
              className={cx(
                'truncate text-right',
                value ? 'font-mono text-[11.5px]' : 'text-zinc-400',
              )}
              title={value}
            >
              {value ?? t('themes.spec.default')}
            </dd>
          </Fragment>
        ))}
      </dl>
    </Fact>
  );
}

/** Themes are references: a form's look is written for it, so nothing here changes a form. */
function UseIt({ themeId }: { themeId: string }) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <Fact title={t('themes.useTitle')}>
      <p className="text-[12px] leading-relaxed text-zinc-500">{t('themes.useBody')}</p>
      <p className="mt-2">
        <Kbd>open-form create &lt;form&gt; --theme {themeId}</Kbd>
      </p>
      <Button className="mt-3" onClick={() => copy(t('themes.usePrompt', { id: themeId }))}>
        {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
        {copied ? t('design.copied') : t('design.copyPrompt')}
      </Button>
    </Fact>
  );
}

function NoDoc({ info }: { info: ThemeDetail }) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <div>
      <p className="text-[13px] leading-relaxed text-zinc-600 dark:text-zinc-400">
        {t('themes.noDoc')}
      </p>
      <Button
        className="mt-3"
        onClick={() => copy(t('themes.docPrompt', { id: info.id, file: info.file }))}
      >
        {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
        {copied ? t('design.copied') : t('themes.askForDoc')}
      </Button>
    </div>
  );
}
