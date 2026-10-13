import {
  Check,
  ChevronRight,
  ClipboardCopy,
  Plus,
  RotateCcw,
  Save,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import {
  contrastReport,
  DEFAULT_COLORS,
  diffTokens,
  isEmptyPatch,
  parseColor,
  THEME_COLOR_KEYS,
  type Theme,
  type ThemeColorKey,
  type ThemeColors,
  type ThemeTokens,
  toHex,
} from '../../schema/index.ts';
import { ApiError, saveThemeTokens, type ThemeDetail, type ThemeFont } from './api.ts';
import { FontPicker } from './font-picker.tsx';
import { formatBytes } from './format.ts';
import { type Translate, useT } from './i18n.tsx';
import { Button, cx, Dropdown, type DropdownOption } from './ui.tsx';

// Contrast rows come from the shared checker with English labels; map them here.
const CONTRAST_KEYS = {
  'text on surface': 'contrast.textSurface',
  'text on background': 'contrast.textBackground',
  'answers in inputs': 'contrast.answers',
  'help text (muted)': 'contrast.muted',
  'button text': 'contrast.button',
  errors: 'contrast.errors',
  'control outlines': 'contrast.controls',
  'focus / selection': 'contrast.focus',
} as const;

function contrastLabel(t: Translate, label: string): string {
  const base = label.replace(/ \(.*\)$/, '') as keyof typeof CONTRAST_KEYS;
  return CONTRAST_KEYS[base] ? t(CONTRAST_KEYS[base]) : base;
}

// Quick font choices; each ends with the CJK fallback that follows the form's language.
const FONT_PRESETS = [
  {
    key: 'sans',
    value: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  },
  {
    key: 'rounded',
    value: 'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, var(--of-cjk), sans-serif',
  },
  {
    key: 'serif',
    value: 'ui-serif, "Iowan Old Style", Georgia, var(--of-cjk-serif), serif',
  },
  { key: 'mono', value: 'ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace' },
] as const;

const FONT_KINDS = [
  {
    kind: 'sans',
    test: /^(ui-sans-serif|system-ui|-apple-system|BlinkMacSystemFont|sans-serif)$/i,
  },
  { kind: 'serif', test: /^(ui-serif|serif)$/i },
  { kind: 'mono', test: /^(ui-monospace|monospace)$/i },
  { kind: 'rounded', test: /^ui-rounded$/i },
] as const;

/** What a stack looks like: its first family, or the kind of system font it asks for. */
export function fontName(stack: string, t: Translate): string {
  const first =
    stack
      .split(',')[0]
      ?.trim()
      .replace(/^["']|["']$/g, '') ?? stack;
  const generic = FONT_KINDS.find((k) => k.test.test(first));
  return generic ? t(`design.font.${generic.kind}`) : first;
}

const RADIUS_PRESETS = ['0px', '4px', '8px', '12px', '16px', '24px'];
const ADD_FONT = '\0add-font';

type FontKey = 'font' | 'headingFont';

type Palette = 'light' | 'dark';

function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="border-b border-zinc-200 py-4 first:pt-1 last:border-0 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          {title}
        </h3>
        {aside}
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

const INPUT =
  'focus-ring h-8 w-full min-w-0 rounded-md border border-zinc-200 bg-white px-2 text-[12.5px] text-zinc-900 placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-600';

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children(id: string): ReactNode;
}) {
  const id = useId();
  return (
    <div className="grid grid-cols-[108px_minmax(0,1fr)] items-center gap-2">
      <label htmlFor={id} className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
          {label}
        </span>
        {hint && <span className="block truncate text-[11px] text-zinc-500">{hint}</span>}
      </label>
      <div className="flex min-w-0 items-center gap-1.5">{children(id)}</div>
    </div>
  );
}

function TextToken({
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  placeholder: string;
  onChange(value: string | undefined): void;
}) {
  return (
    <Row label={label} hint={hint}>
      {(id) => (
        <input
          id={id}
          className={INPUT}
          value={value ?? ''}
          placeholder={placeholder}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      )}
    </Row>
  );
}

function SelectToken<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: Array<{ value: T | ''; label: string; detail?: string }>;
  onChange(value: T | undefined): void;
}) {
  return (
    <Row label={label}>
      {(id) => (
        <Dropdown<T | ''>
          id={id}
          label={label}
          align="right"
          className="w-full"
          value={value ?? ''}
          options={options}
          onChange={(next) => onChange((next || undefined) as T | undefined)}
        />
      )}
    </Row>
  );
}

function FontToken({
  label,
  hint,
  value,
  unset,
  fonts,
  onChange,
  onAdd,
}: {
  label: string;
  hint?: string;
  value: string | undefined;
  /** What an empty value means, e.g. "Theme default". */
  unset: string;
  fonts: ThemeFont[];
  onChange(value: string | undefined): void;
  onAdd(): void;
}) {
  const t = useT();
  const known = [...FONT_PRESETS.map((f) => f.value), ...fonts.map((f) => f.stack)];
  const options: Array<DropdownOption<string>> = [
    { value: '', label: unset },
    ...(value && !known.includes(value)
      ? [{ value, label: fontName(value, t), detail: t('design.custom') }]
      : []),
    ...FONT_PRESETS.map((f) => ({
      value: f.value,
      label: t(`design.font.${f.key}`),
      group: t('fonts.system'),
    })),
    ...fonts.map((f) => ({
      value: f.stack,
      label: f.family,
      detail: formatBytes(f.bytes, t.locale),
      group: t('fonts.inThisTheme'),
    })),
    { value: ADD_FONT, label: t('fonts.addFromGoogle'), icon: <Plus aria-hidden /> },
  ];
  return (
    <Row label={label} hint={hint}>
      {(id) => (
        <Dropdown<string>
          id={id}
          label={label}
          align="right"
          className="w-full"
          value={value ?? ''}
          options={options}
          onChange={(next) => (next === ADD_FONT ? onAdd() : onChange(next || undefined))}
        />
      )}
    </Row>
  );
}

function ThemeFonts({ fonts, onAdd }: { fonts: ThemeFont[]; onAdd(): void }) {
  const t = useT();
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      {fonts.length > 0 && (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {fonts.map((f) => (
            <li key={f.css} className="flex items-baseline gap-2 px-3 py-2">
              <span className="truncate text-[12.5px] font-medium">{f.family}</span>
              <span
                className="ml-auto shrink-0 font-mono text-[10.5px] text-zinc-400 tabular-nums"
                title={f.css}
              >
                {t.n('fonts.files', f.files)} · {formatBytes(f.bytes, t.locale)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div
        className={cx(
          'px-3 py-2.5',
          fonts.length > 0 && 'border-t border-zinc-200 dark:border-zinc-800',
        )}
      >
        <p className="text-[11.5px] leading-relaxed text-zinc-500">{t('fonts.selfHosted')}</p>
        <Button className="mt-2" onClick={onAdd}>
          <Plus aria-hidden />
          {t('fonts.addFromGoogle')}
        </Button>
      </div>
    </div>
  );
}

function ColorToken({
  name,
  value,
  fallback,
  onChange,
}: {
  name: ThemeColorKey;
  value: string | undefined;
  fallback: string;
  onChange(value: string | undefined): void;
}) {
  const t = useT();
  const label = t(`color.${name}`);
  const hint = t(`color.${name}.hint`);
  const shown = value || fallback;
  const rgb = parseColor(shown);
  return (
    <Row label={label} hint={hint}>
      {(id) => (
        <>
          <span
            className="relative size-8 shrink-0 overflow-hidden rounded-md border border-zinc-200 shadow-[inset_0_0_0_1px_rgb(0_0_0/0.04)] dark:border-zinc-700"
            style={{ background: shown }}
          >
            <input
              type="color"
              aria-label={t('design.colorPicker', { label })}
              disabled={!rgb}
              value={rgb ? toHex(rgb) : '#000000'}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
            />
          </span>
          <input
            id={id}
            className={cx(INPUT, 'font-mono')}
            value={value ?? ''}
            placeholder={fallback}
            spellCheck={false}
            onChange={(e) => onChange(e.target.value || undefined)}
          />
          <button
            type="button"
            aria-label={t('design.resetColor', { label })}
            title={t('design.useDefault')}
            disabled={!value}
            onClick={() => onChange(undefined)}
            className="focus-ring grid size-7 shrink-0 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:invisible dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Undo2 className="size-3.5" aria-hidden />
          </button>
        </>
      )}
    </Row>
  );
}

export function ContrastList({ tokens, scheme }: { tokens: Theme; scheme: Palette }) {
  const t = useT();
  const report = useMemo(() => contrastReport(tokens), [tokens]);
  const palette =
    report.palettes.find((p) => p.scheme === scheme) ??
    (report.palettes[0] as (typeof report.palettes)[0]);
  const failing = palette.rows.filter((r) => !r.ok).length;
  return (
    <details
      className="group rounded-lg border border-zinc-200 dark:border-zinc-800"
      open={failing > 0}
    >
      <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium">
        {failing ? (
          <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />
        ) : (
          <Check className="size-3.5 text-emerald-500" aria-hidden />
        )}
        {t('contrast.title', { scheme: t(`appearance.${palette.scheme}`) })}
        <span className="ml-auto text-[11.5px] font-normal text-zinc-500 tabular-nums">
          {failing ? t.n('contrast.failing', failing) : t('contrast.allPass')}
        </span>
      </summary>
      <ul className="space-y-1 border-t border-zinc-200 px-3 py-2 dark:border-zinc-800">
        {palette.rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="grid h-5 w-7 shrink-0 place-items-center rounded text-[10px] font-semibold"
              style={{ background: row.bg, color: row.fg }}
              aria-hidden
            >
              Aa
            </span>
            <span
              className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-400"
              title={row.label}
            >
              {contrastLabel(t, row.label)}
            </span>
            <span
              className={cx(
                'font-mono tabular-nums',
                row.ok ? 'text-zinc-500' : 'font-semibold text-red-600 dark:text-red-400',
              )}
            >
              {row.ratio === null ? '—' : `${row.ratio.toFixed(2)}:1`}
            </span>
            <span className="w-9 text-right font-mono text-[10.5px] text-zinc-400">≥{row.min}</span>
          </li>
        ))}
      </ul>
      {report.warnings.map((w) => (
        <p
          key={w}
          className="border-t border-zinc-200 px-3 py-2 text-[11.5px] leading-relaxed text-amber-700 dark:border-zinc-800 dark:text-amber-400"
        >
          {w.startsWith('Sets `colors` but no `dark`') ? t('contrast.noDarkWarning') : w}
        </p>
      ))}
    </details>
  );
}

export function DesignPanel({
  detail,
  draft,
  onDraft,
  onFontsChanged,
}: {
  detail: ThemeDetail;
  draft: ThemeTokens | null;
  onDraft(draft: ThemeTokens | null): void;
  /** A font was downloaded into the theme. */
  onFontsChanged(): void;
}) {
  const t = useT();
  const saved = detail.tokens;
  const tokens = draft ?? saved;
  const patch = useMemo(() => diffTokens(saved, tokens), [saved, tokens]);
  const dirty = !isEmptyPatch(patch);
  const [palette, setPalette] = useState<Palette>('light');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string }>();
  // Which token the font picker fills in; `null` only adds the font to the theme.
  const [picking, setPicking] = useState<FontKey | null | undefined>(undefined);

  // Once the saved file reloads, a draft that matches it is no longer a draft.
  useEffect(() => {
    if (draft && isEmptyPatch(diffTokens(saved, draft))) onDraft(null);
  }, [saved, draft, onDraft]);

  useEffect(() => {
    if (message?.tone !== 'ok') return;
    const timer = setTimeout(() => setMessage(undefined), 2400);
    return () => clearTimeout(timer);
  }, [message]);

  const forced = tokens.colorScheme;
  const showDark = !forced && tokens.dark !== false;
  const active: Palette = forced ? forced : showDark ? palette : 'light';

  const set = (next: Partial<ThemeTokens>) => onDraft({ ...tokens, ...next });
  const setColor = (key: ThemeColorKey, value: string | undefined) => {
    if (active === 'dark' && !forced) set({ dark: withColor(tokens.dark || {}, key, value) });
    else set({ colors: withColor(tokens.colors ?? {}, key, value) });
  };

  // What each color falls back to when unset, mirroring the runtime cascade.
  const fallbacks: Required<ThemeColors> =
    active === 'dark'
      ? { ...DEFAULT_COLORS.dark, ...(forced ? {} : clean(tokens.colors)) }
      : DEFAULT_COLORS.light;
  const values: ThemeColors =
    active === 'dark' && !forced ? tokens.dark || {} : (tokens.colors ?? {});
  // Quick tweaks edit the main palette: light, or the only one when the scheme is forced.
  const quickFallbacks = forced === 'dark' ? DEFAULT_COLORS.dark : DEFAULT_COLORS.light;

  const fontPicked = (font: ThemeFont, added: boolean) => {
    if (picking === 'font') set({ font: font.stack });
    else if (picking === 'headingFont') set({ headingFont: font.stack });
    setPicking(undefined);
    if (added) {
      onFontsChanged();
      setMessage({
        tone: 'ok',
        text: t('fonts.added', { family: font.family, size: formatBytes(font.bytes, t.locale) }),
      });
    }
  };

  const save = async () => {
    setSaving(true);
    setMessage(undefined);
    try {
      await saveThemeTokens(detail.id, patch);
      setMessage({ tone: 'ok', text: t('design.saved', { file: detail.file }) });
    } catch (err) {
      setMessage({
        tone: 'error',
        text: err instanceof ApiError || err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <AskAgent detail={detail} />

      <Section title={t('design.quick')}>
        <ColorToken
          name="primary"
          value={tokens.colors?.primary}
          fallback={quickFallbacks.primary}
          onChange={(v) => set({ colors: withColor(tokens.colors ?? {}, 'primary', v) })}
        />
        <ColorToken
          name="background"
          value={tokens.colors?.background}
          fallback={quickFallbacks.background}
          onChange={(v) => set({ colors: withColor(tokens.colors ?? {}, 'background', v) })}
        />
        <FontToken
          label={t('design.bodyFont')}
          value={tokens.font}
          unset={t('design.themeDefault')}
          fonts={detail.fonts}
          onChange={(font) => set({ font })}
          onAdd={() => setPicking('font')}
        />
        <FontToken
          label={t('design.headingFont')}
          value={tokens.headingFont}
          unset={t('design.sameAsBody')}
          fonts={detail.fonts}
          onChange={(headingFont) => set({ headingFont })}
          onAdd={() => setPicking('headingFont')}
        />
        <SelectToken
          label={t('design.radius')}
          value={tokens.radius}
          options={[
            { value: '', label: t('design.themeDefault') },
            ...RADIUS_PRESETS.map((r) => ({ value: r, label: r })),
            ...(tokens.radius && !RADIUS_PRESETS.includes(tokens.radius)
              ? [{ value: tokens.radius, label: tokens.radius }]
              : []),
          ]}
          onChange={(radius) => set({ radius })}
        />
        <SelectToken
          label={t('themes.colorScheme')}
          value={tokens.colorScheme}
          options={[
            { value: '', label: t('design.followSystem') },
            { value: 'light', label: t('themes.alwaysScheme', { scheme: t('appearance.light') }) },
            { value: 'dark', label: t('themes.alwaysScheme', { scheme: t('appearance.dark') }) },
          ]}
          onChange={(colorScheme) => set({ colorScheme })}
        />
        <ContrastList tokens={tokens} scheme={forced ?? 'light'} />
      </Section>

      <details className="group/all border-b border-zinc-200 dark:border-zinc-800">
        <summary className="focus-ring flex cursor-pointer list-none items-center gap-2 rounded-md py-3 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
          <ChevronRight
            className="size-3.5 transition-transform group-open/all:rotate-90"
            aria-hidden
          />
          {t('design.allTokens')}
          <span className="ml-auto font-normal tracking-normal normal-case">
            {t('design.allTokensHint')}
          </span>
        </summary>
        <Section
          title={t('design.colors')}
          aside={
            forced ? (
              <span className="text-[11px] text-zinc-500">
                {t('themes.alwaysScheme', { scheme: t(`appearance.${forced}`) })}
              </span>
            ) : showDark ? (
              <fieldset className="inline-flex rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800/70">
                <legend className="sr-only">{t('design.palette')}</legend>
                {(['light', 'dark'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-pressed={active === p}
                    onClick={() => setPalette(p)}
                    className={cx(
                      'focus-ring h-6 rounded px-2 text-[11.5px] font-medium',
                      active === p
                        ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100'
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200',
                    )}
                  >
                    {t(`appearance.${p}`)}
                  </button>
                ))}
              </fieldset>
            ) : (
              <span className="text-[11px] text-zinc-500">{t('design.lightOnly')}</span>
            )
          }
        >
          {active === 'dark' && !forced && !tokens.dark && (
            <p className="text-[11.5px] leading-relaxed text-zinc-500">
              {t('design.noDarkPalette')}
            </p>
          )}
          {THEME_COLOR_KEYS.map((key) => (
            <ColorToken
              key={`${active}-${key}`}
              name={key}
              value={values[key]}
              fallback={fallbacks[key]}
              onChange={(v) => setColor(key, v)}
            />
          ))}
          <ContrastList tokens={tokens} scheme={active} />
        </Section>

        <Section title={t('appearance.label')}>
          {!forced && (
            <SelectToken
              label={t('design.darkMode')}
              value={tokens.dark === false ? 'off' : tokens.dark ? 'custom' : undefined}
              options={[
                { value: '', label: t('design.darkInherit') },
                { value: 'custom', label: t('design.darkCustom') },
                { value: 'off', label: t('design.darkOff') },
              ]}
              onChange={(mode) => {
                if (mode === 'off') set({ dark: false });
                else if (mode === 'custom') {
                  set({ dark: tokens.dark || {} });
                  setPalette('dark');
                } else set({ dark: undefined });
              }}
            />
          )}
        </Section>

        <Section title={t('design.type')}>
          <TextToken
            label={t('design.bodyFont')}
            value={tokens.font}
            placeholder="system-ui, sans-serif"
            onChange={(font) => set({ font })}
          />
          <TextToken
            label={t('design.headingFont')}
            hint={t('design.headingFontHint')}
            value={tokens.headingFont}
            placeholder={tokens.font || t('design.sameAsBody')}
            onChange={(headingFont) => set({ headingFont })}
          />
          <ThemeFonts fonts={detail.fonts} onAdd={() => setPicking(null)} />
        </Section>

        <Section title={t('design.shape')}>
          <TextToken
            label={t('design.radius')}
            hint={t('design.radiusHint')}
            value={tokens.radius}
            placeholder="10px"
            onChange={(radius) => set({ radius })}
          />
          <TextToken
            label={t('design.buttonRadius')}
            hint={t('design.buttonRadiusHint')}
            value={tokens.buttonRadius}
            placeholder={tokens.radius || t('design.sameAsRadius')}
            onChange={(buttonRadius) => set({ buttonRadius })}
          />
          <TextToken
            label={t('design.width')}
            hint={t('design.widthHint')}
            value={tokens.width}
            placeholder="640px"
            onChange={(width) => set({ width })}
          />
          <SelectToken
            label={t('design.spacing')}
            value={tokens.spacing}
            options={[
              { value: '', label: t('design.spacingDefault') },
              { value: 'compact', label: t('design.compact') },
              { value: 'comfortable', label: t('design.comfortable') },
              { value: 'spacious', label: t('design.spacious') },
            ]}
            onChange={(spacing) => set({ spacing })}
          />
          <SelectToken
            label={t('design.frame')}
            value={tokens.layout}
            options={[
              { value: '', label: t('design.frameDefault') },
              { value: 'card', label: t('design.frameCard') },
              { value: 'plain', label: t('design.framePlain') },
            ]}
            onChange={(layout) => set({ layout })}
          />
        </Section>
      </details>

      {picking !== undefined && (
        <FontPicker
          themeId={detail.id}
          folder={`${detail.file.replace(/[^/]*$/, '')}fonts/`}
          installed={detail.fonts}
          onPicked={fontPicked}
          onClose={() => setPicking(undefined)}
        />
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save} disabled={!dirty || saving}>
            <Save aria-hidden />
            {saving ? t('design.saving') : t('design.save')}
          </Button>
          <Button variant="ghost" onClick={() => onDraft(null)} disabled={!dirty || saving}>
            <RotateCcw aria-hidden />
            {t('design.reset')}
          </Button>
          <span
            role="status"
            className={cx(
              'ml-auto min-w-0 truncate text-[11.5px]',
              message?.tone === 'error' ? 'text-red-600 dark:text-red-400' : 'text-zinc-500',
            )}
            title={message?.text}
          >
            {message?.text ?? (dirty ? t.n('design.unsaved', countChanges(patch)) : '')}
          </span>
        </div>
      </div>
    </div>
  );
}

// Drop the key rather than store `undefined`: palettes are merged by spreading.
function withColor(
  colors: ThemeColors,
  key: ThemeColorKey,
  value: string | undefined,
): ThemeColors {
  const next = { ...colors };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

function clean(colors: ThemeColors | undefined): ThemeColors {
  return Object.fromEntries(Object.entries(colors ?? {}).filter(([, v]) => v)) as ThemeColors;
}

function countChanges(patch: ReturnType<typeof diffTokens>): number {
  let n = 0;
  for (const [key, value] of Object.entries(patch)) {
    n +=
      key === 'colors' || (key === 'dark' && value && typeof value === 'object')
        ? Object.keys(value as object).length
        : 1;
  }
  return n;
}

/** The main way to change a theme: say what you want and hand it to your agent. */
function AskAgent({ detail }: { detail: ThemeDetail }) {
  const t = useT();
  const [request, setRequest] = useState('');
  const [copied, setCopied] = useState(false);
  const id = useId();

  const copy = async () => {
    const prompt = t('design.agentPrompt', {
      id: detail.id,
      file: detail.file,
      request: request.trim(),
    });
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="mb-2 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
      <label htmlFor={id} className="text-[12.5px] font-medium text-zinc-800 dark:text-zinc-200">
        {t('design.askTitle')}
      </label>
      <p className="mt-0.5 text-[11.5px] leading-relaxed text-zinc-500">{t('design.askHint')}</p>
      <textarea
        id={id}
        rows={2}
        value={request}
        onChange={(e) => setRequest(e.target.value)}
        placeholder={t('design.askPlaceholder')}
        className="focus-ring mt-2 w-full resize-none rounded-md border border-zinc-200 bg-white px-2 py-1.5 text-[12.5px] placeholder:text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900"
      />
      <Button className="mt-2" onClick={copy} disabled={!request.trim()}>
        {copied ? <Check /> : <ClipboardCopy />}
        {copied ? t('design.copied') : t('design.copyPrompt')}
      </Button>
    </div>
  );
}
