import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PublicFormPage } from './public/form-page.tsx';
import { NotFound } from './public/not-found.tsx';

const Studio = lazy(() => import('./studio/studio.tsx'));
// Themes are references shown in Studio's read-only Themes pages.
const ThemePreviewPage = lazy(() =>
  import('./public/theme-preview-page.tsx').then((m) => ({ default: m.ThemePreviewPage })),
);

function StudioLoading() {
  return (
    <div
      aria-busy="true"
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        font: '13px system-ui',
        color: '#71717a',
      }}
    >
      Loading Studio…
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/f/:formId" element={<PublicFormPage />} />
        <Route
          path="/theme-preview/:themeId"
          element={
            <Suspense fallback={null}>
              <ThemePreviewPage />
            </Suspense>
          }
        />
        <Route
          path="/studio/*"
          element={
            <Suspense fallback={<StudioLoading />}>
              <Studio />
            </Suspense>
          }
        />
        <Route path="/" element={<Navigate to="/studio" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
