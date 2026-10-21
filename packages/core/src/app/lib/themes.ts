import { loadTheme, type ThemeInfo, themes } from 'virtual:open-form/themes';
import { useEffect, useState, useSyncExternalStore } from 'react';
import type { FormTheme } from '../../react/index.ts';

// The project's themes are references for new forms, shown read-only in Studio's
// Themes pages. Forms carry their own copy, so nothing here is used to render a form.

export type { ThemeInfo };

export type ThemeState = { theme?: FormTheme; ready: boolean; error?: string };

type ThemeChanged = { themeId?: string; timestamp?: number; info?: ThemeInfo };

export function onThemeChanged(handler: (data: ThemeChanged) => void): () => void {
  if (!import.meta.hot) return () => {};
  import.meta.hot.on('open-form:theme-changed', handler);
  return () => import.meta.hot?.off('open-form:theme-changed', handler);
}

let catalog: readonly ThemeInfo[] = themes;
const listeners = new Set<() => void>();

onThemeChanged(({ info }) => {
  if (!info) return;
  catalog = catalog.map((theme) => (theme.id === info.id ? info : theme));
  for (const listener of listeners) listener();
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The project's themes, with each THEME.md kept current under dev. */
export function useThemeCatalog(): readonly ThemeInfo[] {
  return useSyncExternalStore(subscribe, () => catalog);
}

const isTheme = (id: string | undefined): id is string =>
  id !== undefined && catalog.some((theme) => theme.id === id);

/** Loads `themes/<id>` on demand; unknown ids resolve to the built-in look. */
export function useTheme(id: string | undefined): ThemeState {
  const known = isTheme(id);
  const [state, setState] = useState<ThemeState & { id?: string }>({ ready: !known });

  useEffect(() => {
    if (!isTheme(id)) {
      setState({ id, ready: true });
      return;
    }
    let cancelled = false;
    setState({ id, ready: false });
    const load = () =>
      loadTheme(id).then(
        (mod) => {
          if (cancelled) return;
          if (mod?.default) setState({ id, theme: mod.default, ready: true });
          else setState({ id, ready: true, error: 'It has no default export (defineTheme(...)).' });
        },
        (error: Error) => {
          console.error(`[open-form] Theme "${id}" failed to load:`, error);
          if (!cancelled) setState({ id, ready: true, error: error.message });
        },
      );
    void load();
    const off = onThemeChanged((data) => {
      if (data.themeId === id && !data.info) void load();
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [id]);

  return state.id === id ? state : { ready: !known };
}
