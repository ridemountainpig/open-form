import appConfig from 'virtual:open-form/config';
import { formIds } from 'virtual:open-form/forms';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  type FormAvailability,
  FormRuntimeContext,
  type NavigationInfo,
} from '../../react/index.ts';
import { visitorHeaders } from '../../react/visitor.ts';
import { getMessages, type Locale, sourceLocale, translate } from '../../schema/index.ts';
import { reportCurrent, useFormModule } from '../lib/forms.ts';
import {
  onInspect,
  previewChannel,
  reportInspectReady,
  reportMissing,
  reportPick,
  reportPreviewNav,
} from '../lib/preview-channel.ts';
import '../../react/styles.css';
import { type Inspector, startInspector } from './inspector.ts';
import './public.css';

type FormInfo = {
  availability: FormAvailability;
  token?: string;
};

// Embedded on another site (`?embed`, see embed.js): only non-personal facts go
// to the parent, so any origin may listen.
const EMBED_RESIZE_MESSAGE = 'open-form:resize';
const EMBED_SUBMITTED_MESSAGE = 'open-form:submitted';

type LoadError = { network?: boolean; detail?: string };

export function PublicFormPage() {
  const { formId = '' } = useParams();
  const [params] = useSearchParams();
  // `thumb`: an inert Studio thumbnail — a preview that doesn't report where the user is.
  const thumb = params.has('thumb');
  const preview = thumb || params.has('preview');
  const known = formIds.includes(formId);
  const { module, error, revision } = useFormModule(known ? formId : undefined);
  const [info, setInfo] = useState<FormInfo | null>(null);
  const [infoError, setInfoError] = useState<LoadError | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: refetch when the form source changes
  useEffect(() => {
    if (!known) return;
    let cancelled = false;
    fetch(`/api/forms/${encodeURIComponent(formId)}`, {
      credentials: 'same-origin',
      headers: visitorHeaders(),
    })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as FormInfo & { message?: string };
        if (cancelled) return;
        if (res.status === 404) {
          setInfo({ availability: { state: 'not-found' } });
        } else if (!res.ok) {
          setInfoError({ detail: body.message });
        } else {
          setInfo(body);
          setInfoError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setInfoError({ network: true });
      });
    return () => {
      cancelled = true;
    };
  }, [formId, known, revision]);

  const config = module?.config;
  const locale = config?.locale ?? appConfig.locale;

  // Screen readers, hyphenation and CJK font fallback all key off the page
  // language; it and the title follow the language the respondent picks.
  const onLocaleChange = useCallback(
    (shown: Locale) => {
      document.documentElement.lang = shown;
      const title = config?.title;
      document.title = title ? translate(config?.translations?.[shown], title) : 'Open Form';
    },
    [config],
  );

  useEffect(() => {
    document.title = config?.title ?? 'Open Form';
  }, [config?.title]);

  // Copy the form's page colors onto <html> for the background and scrollbar.
  useEffect(() => {
    if (!module?.default || !info) return;
    const sync = () => {
      const root = document.querySelector<HTMLElement>('.of-host > .of-root');
      if (!root) return;
      const style = getComputedStyle(root);
      const html = document.documentElement.style;
      html.setProperty('--of-page-bg', style.getPropertyValue('--of-bg').trim());
      html.setProperty('--of-page-fg', style.getPropertyValue('--of-fg').trim());
      html.colorScheme = style.colorScheme;
    };
    const frame = requestAnimationFrame(sync);
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', sync);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener('change', sync);
    };
  }, [module, info]);

  const embedded = preview && !thumb && window.parent !== window;
  // A source change remounts the form; Studio's preview comes back on the same step.
  const lastStep = useRef(0);
  const resumeAt = useRef<number | null>(null);
  const seenRevision = useRef(revision);
  if (seenRevision.current !== revision) {
    seenRevision.current = revision;
    resumeAt.current = lastStep.current;
  }
  const onNavigate = useCallback(
    (nav: NavigationInfo) => {
      if (thumb) return;
      reportCurrent({ formId, view: preview ? 'preview' : 'form', ...nav });
      // Studio's preview toolbar highlights the step being shown.
      if (embedded) {
        lastStep.current = nav.done ? lastStep.current : nav.step;
        reportPreviewNav(nav);
      }
    },
    [embedded, formId, preview, thumb],
  );

  const previewControl = useMemo(
    () =>
      embedded
        ? previewChannel(() => {
            const step = resumeAt.current;
            resumeAt.current = null;
            return step;
          })
        : undefined,
    [embedded],
  );

  // Studio's Edit mode, in dev only: that's when the source locations exist.
  const translations = useRef(config?.translations);
  translations.current = config?.translations;
  useEffect(() => {
    if (!embedded || !appConfig.dev) return;
    // Text is matched to the source in the form's own language.
    const toSource = (text: string) => {
      const table = translations.current?.[document.documentElement.lang as Locale];
      if (table) {
        for (const [key, value] of Object.entries(table)) {
          if (value.replace(/\s+/g, ' ').trim() === text) return key;
        }
      }
      return text;
    };
    let inspector: Inspector | undefined;
    const off = onInspect({
      toggle(on, names) {
        if (!on) {
          inspector?.stop();
          inspector = undefined;
        } else if (inspector) {
          inspector.setNames(names);
        } else {
          inspector = startInspector({
            names,
            report: reportPick,
            missing: reportMissing,
            toSource,
          });
        }
      },
      select: (target) => inspector?.select(target),
    });
    reportInspectReady();
    return () => {
      off();
      inspector?.stop();
    };
  }, [embedded]);

  const embed = !preview && params.has('embed') && window.parent !== window;
  useEffect(() => {
    if (!embed) return;
    document.documentElement.dataset.ofEmbed = '';
    const post = () =>
      window.parent.postMessage(
        {
          type: EMBED_RESIZE_MESSAGE,
          formId,
          height: Math.ceil(document.body.getBoundingClientRect().height),
        },
        '*',
      );
    const observer = new ResizeObserver(post);
    observer.observe(document.body);
    return () => observer.disconnect();
  }, [embed, formId]);
  const onSubmitted = useCallback(() => {
    if (embed) window.parent.postMessage({ type: EMBED_SUBMITTED_MESSAGE, formId }, '*');
  }, [embed, formId]);
  // A redirect leaves the host page, not just the frame; browsers allow that
  // right after the respondent's click, otherwise the frame navigates.
  const redirect = useMemo(
    () =>
      embed
        ? (url: string) => {
            if (!window.open(url, '_top')) window.location.assign(url);
          }
        : undefined,
    [embed],
  );

  const runtime = useMemo(
    () => ({
      mode: 'interactive' as const,
      formId,
      config,
      locale,
      endpoint: `/api/forms/${encodeURIComponent(formId)}/submissions`,
      availability: info?.availability,
      token: info?.token,
      preview,
      onNavigate,
      // Studio shows forms in the language they're written in, like their titles.
      requestedLocale:
        params.get('lang') ?? (thumb ? sourceLocale(config, appConfig.locale) : undefined),
      onLocaleChange,
      previewControl,
      onSubmitted,
      redirect,
    }),
    [
      formId,
      config,
      locale,
      info,
      preview,
      onNavigate,
      params,
      thumb,
      onLocaleChange,
      previewControl,
      onSubmitted,
      redirect,
    ],
  );

  const messages = getMessages(locale);
  if (!known || info?.availability.state === 'not-found' || (module && !module.default)) {
    return <PageMessage title={messages.notFoundTitle} />;
  }

  const failure: LoadError | null = error ? { detail: error.message } : infoError;
  if (failure) {
    return (
      <PageMessage
        title={failure.network ? messages.networkError : messages.genericError}
        detail={appConfig.dev ? failure.detail : undefined}
      />
    );
  }
  if (!module?.default || !info) {
    return <div className="of-host" aria-busy="true" />;
  }

  const FormComponent = module.default;
  return (
    <div className="of-host">
      <FormRuntimeContext.Provider value={runtime}>
        <FormComponent key={revision} />
      </FormRuntimeContext.Provider>
    </div>
  );
}

function PageMessage({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="of-host">
      <div className="of-root" data-layout="card">
        <div className="of-form of-notice" role="alert">
          <h1 className="of-title">{title}</h1>
          {detail && <pre className="of-host-detail">{detail}</pre>}
        </div>
      </div>
    </div>
  );
}
