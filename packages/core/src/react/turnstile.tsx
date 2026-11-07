import { type Ref, useEffect, useImperativeHandle, useRef } from 'react';
import type { Locale } from '../schema/index.ts';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      theme?: 'auto' | 'light' | 'dark';
      'refresh-expired'?: 'auto' | 'manual' | 'never';
      callback?(token: string): void;
      'expired-callback'?(): void;
      'error-callback'?(): void;
    },
  ): string | undefined;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let loading: Promise<TurnstileApi> | undefined;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile failed to load.'));
    script.onerror = () => reject(new Error('Turnstile failed to load.'));
    document.head.append(script);
  }).catch((err) => {
    loading = undefined;
    throw err;
  });
  return loading;
}

export type TurnstileHandle = {
  /** The current token, or `undefined` until the check passes. */
  token(): string | undefined;
  /** Start over: a token is single-use. */
  reset(): void;
};

/** Cloudflare Turnstile's widget, rendered above the form's buttons on the last step. */
export function TurnstileWidget({
  siteKey,
  locale,
  ref,
}: {
  siteKey: string;
  locale: Locale;
  ref: Ref<TurnstileHandle>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const token = useRef<string | undefined>(undefined);

  useImperativeHandle(
    ref,
    () => ({
      token: () => token.current,
      reset() {
        token.current = undefined;
        if (widget.current) widget.current.api.reset(widget.current.id);
      },
    }),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    loadTurnstile()
      .then((api) => {
        if (cancelled || !container.current) return;
        const id = api.render(container.current, {
          sitekey: siteKey,
          language: locale.toLowerCase(),
          theme: 'auto',
          'refresh-expired': 'auto',
          callback: (value) => {
            token.current = value;
          },
          'expired-callback': () => {
            token.current = undefined;
          },
          'error-callback': () => {
            token.current = undefined;
          },
        });
        if (id) widget.current = { api, id };
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      token.current = undefined;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey, locale]);

  return <div className="of-turnstile" ref={container} />;
}
