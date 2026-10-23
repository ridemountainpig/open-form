import { contrast, parseColor, toHex } from './color.ts';
import { DEFAULT_COLORS, type Theme, type ThemeColors } from './theme.ts';

export type ContrastCheck = {
  label: string;
  fg: keyof ThemeColors;
  bg: keyof ThemeColors;
  min: number;
};

// What each pair is used for in the runtime and built-in themes.
export const CONTRAST_CHECKS: ContrastCheck[] = [
  { label: 'text on surface', fg: 'foreground', bg: 'surface', min: 4.5 },
  { label: 'text on background', fg: 'foreground', bg: 'background', min: 4.5 },
  { label: 'answers in inputs', fg: 'foreground', bg: 'input', min: 4.5 },
  { label: 'help text (muted)', fg: 'muted', bg: 'surface', min: 4.5 },
  { label: 'button text', fg: 'primaryForeground', bg: 'primary', min: 4.5 },
  { label: 'errors', fg: 'error', bg: 'surface', min: 4.5 },
  { label: 'control outlines', fg: 'control', bg: 'input', min: 3 },
  { label: 'focus / selection', fg: 'primary', bg: 'surface', min: 3 },
];

export type PaletteReport = {
  scheme: 'light' | 'dark';
  rows: Array<{
    /** The token pair, e.g. `foreground/background`. */
    pair: string;
    label: string;
    fg: string;
    bg: string;
    ratio: number | null;
    min: number;
    ok: boolean;
  }>;
};

/** The colors that actually apply, mirroring the CSS cascade of runtime defaults and theme tokens. */
export function effectivePalettes(
  theme: Theme,
): Array<{ scheme: 'light' | 'dark'; colors: Required<ThemeColors> }> {
  const colors = theme.colors ?? {};
  if (theme.colorScheme) {
    return [
      { scheme: theme.colorScheme, colors: { ...DEFAULT_COLORS[theme.colorScheme], ...colors } },
    ];
  }
  const light = { scheme: 'light' as const, colors: { ...DEFAULT_COLORS.light, ...colors } };
  if (theme.dark === false) return [light];
  // Theme `colors` apply in dark mode too unless `dark` overrides them.
  return [
    light,
    { scheme: 'dark', colors: { ...DEFAULT_COLORS.dark, ...colors, ...(theme.dark ?? {}) } },
  ];
}

export function contrastReport(theme: Theme): { palettes: PaletteReport[]; warnings: string[] } {
  const warnings: string[] = [];
  if (theme.colors && !theme.dark && theme.dark !== false && !theme.colorScheme) {
    warnings.push(
      'Sets `colors` but no `dark`: in dark mode your light colors mix with built-in dark defaults. Add `dark`, or `dark: false` / `colorScheme`.',
    );
  }
  const palettes = effectivePalettes(theme).map(({ scheme, colors }) => ({
    scheme,
    rows: CONTRAST_CHECKS.map((c) => {
      const fg = parseColor(colors[c.fg]);
      const bg = parseColor(colors[c.bg]);
      const ratio = fg && bg ? Math.round(contrast(fg, bg) * 100) / 100 : null;
      return {
        pair: `${c.fg}/${c.bg}`,
        label: `${c.label} (${c.fg} / ${c.bg})`,
        fg: fg ? toHex(fg) : colors[c.fg],
        bg: bg ? toHex(bg) : colors[c.bg],
        ratio,
        min: c.min,
        ok: ratio !== null && ratio >= c.min,
      };
    }),
  }));
  return { palettes, warnings };
}
