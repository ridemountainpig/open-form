import { loadTheme, themeIds } from 'virtual:open-form/themes';
import { useEffect, useState } from 'react';
import type { FormTheme } from '../../react/index.ts';

// The project's themes are references for new forms, shown only in Studio (dev).
// Forms carry their own copy, so nothing here is used to render a form.

export type ThemeState = { theme?: FormTheme; ready: boolean };

type ThemeChanged = { themeId?: string; timestamp?: number };

export function onThemeChanged(handler: (data: ThemeChanged) => void): () => void {
  if (!import.meta.hot) return () => {};
  import.meta.hot.on('open-form:theme-changed', handler);
  return () => import.meta.hot?.off('open-form:theme-changed', handler);
}

/** Loads `themes/<id>` on demand for Studio's previews; unknown ids resolve to the built-in look. */
export function useTheme(id: string | undefined): ThemeState {
  const known = id !== undefined && themeIds.includes(id);
  const [state, setState] = useState<ThemeState & { id?: string }>({ ready: !known });

  useEffect(() => {
    if (!id || !themeIds.includes(id)) {
      setState({ id, ready: true });
      return;
    }
    let cancelled = false;
    setState({ id, ready: false });
    const load = () =>
      loadTheme(id).then(
        (mod) => !cancelled && setState({ id, theme: mod?.default, ready: true }),
        (error: Error) => {
          console.error(`[open-form] Theme "${id}" failed to load:`, error);
          if (!cancelled) setState({ id, ready: true });
        },
      );
    void load();
    const off = onThemeChanged((data) => {
      if (data.themeId === id) void load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [id]);

  return state.id === id ? state : { ready: !known };
}
