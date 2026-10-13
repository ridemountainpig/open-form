export type ThemeColors = {
  primary?: string;
  primaryForeground?: string;
  /** Page background behind the form card. */
  background?: string;
  /** The form card itself. */
  surface?: string;
  foreground?: string;
  muted?: string;
  /** Decorative edges: the card, dividers, choice tiles. */
  border?: string;
  /** Outlines that identify a control: inputs, checkboxes, radios, ratings. Keep ≥ 3:1 against `input`. */
  control?: string;
  /** Background of text inputs, selects and choice tiles. */
  input?: string;
  error?: string;
  success?: string;
};

export type Theme = {
  font?: string;
  headingFont?: string;
  /** Corner radius for inputs, tiles and buttons, e.g. `'12px'`. */
  radius?: string;
  /** Buttons only, e.g. `'999px'` for pills. Defaults to `radius`. */
  buttonRadius?: string;
  spacing?: 'compact' | 'comfortable' | 'spacious';
  /** Maximum width of the form, e.g. `'640px'`. */
  width?: string;
  /** `'card'` floats the form on a background; `'plain'` renders it flat. */
  layout?: 'card' | 'plain';
  colors?: ThemeColors;
  /** Colors used when the respondent prefers dark mode. `false` keeps light colors. */
  dark?: ThemeColors | false;
  /**
   * Force one appearance regardless of the respondent's system setting —
   * e.g. a dark-only brand. `colors` is then the only palette; `dark` is ignored.
   */
  colorScheme?: 'light' | 'dark';
};

const COLOR_VARS: Record<keyof ThemeColors, string> = {
  primary: '--of-primary',
  primaryForeground: '--of-primary-fg',
  background: '--of-bg',
  surface: '--of-surface',
  foreground: '--of-fg',
  muted: '--of-muted',
  border: '--of-border',
  control: '--of-control',
  input: '--of-input',
  error: '--of-error',
  success: '--of-success',
};

const SPACING: Record<NonNullable<Theme['spacing']>, string> = {
  compact: '16px',
  comfortable: '24px',
  spacious: '32px',
};

function colorDecls(colors: ThemeColors | undefined): string[] {
  if (!colors) return [];
  return (Object.keys(COLOR_VARS) as Array<keyof ThemeColors>)
    .filter((key) => colors[key])
    .map((key) => `${COLOR_VARS[key]}:${colors[key]}`);
}

// Values come from repo-authored theme files, but strip characters that could
// close the declaration block so a typo can't leak into neighbouring rules.
function safe(value: string): string {
  return value.replace(/[{}<>;]/g, '');
}

/** Scoped CSS for a theme. The runtime injects it next to the form root. */
export function themeToCss(theme: Theme | undefined, selector: string): string {
  if (!theme) return '';
  const decls: string[] = [];
  if (theme.font) decls.push(`--of-font:${theme.font}`);
  if (theme.headingFont) decls.push(`--of-heading-font:${theme.headingFont}`);
  if (theme.radius) decls.push(`--of-radius:${theme.radius}`);
  if (theme.buttonRadius) decls.push(`--of-button-radius:${theme.buttonRadius}`);
  if (theme.spacing) decls.push(`--of-gap:${SPACING[theme.spacing]}`);
  if (theme.width) decls.push(`--of-width:${theme.width}`);
  decls.push(...colorDecls(theme.colors));

  let css = decls.length ? `${selector}{${decls.map(safe).join(';')}}` : '';
  if (theme.colorScheme) {
    css += `${selector}{color-scheme:${theme.colorScheme}}`;
  } else if (theme.dark === false) {
    css += `${selector}{color-scheme:light}`;
  } else {
    const dark = colorDecls(theme.dark);
    if (dark.length) {
      css += `@media (prefers-color-scheme: dark){${selector}{${dark.map(safe).join(';')}}}`;
    }
  }
  return css;
}

/** The plain look's palette (what the `classic` starter spells out), for tooling that needs concrete defaults. */
export const DEFAULT_COLORS: { light: Required<ThemeColors>; dark: Required<ThemeColors> } = {
  light: {
    primary: '#4f46e5',
    primaryForeground: '#ffffff',
    background: '#f4f4f6',
    surface: '#ffffff',
    foreground: '#18181b',
    muted: '#6b6b76',
    border: '#e2e2e7',
    control: '#93939b',
    input: '#ffffff',
    error: '#d92d20',
    success: '#16a34a',
  },
  dark: {
    primary: '#8b8cf8',
    primaryForeground: '#0b0b12',
    background: '#0b0b0e',
    surface: '#141418',
    foreground: '#f4f4f5',
    muted: '#a0a0ab',
    border: '#2a2a31',
    control: '#64646f',
    input: '#0f0f13',
    error: '#f97066',
    success: '#4ade80',
  },
};
