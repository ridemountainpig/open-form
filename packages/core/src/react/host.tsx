import { type ComponentType, useEffect, useMemo, useState } from 'react';
import { type FormConfig, getMessages, type Locale } from '../schema/index.ts';
import { type FormAvailability, type FormRuntime, RuntimeContext } from './context.ts';
import type { FormTheme } from './theme.ts';
import { visitorHeaders } from './visitor.ts';

export type FormHostProps = {
  /** The form id: its folder name in `forms/`. */
  id: string;
  /** The form's default export. */
  form: ComponentType;
  /** The form's `config` export. */
  config?: FormConfig;
  /** A look for forms that don't bring their own; a form's `<Form theme>` wins. */
  theme?: FormTheme;
  /** Scopes the theme's CSS. Default `'custom'` when a theme is given. */
  themeId?: string;
  /** Where the Open Form API is mounted: `/api`, or another origin's `https://forms.example.com/api`. */
  api?: string;
  /** The project's default language, for forms that don't set `locale`. */
  locale?: Locale;
  className?: string;
};

type Info = { availability: FormAvailability; token?: string; turnstile?: { siteKey: string } };

/**
 * Renders an Open Form form inside your own React app (Next.js, Remix, …)
 * against a mounted Open Form API: it fetches the form's availability and
 * timing token, then submits to `<api>/forms/<id>/submissions`.
 */
export function FormHost({
  id,
  form: Form,
  config,
  theme,
  themeId,
  api = '/api',
  locale,
  className,
}: FormHostProps) {
  const [info, setInfo] = useState<Info | null>(null);
  const [failed, setFailed] = useState(false);
  const base = `${api.replace(/\/$/, '')}/forms/${encodeURIComponent(id)}`;

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    fetch(base, { credentials: 'same-origin', headers: visitorHeaders() })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 404) return setInfo({ availability: { state: 'not-found' } });
        if (!res.ok) throw new Error(res.statusText);
        setInfo((await res.json()) as Info);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [base]);

  const runtime = useMemo<FormRuntime>(
    () => ({
      mode: 'interactive',
      formId: id,
      config,
      theme,
      themeId: themeId ?? (theme ? 'custom' : undefined),
      locale,
      endpoint: `${base}/submissions`,
      availability: info?.availability,
      token: info?.token,
      turnstile: info?.turnstile,
    }),
    [base, config, id, info, locale, theme, themeId],
  );

  const host = ['of-host', className].filter(Boolean).join(' ');
  if (failed) {
    return (
      <div className={host} role="alert">
        {getMessages(config?.locale ?? locale ?? 'en').networkError}
      </div>
    );
  }
  if (!info) return <div className={host} aria-busy="true" />;
  return (
    <div className={host}>
      <RuntimeContext.Provider value={runtime}>
        <Form />
      </RuntimeContext.Provider>
    </div>
  );
}
