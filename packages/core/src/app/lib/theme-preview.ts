import { useEffect, useState } from 'react';
import type { FormTheme } from '../../react/index.ts';
import type { pickTokens, Theme } from '../../schema/index.ts';

// Studio → preview iframe protocol for unsaved edits in a form's Adjust panel.
export const DRAFT_MESSAGE = 'open-form:theme-draft';
export const READY_MESSAGE = 'open-form:preview-ready';

export type ThemeTokens = Omit<Theme, never>;
export type PreviewScheme = 'light' | 'dark' | null;

export function previewScheme(value: string | null): PreviewScheme {
  return value === 'light' || value === 'dark' ? value : null;
}

/** Show a theme in one scheme regardless of the viewer's system setting. */
export function forceScheme(
  theme: FormTheme | undefined,
  scheme: PreviewScheme,
): FormTheme | undefined {
  if (!scheme || theme?.colorScheme) return theme;
  if (scheme === 'light' || theme?.dark === false) return { ...theme, colorScheme: 'light' };
  // Mirror the cascade: built-in dark defaults ← theme colors ← theme dark.
  return { ...theme, colorScheme: 'dark', colors: { ...theme?.colors, ...(theme?.dark || {}) } };
}

/** The draft channel for a form's own theme. */
export const formDraftKey = (formId: string) => `form:${formId}`;

/** Unsaved tokens sent by the Studio design panel for this look, if any. */
export function useThemeDraft(themeId: string | undefined): ThemeTokens | null {
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
  useEffect(() => {
    if (!themeId || window.parent === window) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; themeId?: string; tokens?: ThemeTokens | null };
      if (data?.type === DRAFT_MESSAGE && data.themeId === themeId) setDraft(data.tokens ?? null);
    };
    window.addEventListener('message', onMessage);
    window.parent.postMessage({ type: READY_MESSAGE, themeId }, window.location.origin);
    return () => window.removeEventListener('message', onMessage);
  }, [themeId]);
  return draft;
}

// Preview iframe → Studio's theme page: the loaded reference's tokens and web
// fonts, or why it didn't load. Studio never imports a reference itself, so its
// CSS and @font-face rules stay out of Studio's document.
export const THEME_LOADED_MESSAGE = 'open-form:theme-loaded';

export type ThemeFontFace = { family: string; src: string; descriptors: FontFaceDescriptors };

export type ThemeLoaded = { type: typeof THEME_LOADED_MESSAGE; themeId: string } & (
  | { tokens: ReturnType<typeof pickTokens>; fonts: ThemeFontFace[] }
  | { error: string }
);

export function stackFamilies(stack: string | undefined): string[] {
  return (stack ?? '')
    .split(',')
    .map((family) => family.trim().replace(/^["']|["']$/g, ''))
    .filter(Boolean);
}

const DESCRIPTORS = {
  weight: 'font-weight',
  style: 'font-style',
  stretch: 'font-stretch',
  unicodeRange: 'unicode-range',
  display: 'font-display',
} as const;

/** This document's @font-face rules for the given font stacks, with absolute URLs. */
export function fontFacesFor(stacks: Array<string | undefined>): ThemeFontFace[] {
  const wanted = new Set(stacks.flatMap(stackFamilies).map((f) => f.toLowerCase()));
  const faces: ThemeFontFace[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    const base = sheet.href ?? document.baseURI;
    for (const rule of Array.from(rules)) {
      if (!(rule instanceof CSSFontFaceRule)) continue;
      const [family] = stackFamilies(rule.style.getPropertyValue('font-family'));
      if (!family || !wanted.has(family.toLowerCase())) continue;
      const src = rule.style
        .getPropertyValue('src')
        .replace(
          /url\((["']?)([^"')]+)\1\)/g,
          (_, _quote: string, url: string) => `url("${new URL(url, base).href}")`,
        );
      const descriptors: Record<string, string> = {};
      for (const [key, property] of Object.entries(DESCRIPTORS)) {
        const value = rule.style.getPropertyValue(property).trim();
        if (value) descriptors[key] = value;
      }
      faces.push({ family, src, descriptors: descriptors as FontFaceDescriptors });
    }
  }
  return faces;
}
