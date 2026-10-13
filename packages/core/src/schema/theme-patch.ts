import type { Theme, ThemeColors } from './theme.ts';

// The serializable half of a theme — what the Studio design panel edits and
// writes back to source. Components and CSS stay hand-written.

export const THEME_TOKEN_KEYS = [
  'font',
  'headingFont',
  'radius',
  'buttonRadius',
  'spacing',
  'width',
  'layout',
  'colorScheme',
] as const;

export const THEME_COLOR_KEYS = [
  'primary',
  'primaryForeground',
  'background',
  'surface',
  'foreground',
  'muted',
  'border',
  'control',
  'input',
  'error',
  'success',
] as const satisfies ReadonlyArray<keyof ThemeColors>;

export type ThemeTokenKey = (typeof THEME_TOKEN_KEYS)[number];
export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

/** `null` removes a token (falls back to the default). */
export type ThemePatch = { [K in ThemeTokenKey]?: string | null } & {
  colors?: { [K in ThemeColorKey]?: string | null };
  dark?: false | null | { [K in ThemeColorKey]?: string | null };
};

export type ThemeTokens = Pick<Theme, ThemeTokenKey | 'colors' | 'dark'>;

export function pickTokens(theme: Theme): ThemeTokens {
  const out: ThemeTokens = {};
  for (const key of THEME_TOKEN_KEYS) {
    if (typeof theme[key] === 'string') (out as Record<string, unknown>)[key] = theme[key];
  }
  if (theme.colors) out.colors = { ...theme.colors };
  if (theme.dark === false) out.dark = false;
  else if (theme.dark) out.dark = { ...theme.dark };
  return out;
}

function diffColors(
  base: ThemeColors | undefined,
  next: ThemeColors | undefined,
): Partial<Record<ThemeColorKey, string | null>> | undefined {
  const out: Partial<Record<ThemeColorKey, string | null>> = {};
  for (const key of THEME_COLOR_KEYS) {
    const a = base?.[key] || undefined;
    const b = next?.[key] || undefined;
    if (a !== b) out[key] = b ?? null;
  }
  return Object.keys(out).length ? out : undefined;
}

/** The patch that turns `base` into `next`; empty when they match. Empty strings count as unset. */
export function diffTokens(base: ThemeTokens, next: ThemeTokens): ThemePatch {
  const patch: ThemePatch = {};
  for (const key of THEME_TOKEN_KEYS) {
    const a = base[key] || undefined;
    const b = next[key] || undefined;
    if (a !== b) (patch as Record<string, unknown>)[key] = b ?? null;
  }
  const colors = diffColors(base.colors, next.colors);
  if (colors) patch.colors = colors;
  if (next.dark === false) {
    if (base.dark !== false) patch.dark = false;
  } else if (next.dark === undefined) {
    if (base.dark !== undefined) patch.dark = null;
  } else {
    const dark = diffColors(base.dark || undefined, next.dark);
    if (dark) patch.dark = dark;
    else if (base.dark === false) patch.dark = null;
  }
  return patch;
}

export function isEmptyPatch(patch: ThemePatch): boolean {
  return Object.keys(patch).length === 0;
}
