import { useEffect, useState } from 'react';
import type { FormTheme } from '../../react/index.ts';
import type { Theme } from '../../schema/index.ts';

// Studio → preview iframe protocol for unsaved design-panel edits.
export const DRAFT_MESSAGE = 'open-form:theme-draft';
export const READY_MESSAGE = 'open-form:preview-ready';

export type ThemeTokens = Omit<Theme, never>;
export type PreviewScheme = 'light' | 'dark' | null;

export function previewScheme(value: string | null): PreviewScheme {
  return value === 'light' || value === 'dark' ? value : null;
}

/** Replace a theme's tokens, keeping its components. */
export function withTokens(theme: FormTheme | undefined, tokens: ThemeTokens): FormTheme {
  return { ...tokens, components: theme?.components };
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

/** The draft channel for a form's own theme, apart from the reference themes' ids. */
export const formDraftKey = (formId: string) => `form:${formId}`;

/** Unsaved tokens sent by the Studio design panel for this theme, if any. */
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
