import appConfig from 'virtual:open-form/config';
import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { reportCurrent } from '../lib/forms.ts';
import { CommandPalette, usePaletteShortcut } from './command-palette.tsx';
import { StudioDataProvider } from './data.tsx';
import { FormDetail } from './form-detail.tsx';
import { FormsList } from './forms-list.tsx';
import { I18nProvider, useT } from './i18n.tsx';
import { Preview } from './preview.tsx';
import { Responses } from './responses.tsx';
import { Schema } from './schema.tsx';
import { SessionGate } from './session.tsx';
import { Settings } from './settings.tsx';
import { Sidebar } from './sidebar.tsx';
import { StudioToaster } from './toast.tsx';
import { Skeleton } from './ui.tsx';
import './studio.css';

// Dev-only pages: a separate chunk that production never requests.
const ThemeGallery = lazy(() => import('./themes.tsx').then((m) => ({ default: m.ThemeGallery })));
const ThemeDetailPage = lazy(() =>
  import('./themes.tsx').then((m) => ({ default: m.ThemeDetailPage })),
);

export default function Studio() {
  return (
    <I18nProvider>
      <SessionGate>
        <StudioDataProvider>
          <StudioRoutes />
        </StudioDataProvider>
      </SessionGate>
      <StudioToaster />
    </I18nProvider>
  );
}

function StudioRoutes() {
  return (
    <Routes>
      <Route element={<Shell />}>
        <Route index element={<FormsList />} />
        {/* Theme editing writes to the project, so it only exists under `open-form dev`. */}
        {appConfig.dev && <Route path="themes" element={<ThemeGallery />} />}
        {appConfig.dev && <Route path="themes/:themeId" element={<ThemeDetailPage />} />}
        <Route path=":formId" element={<FormDetail />}>
          <Route index element={<Preview />} />
          <Route path="responses" element={<Responses />} />
          <Route path="responses/:responseId" element={<Responses />} />
          <Route path="schema" element={<Schema />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>
    </Routes>
  );
}

function Shell() {
  const t = useT();
  const location = useLocation();
  const [first, section] = location.pathname.replace(/^\/studio\/?/, '').split('/');
  const inThemes = appConfig.dev && first === 'themes';
  const formId = inThemes ? undefined : first;
  const themeId = inThemes ? section : undefined;

  useEffect(() => {
    reportCurrent({
      formId: formId || null,
      themeId: themeId || null,
      view: inThemes ? 'themes' : !formId ? 'forms' : (section ?? 'preview'),
    });
  }, [formId, themeId, section, inThemes]);

  useEffect(() => {
    const page = formId || themeId || (inThemes ? t('nav.themes') : '');
    document.title = page ? `${page} · Open Form Studio` : 'Open Form Studio';
  }, [formId, themeId, inThemes, t]);

  const [palette, setPalette] = useState(false);
  const togglePalette = useCallback(() => setPalette((open) => !open), []);
  usePaletteShortcut(togglePalette);

  return (
    <div className="min-h-dvh bg-zinc-100/70 lg:flex dark:bg-zinc-950">
      <Sidebar onSearch={() => setPalette(true)} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      <div className="min-w-0 flex-1 lg:py-2 lg:pr-2">
        <main className="min-h-[calc(100dvh-3.5rem)] bg-white lg:min-h-[calc(100dvh-1rem)] lg:rounded-xl lg:border lg:border-zinc-200/80 lg:shadow-[0_1px_3px_rgb(0_0_0/0.03)] dark:bg-zinc-900/50 dark:lg:border-zinc-800">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-8">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
