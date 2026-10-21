import {
  ArrowLeft,
  Check,
  ChevronRight,
  ClipboardCopy,
  Copy,
  Monitor,
  Palette,
  Plus,
  RotateCw,
  Smartphone,
  TriangleAlert,
  X,
} from 'lucide-react';
import {
  type CSSProperties,
  Fragment,
  type MouseEvent,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams } from 'react-router-dom';
import {
  contrastReport,
  effectivePalettes,
  type ThemeColorKey,
  type ThemeTokens,
} from '../../schema/index.ts';
import { sendPreviewCommand, usePreviewNav } from '../lib/preview-channel.ts';
import {
  stackFamilies,
  THEME_LOADED_MESSAGE,
  type ThemeFontFace,
  type ThemeLoaded,
} from '../lib/theme-preview.ts';
import { type ThemeInfo, useThemeCatalog } from '../lib/themes.ts';
import { ContrastRows, contrastWarning, fontName } from './design-panel.tsx';
import { useT } from './i18n.tsx';
import { Markdown, markdownOutline } from './markdown.tsx';
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

// Studio's Themes pages are read-only, under dev and in production alike: a theme
// in themes/ is a reference your agent reads, and changes go through the agent
// (the create-theme skill) or `open-form theme add`.

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

/** A shell command with a copy button beside it. */
function Command({ text }: { text: string }) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <div className="flex min-w-0 items-center gap-1 rounded-md border border-zinc-200 bg-zinc-50 py-1 pr-1 pl-2.5 dark:border-zinc-800 dark:bg-zinc-900">
      <code
        className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-300"
        title={text}
      >
        {text}
      </code>
      <button
        type="button"
        aria-label={copied ? t('themes.copied') : t('themes.copyCommand')}
        title={copied ? t('themes.copied') : t('themes.copyCommand')}
        onClick={() => copy(text)}
        className="focus-ring grid size-6 shrink-0 place-items-center rounded text-zinc-400 transition-colors hover:bg-zinc-200/70 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-3.5"
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      </button>
    </div>
  );
}

/** New themes come from the agent or a starter; Studio only hands over the words. */
function NewTheme() {
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
        <label htmlFor={id} className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
          {t('themes.newTitle')}
        </label>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{t('themes.newHint')}</p>
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
        <div className="mt-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <p className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
            {t('themes.fromStarter')}
          </p>
          <p className="mt-0.5 mb-2 text-[11.5px] leading-relaxed text-zinc-500">
            {t('themes.fromStarterHint')}
          </p>
          <Command text="open-form theme add <starter>" />
        </div>
      </Popover>
    </div>
  );
}

export function ThemeGallery() {
  const t = useT();
  const themes = useThemeCatalog();
  return (
    <div>
      <PageHeader
        icon={<Palette />}
        title={t('nav.themes')}
        count={themes.length}
        aside={<NewTheme />}
      />
      {themes.length > 0 ? (
        <p className="-mt-2 mb-6 max-w-2xl text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('themes.referenceNote')}
        </p>
      ) : (
        <div className="rounded-xl border border-dashed border-zinc-300 px-8 py-16 dark:border-zinc-700">
          <div className="mx-auto flex max-w-md flex-col items-center text-center">
            <Palette className="size-5 text-zinc-400" aria-hidden />
            <p className="mt-4 text-[14px] font-semibold">{t('themes.emptyTitle')}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('themes.emptyBefore')}
              <Kbd>/create-theme</Kbd>
              {t('themes.emptyAfter')}
            </p>
            <div className="mt-4 w-full max-w-xs text-left">
              <Command text="open-form theme add <starter>" />
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
              {theme.doc === null && <Badge tone="amber">{t('themes.noDocBadge')}</Badge>}
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

function BackLink() {
  const t = useT();
  return (
    <Link
      to="/studio/themes"
      className="focus-ring inline-flex items-center gap-1 rounded-sm text-[13px] text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
    >
      <ArrowLeft className="size-3.5" aria-hidden />
      {t('nav.themes')}
    </Link>
  );
}

type Reported = { tokens: ThemeTokens; fonts: ThemeFontFace[] } | { error: string };

/** What the preview frame reports about the theme it loaded. */
function useReportedTheme(
  frame: RefObject<HTMLIFrameElement | null>,
  themeId: string,
): Reported | null {
  const [reported, setReported] = useState<{ themeId: string; value: Reported } | null>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as ThemeLoaded | undefined;
      if (data?.type !== THEME_LOADED_MESSAGE || data.themeId !== themeId) return;
      setReported({
        themeId,
        value: 'error' in data ? { error: data.error } : { tokens: data.tokens, fonts: data.fonts },
      });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame, themeId]);
  return reported?.themeId === themeId ? reported.value : null;
}

/**
 * Registers the theme's web fonts under names of their own while the page is
 * open, so a family Studio also uses (say, "Noto Sans TC") never changes Studio.
 */
function useSpecimenFonts(themeId: string, faces: ThemeFontFace[] | undefined) {
  const [names, setNames] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    const added: FontFace[] = [];
    const next = new Map<string, string>();
    for (const face of faces ?? []) {
      const name = `of-specimen-${themeId}-${face.family}`;
      try {
        const font = new FontFace(name, face.src, face.descriptors);
        document.fonts.add(font);
        added.push(font);
        next.set(face.family.toLowerCase(), name);
      } catch {}
    }
    setNames(next);
    return () => {
      for (const font of added) document.fonts.delete(font);
    };
  }, [themeId, faces]);
  return names;
}

export function ThemeDetailPage() {
  const { themeId = '' } = useParams();
  const t = useT();
  const info = useThemeCatalog().find((theme) => theme.id === themeId);
  const frame = useRef<HTMLIFrameElement>(null);
  const reported = useReportedTheme(frame, themeId);
  const tokens = reported && 'tokens' in reported ? reported.tokens : undefined;
  const failed = reported && 'error' in reported ? reported.error : undefined;
  const fonts = useSpecimenFonts(
    themeId,
    reported && 'fonts' in reported ? reported.fonts : undefined,
  );

  if (!info) {
    return (
      <div>
        <BackLink />
        <p className="mt-6 text-[13.5px] text-zinc-600 dark:text-zinc-400">
          {t('themes.notFound', { id: themeId })}
        </p>
      </div>
    );
  }

  return (
    <div className="@container">
      <BackLink />
      <ThemeHeader info={info} tokens={tokens} failed={failed !== undefined} />
      {failed !== undefined && (
        <div className="mt-6">
          <ErrorNotice
            error={new Error(t('themes.loadFailed', { file: info.file, error: failed }))}
          />
        </div>
      )}
      <ThemePreview frame={frame} themeId={info.id} tokens={tokens} failed={failed !== undefined} />
      {failed === undefined && (
        <ThemeTokensSection
          id={info.id}
          name={info.name}
          tokens={tokens}
          fonts={fonts}
          layout={info.layout}
        />
      )}
      <ThemeGuide info={info} />
    </div>
  );
}

const IDENTITY: ThemeColorKey[] = ['background', 'surface', 'primary', 'foreground'];

function ThemeHeader({
  info,
  tokens,
  failed,
}: {
  info: ThemeInfo;
  tokens?: ThemeTokens;
  failed: boolean;
}) {
  const t = useT();
  const [copied, copy] = useCopy();
  const colors = tokens && effectivePalettes(tokens)[0]?.colors;
  const schemes = !tokens
    ? null
    : tokens.colorScheme === 'dark'
      ? t('themes.schemes.dark')
      : tokens.colorScheme === 'light' || tokens.dark === false
        ? t('themes.schemes.light')
        : t('themes.schemes.both');
  return (
    <header className="mt-3 flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl flex-1 basis-80">
        <div className="flex items-center gap-3">
          {colors ? (
            <span
              aria-hidden
              className="flex h-7 w-9 shrink-0 overflow-hidden rounded-md ring-1 ring-zinc-900/10 dark:ring-white/15"
            >
              {IDENTITY.map((key) => (
                <span key={key} className="flex-1" style={{ background: colors[key] }} />
              ))}
            </span>
          ) : (
            !failed && <Skeleton className="h-7 w-9 rounded-md" />
          )}
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-tight">{info.name}</h1>
        </div>
        {info.description && (
          <p className="mt-2 text-[14px] leading-relaxed text-zinc-600 dark:text-zinc-400">
            {info.description}
          </p>
        )}
        <ul className="mt-3 flex flex-wrap items-center gap-1.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          <li className="rounded-md border border-zinc-200 px-1.5 py-0.5 font-mono dark:border-zinc-800">
            {info.file}
          </li>
          {schemes && (
            <li className="rounded-md border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-800">
              {schemes}
            </li>
          )}
          {info.layout && (
            <li className="rounded-md border border-zinc-200 px-1.5 py-0.5 dark:border-zinc-800">
              {info.layout}
            </li>
          )}
        </ul>
      </div>
      <Button
        variant="primary"
        title={t('themes.useCtaHint')}
        onClick={() => copy(t('themes.usePrompt', { id: info.id }))}
      >
        {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
        {copied ? t('design.copied') : t('themes.useCta')}
      </Button>
    </header>
  );
}

type Scheme = 'auto' | 'light' | 'dark';

function ThemePreview({
  frame,
  themeId,
  tokens,
  failed,
}: {
  frame: RefObject<HTMLIFrameElement | null>;
  themeId: string;
  tokens?: ThemeTokens;
  failed: boolean;
}) {
  const t = useT();
  const [scheme, setScheme] = useState<Scheme>('auto');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const shown = usePreviewNav(frame);
  const forced = tokens?.colorScheme;

  const src = useMemo(() => {
    const params = new URLSearchParams({ lang: t.locale });
    if (scheme !== 'auto') params.set('scheme', scheme);
    return `/theme-preview/${encodeURIComponent(themeId)}?${params}`;
  }, [scheme, themeId, t.locale]);

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
    <section
      aria-label={t('themes.preview')}
      className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/60"
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {shown ? (
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
        ) : (
          !failed && <Skeleton className="h-8 w-44 rounded-lg" />
        )}
        <Button
          variant="ghost"
          className="px-2"
          aria-label={t('preview.restart')}
          title={t('preview.restart')}
          onClick={() => frame.current?.contentWindow?.location.reload()}
        >
          <RotateCw />
        </Button>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Segmented<Scheme>
            label={t('themes.colorScheme')}
            // A theme with `colorScheme` looks the same everywhere.
            disabled={Boolean(forced)}
            title={
              forced ? t('themes.alwaysScheme', { scheme: t(`appearance.${forced}`) }) : undefined
            }
            value={forced ?? scheme}
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
      </div>
      <div className="flex justify-center bg-zinc-50 bg-[radial-gradient(circle_at_1px_1px,rgb(0_0_0/0.07)_1px,transparent_0)] [background-size:16px_16px] px-3 py-4 sm:px-6 sm:py-6 dark:bg-zinc-950 dark:bg-[radial-gradient(circle_at_1px_1px,rgb(255_255_255/0.06)_1px,transparent_0)]">
        <div
          className={cx(
            'w-full overflow-hidden bg-white transition-[max-width,border-radius] duration-300 ease-out dark:bg-zinc-950',
            device === 'mobile'
              ? 'rounded-[28px] border-[6px] border-zinc-900 shadow-[0_24px_60px_-24px_rgb(0_0_0/0.45)] dark:border-zinc-700'
              : 'rounded-lg shadow-[0_8px_40px_-12px_rgb(0_0_0/0.25)] ring-1 ring-zinc-900/5 dark:ring-white/10',
          )}
          style={{ maxWidth: device === 'mobile' ? 402 : '100%' }}
        >
          <iframe
            key={src}
            ref={frame}
            title={t('preview.frameTitle', { id: themeId })}
            src={src}
            className="block h-[min(72dvh,760px)] w-full"
          />
        </div>
      </div>
      <p className="border-t border-zinc-200 px-4 py-2.5 text-[12px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        {t('themes.sampleNote')}
      </p>
    </section>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
      {hint && (
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      )}
    </div>
  );
}

function Spec({
  title,
  aside,
  children,
}: {
  title: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="@container min-w-0 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
}

function ThemeTokensSection({
  id,
  name,
  tokens,
  fonts,
  layout,
}: {
  id: string;
  name: string;
  tokens?: ThemeTokens;
  fonts: ReadonlyMap<string, string>;
  layout?: string;
}) {
  const t = useT();
  return (
    <section className="mt-10">
      <SectionTitle
        title={t('themes.tokens')}
        hint={
          <>
            {t('themes.tokensBefore')}
            <code className="font-mono text-[0.92em] text-zinc-700 dark:text-zinc-300">
              --theme {id}
            </code>
            {t('themes.tokensAfter')}
          </>
        }
      />
      {tokens ? (
        <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <ColorSpec tokens={tokens} name={name} />
          <TypeSpec tokens={tokens} fonts={fonts} />
          <ShapeSpec tokens={tokens} layout={layout} />
        </div>
      ) : (
        <div className="grid gap-4 @4xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      )}
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

function ColorSpec({ tokens, name }: { tokens: ThemeTokens; name: string }) {
  const t = useT();
  const palettes = useMemo(() => effectivePalettes(tokens), [tokens]);
  return (
    <Spec title={t('design.colors')}>
      <div className="space-y-4">
        {palettes.map((p) => (
          <div key={p.scheme}>
            {palettes.length > 1 && (
              <p className="mb-2 text-[11.5px] font-medium text-zinc-600 dark:text-zinc-400">
                {t(`appearance.${p.scheme}`)}
              </p>
            )}
            <ul className="grid grid-cols-4 gap-x-2 gap-y-3 @sm:grid-cols-7">
              {KEY_COLORS.map((key) => (
                <li key={key} className="min-w-0">
                  <span
                    className="block h-9 rounded-md ring-1 ring-zinc-900/10 ring-inset dark:ring-white/15"
                    style={{ background: p.colors[key] }}
                    title={`${t(`color.${key}`)} · ${p.colors[key]}`}
                  />
                  <span className="mt-1.5 block truncate text-[11px] text-zinc-600 dark:text-zinc-400">
                    {t(`color.${key}`)}
                  </span>
                  <span className="block truncate font-mono text-[10.5px] text-zinc-400">
                    {p.colors[key]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <ContrastCheck tokens={tokens} name={name} />
    </Spec>
  );
}

type ContrastReport = ReturnType<typeof contrastReport>;

const failingIn = (palette: ContrastReport['palettes'][number]) =>
  palette.rows.filter((row) => !row.ok).length;

/** A one-line verdict per scheme; every pair and ratio opens in a dialog. */
function ContrastCheck({ tokens, name }: { tokens: ThemeTokens; name: string }) {
  const t = useT();
  const report = useMemo(() => contrastReport(tokens), [tokens]);
  const [open, setOpen] = useState(false);
  const failing = report.palettes.some((p) => failingIn(p) > 0);
  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="focus-ring mt-4 flex w-full items-center gap-2.5 rounded-lg border border-zinc-200 px-3 py-2 text-left transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/40"
      >
        {failing ? (
          <TriangleAlert className="size-3.5 shrink-0 text-amber-500" aria-hidden />
        ) : (
          <Check className="size-3.5 shrink-0 text-emerald-500" aria-hidden />
        )}
        <span className="text-[12.5px] font-medium">{t('contrast.label')}</span>
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-zinc-500 dark:text-zinc-400">
          {report.palettes.map((p, i) => (
            <Fragment key={p.scheme}>
              {i > 0 && ' · '}
              {t(`appearance.${p.scheme}`)}{' '}
              <span className={cx(failingIn(p) > 0 && 'text-amber-700 dark:text-amber-400')}>
                {failingIn(p) > 0 ? t.n('contrast.failing', failingIn(p)) : t('contrast.allPass')}
              </span>
            </Fragment>
          ))}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 text-[11.5px] text-zinc-500 dark:text-zinc-400">
          {t('contrast.details')}
          <ChevronRight className="size-3.5" aria-hidden />
        </span>
      </button>
      {open && <ContrastDialog name={name} report={report} onClose={() => setOpen(false)} />}
    </>
  );
}

function ContrastDialog({
  name,
  report,
  onClose,
}: {
  name: string;
  report: ContrastReport;
  onClose(): void;
}) {
  const t = useT();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => ref.current?.showModal(), []);
  const close = () => ref.current?.close();
  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a shortcut; Escape closes it too
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      // The panel fills the dialog, so a click that lands on the dialog itself is the backdrop.
      onClick={(event) => event.target === event.currentTarget && close()}
      className={cx(
        'm-auto max-h-[min(44rem,calc(100dvh-2rem))] overflow-hidden rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl transition-[opacity,scale] duration-200 ease-out backdrop:bg-zinc-950/40 starting:scale-[0.96] starting:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100',
        report.palettes.length > 1
          ? 'w-[min(46rem,calc(100vw-2rem))]'
          : 'w-[min(28rem,calc(100vw-2rem))]',
      )}
    >
      <div className="flex max-h-[inherit] flex-col">
        <div className="flex items-start gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="text-[15px] font-semibold tracking-tight">
              {t('contrast.dialogTitle', { name })}
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('contrast.dialogHint')}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('common.close')}
            onClick={close}
            className="focus-ring -mt-1 -mr-2 grid size-8 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 overflow-y-auto p-5">
          <div className={cx('grid gap-4', report.palettes.length > 1 && 'sm:grid-cols-2')}>
            {report.palettes.map((p) => (
              <section
                key={p.scheme}
                aria-label={t('contrast.title', { scheme: t(`appearance.${p.scheme}`) })}
                className="rounded-lg border border-zinc-200 px-3 py-2.5 dark:border-zinc-800"
              >
                <h3 className="mb-2 flex items-center gap-2 text-[12.5px] font-medium">
                  {failingIn(p) > 0 ? (
                    <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />
                  ) : (
                    <Check className="size-3.5 text-emerald-500" aria-hidden />
                  )}
                  {t(`appearance.${p.scheme}`)}
                  <span
                    className={cx(
                      'ml-auto text-[11.5px] font-normal',
                      failingIn(p) > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-zinc-500',
                    )}
                  >
                    {failingIn(p) > 0
                      ? t.n('contrast.failing', failingIn(p))
                      : t('contrast.allPass')}
                  </span>
                </h3>
                <ContrastRows rows={p.rows} />
              </section>
            ))}
          </div>
          {report.warnings.map((w) => (
            <p
              key={w}
              className="mt-4 text-[12px] leading-relaxed text-amber-700 dark:text-amber-400"
            >
              {contrastWarning(t, w)}
            </p>
          ))}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

// Theme fonts end with the form's CJK stack, which the runtime sets per language.
const CJK_FONTS = {
  '--of-cjk': '"PingFang TC", "Noto Sans TC", "Hiragino Sans", "Noto Sans CJK JP", sans-serif',
  '--of-cjk-serif': '"Songti TC", "Noto Serif TC", "Hiragino Mincho ProN", serif',
} as CSSProperties;

/** A font stack with the theme's web fonts swapped for their specimen names. */
function specimenStack(stack: string | undefined, fonts: ReadonlyMap<string, string>) {
  if (!stack) return undefined;
  return stack
    .split(',')
    .map((part) => {
      const name = fonts.get(stackFamilies(part)[0]?.toLowerCase() ?? '');
      return name ? JSON.stringify(name) : part.trim();
    })
    .join(', ');
}

function TypeSpec({ tokens, fonts }: { tokens: ThemeTokens; fonts: ReadonlyMap<string, string> }) {
  const t = useT();
  const heading = tokens.headingFont ?? tokens.font;
  const name = (stack?: string) => (stack ? fontName(stack, t) : t('themes.spec.default'));
  return (
    <Spec title={t('design.type')}>
      <div style={CJK_FONTS}>
        <p
          className="text-[44px] leading-none tracking-tight text-zinc-900 dark:text-zinc-100"
          style={{ fontFamily: specimenStack(heading, fonts) }}
        >
          Aa 永
        </p>
        <p className="mt-2 truncate text-[11.5px] text-zinc-500" title={heading}>
          {t('themes.spec.headings')} · {name(heading)}
        </p>
        <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p
            className="text-[15px] leading-relaxed text-zinc-800 dark:text-zinc-200"
            style={{ fontFamily: specimenStack(tokens.font, fonts) }}
          >
            {t('themes.spec.sample')}
          </p>
          <p className="mt-1 truncate text-[11.5px] text-zinc-500" title={tokens.font}>
            {t('themes.spec.body')} · {name(tokens.font)}
          </p>
        </div>
      </div>
    </Spec>
  );
}

function ShapeSpec({ tokens, layout }: { tokens: ThemeTokens; layout?: string }) {
  const t = useT();
  const colors = useMemo(() => effectivePalettes(tokens)[0]?.colors, [tokens]);
  const radius = tokens.radius ?? '10px';
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
    <Spec title={t('design.shape')}>
      {colors && (
        <div
          aria-hidden
          className="rounded-lg p-3 ring-1 ring-zinc-900/10 ring-inset dark:ring-white/10"
          style={{ background: colors.background }}
        >
          <div
            className="p-3"
            style={{
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `calc(${radius} * 1.6)`,
            }}
          >
            <span
              className="block h-1.5 w-1/3 rounded-full"
              style={{ background: colors.foreground }}
            />
            <span
              className="mt-2.5 block h-7"
              style={{
                background: colors.input,
                border: `1px solid ${colors.control}`,
                borderRadius: radius,
              }}
            />
            <span className="mt-2.5 flex justify-end">
              <span
                className="h-7 w-16"
                style={{ background: colors.primary, borderRadius: tokens.buttonRadius ?? radius }}
              />
            </span>
          </div>
        </div>
      )}
      <dl className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[12px]">
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
    </Spec>
  );
}

/** The `##` section nearest the top of the viewport. */
function useActiveSection(ids: string[]): string | undefined {
  const [active, setActive] = useState<string>();
  const key = ids.join('\n');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for `ids`
  useEffect(() => {
    const headings = ids.flatMap((id) => {
      const el = document.getElementById(id);
      return el ? [el] : [];
    });
    if (!headings.length) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '0px 0px -70% 0px' },
    );
    for (const el of headings) observer.observe(el);
    return () => observer.disconnect();
  }, [key]);
  return active;
}

function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  event.preventDefault();
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
}

function ThemeGuide({ info }: { info: ThemeInfo }) {
  const t = useT();
  const outline = useMemo(() => (info.doc ? markdownOutline(info.doc) : []), [info.doc]);
  const active = useActiveSection(outline.map((s) => s.id));
  return (
    <section className="mt-12 grid grid-cols-[minmax(0,1fr)] items-start gap-8 @3xl:grid-cols-[minmax(0,1fr)_17rem] @5xl:grid-cols-[10rem_minmax(0,1fr)_17rem]">
      {outline.length > 1 && (
        <nav aria-label={t('themes.onThisPage')} className="sticky top-6 hidden @5xl:block">
          <p className="mb-2 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
            {t('themes.onThisPage')}
          </p>
          <ul className="space-y-0.5 border-l border-zinc-200 dark:border-zinc-800">
            {outline.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  onClick={(event) => scrollToSection(event, s.id)}
                  aria-current={active === s.id ? 'location' : undefined}
                  className={cx(
                    'focus-ring -ml-px block border-l py-1 pl-3 text-[12.5px] leading-snug transition-colors',
                    active === s.id
                      ? 'border-zinc-900 font-medium text-zinc-900 dark:border-zinc-100 dark:text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100',
                  )}
                >
                  {s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
      <article
        className={cx('min-w-0', outline.length <= 1 && '@5xl:col-span-2')}
        aria-labelledby="theme-guide"
      >
        <div className="mb-4 flex items-baseline gap-2">
          <h2 id="theme-guide" className="text-[15px] font-semibold tracking-tight">
            {t('themes.guide')}
          </h2>
          <span className="font-mono text-[11.5px] text-zinc-400">THEME.md</span>
        </div>
        {info.doc ? <Markdown source={info.doc} skipTitle /> : <NoDoc info={info} />}
      </article>
      <aside className="min-w-0 space-y-4 @3xl:sticky @3xl:top-6">
        <UseIt id={info.id} />
        <ChangeIt info={info} />
      </aside>
    </section>
  );
}

function AsideCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h3 className="text-[13px] font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

/** Themes are references: a form's look is written for it, so nothing here changes a form. */
function UseIt({ id }: { id: string }) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <AsideCard title={t('themes.useTitle')}>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t('themes.useBody')}
      </p>
      <div className="mt-3">
        <Command text={`open-form create <form> --theme ${id}`} />
      </div>
      <Button className="mt-2 w-full" onClick={() => copy(t('themes.usePrompt', { id }))}>
        {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
        {copied ? t('design.copied') : t('design.copyPrompt')}
      </Button>
    </AsideCard>
  );
}

/** The way to change a theme: say what you want and hand it to your agent. */
function ChangeIt({ info }: { info: ThemeInfo }) {
  const t = useT();
  const [request, setRequest] = useState('');
  const [copied, copy] = useCopy();
  const id = useId();
  return (
    <AsideCard title={t('themes.changeTitle')}>
      <p className="mt-1 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t('themes.changeHint')}
      </p>
      <label htmlFor={id} className="sr-only">
        {t('design.askTitle')}
      </label>
      <textarea
        id={id}
        rows={3}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder={t('design.askPlaceholder')}
        className="focus-ring mt-3 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12.5px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
      />
      <Button
        className="mt-2 w-full"
        disabled={!request.trim()}
        onClick={() =>
          copy(t('design.agentPrompt', { id: info.id, file: info.file, request: request.trim() }))
        }
      >
        {copied ? <Check aria-hidden /> : <ClipboardCopy aria-hidden />}
        {copied ? t('design.copied') : t('design.copyPrompt')}
      </Button>
    </AsideCard>
  );
}

function NoDoc({ info }: { info: ThemeInfo }) {
  const t = useT();
  const [copied, copy] = useCopy();
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-5 dark:border-zinc-700">
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
