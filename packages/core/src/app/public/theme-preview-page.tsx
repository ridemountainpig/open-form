import { useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { FormRuntimeContext } from '../../react/index.ts';
import { previewChannel, reportPreviewNav } from '../lib/preview-channel.ts';
import { forceScheme, previewScheme, useThemeDraft, withTokens } from '../lib/theme-preview.ts';
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
  const { theme, ready } = useTheme(themeId);
  const draft = useThemeDraft(themeId);

  const runtime = useMemo(
    () => ({
      mode: 'interactive' as const,
      formId: 'theme-preview',
      config: SAMPLE_CONFIG,
      requestedLocale: lang,
      themeId,
      theme: forceScheme(draft ? withTokens(theme, draft) : theme, scheme),
      preview: true,
      onNavigate: embedded ? reportPreviewNav : undefined,
      previewControl: embedded ? previewChannel() : undefined,
    }),
    [themeId, theme, draft, scheme, lang, embedded],
  );

  if (!ready) return <div className="of-host" aria-busy="true" />;
  return (
    <div className="of-host">
      <FormRuntimeContext.Provider value={runtime}>
        <SampleForm />
      </FormRuntimeContext.Provider>
    </div>
  );
}
