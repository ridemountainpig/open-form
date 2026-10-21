import { useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FormRuntimeContext } from '../../react/index.ts';
import { pickTokens } from '../../schema/index.ts';
import { previewChannel, reportPreviewNav } from '../lib/preview-channel.ts';
import {
  fontFacesFor,
  forceScheme,
  previewScheme,
  THEME_LOADED_MESSAGE,
  type ThemeLoaded,
} from '../lib/theme-preview.ts';
import { useTheme } from '../lib/themes.ts';
import { SAMPLE_CONFIG, SampleForm } from './sample-form.tsx';
import '../../react/styles.css';
import './public.css';

/** `/theme-preview/:themeId` — the sample form in a theme, for the Studio gallery and theme page. */
export function ThemePreviewPage() {
  const { themeId = '' } = useParams();
  const [params] = useSearchParams();
  const scheme = previewScheme(params.get('scheme'));
  const lang = params.get('lang') ?? undefined;
  // `thumb`: a gallery thumbnail, which nothing steers.
  const embedded = !params.has('thumb') && window.parent !== window;
  const { theme, ready, error } = useTheme(themeId);

  useEffect(() => {
    if (!embedded || !ready) return;
    const message: ThemeLoaded = theme
      ? {
          type: THEME_LOADED_MESSAGE,
          themeId,
          tokens: pickTokens(theme),
          fonts: fontFacesFor([theme.font, theme.headingFont]),
        }
      : { type: THEME_LOADED_MESSAGE, themeId, error: error ?? `No theme "${themeId}".` };
    window.parent.postMessage(message, window.location.origin);
  }, [embedded, ready, theme, error, themeId]);

  const runtime = useMemo(
    () => ({
      mode: 'interactive' as const,
      formId: 'theme-preview',
      config: SAMPLE_CONFIG,
      requestedLocale: lang,
      themeId,
      theme: forceScheme(theme, scheme),
      preview: true,
      onNavigate: embedded ? reportPreviewNav : undefined,
      previewControl: embedded ? previewChannel() : undefined,
    }),
    [themeId, theme, scheme, lang, embedded],
  );

  if (!ready) return <div className="of-host" aria-busy="true" />;
  // A reference that didn't load says so, rather than passing for the built-in look.
  if (error) {
    return (
      <div className="of-host" role="alert">
        <pre className="of-theme-error">{error}</pre>
      </div>
    );
  }
  return (
    <div className="of-host">
      <FormRuntimeContext.Provider value={runtime}>
        <SampleForm />
      </FormRuntimeContext.Provider>
    </div>
  );
}
