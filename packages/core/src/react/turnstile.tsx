import { type Ref, useCallback, useEffect, useId, useImperativeHandle, useRef } from 'react';
import type { Locale } from '../schema/index.ts';
import { useFormComponents } from './components.tsx';

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

// A slow connection still finishes in time; a challenge the respondent has to answer waits for them instead.
const WAIT_MS = 20_000;

type TurnstileApi = {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      language?: string;
      theme?: 'auto' | 'light' | 'dark';
      appearance?: 'always' | 'execute' | 'interaction-only';
      'refresh-expired'?: 'auto' | 'manual' | 'never';
      callback?(token: string): void;
      'expired-callback'?(): void;
      'error-callback'?(): void;
      'before-interactive-callback'?(): void;
      'after-interactive-callback'?(): void;
      'unsupported-callback'?(): void;
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

export type TurnstileOutcome = { token: string } | 'failed' | 'cancelled';

export type TurnstileHandle = {
  /** The current token, or `undefined` until the check passes. */
  token(): string | undefined;
  /** Waits for a token, opening the challenge in a dialog when Cloudflare needs the respondent. */
  request(): Promise<TurnstileOutcome>;
  /** Start over: a token is single-use. */
  reset(): void;
};

type Waiting = {
  resolve(outcome: TurnstileOutcome): void;
  timer?: ReturnType<typeof setTimeout>;
  focus?: Element | null;
};

/**
 * Cloudflare Turnstile on the form's last step, out of sight: it usually passes
 * before the respondent submits. A challenge they have to answer opens in a
 * modal dialog, and only once they submit.
 */
export function TurnstileWidget({
  siteKey,
  locale,
  labels,
  ref,
}: {
  siteKey: string;
  locale: Locale;
  labels: { title: string; cancel: string };
  ref: Ref<TurnstileHandle>;
}) {
  const { Button } = useFormComponents();
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);
  const token = useRef<string | undefined>(undefined);
  const failed = useRef(false);
  const retry = useRef<(() => void) | null>(null);
  const interactive = useRef(false);
  const waiting = useRef<Waiting | null>(null);

  // The dialog stays open (non-modal and hidden) between challenges: a closed
  // one is display: none, and Turnstile's iframe has to keep running.
  const openDialog = useCallback(() => {
    const el = dialog.current;
    const wait = waiting.current;
    if (!el || !wait || el.matches(':modal')) return;
    clearTimeout(wait.timer);
    wait.focus = document.activeElement;
    el.close();
    el.showModal();
    el.focus();
  }, []);

  const settle = useCallback((outcome: TurnstileOutcome) => {
    const wait = waiting.current;
    if (!wait) return;
    waiting.current = null;
    clearTimeout(wait.timer);
    const el = dialog.current;
    if (el?.matches(':modal')) {
      el.close();
      el.show();
      // After the form re-enables its buttons.
      const focus = wait.focus;
      if (focus instanceof HTMLElement) requestAnimationFrame(() => focus.focus());
    }
    wait.resolve(outcome);
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      token: () => token.current,
      request() {
        if (token.current) return Promise.resolve({ token: token.current });
        if (failed.current) return Promise.resolve('failed');
        settle('cancelled');
        return new Promise<TurnstileOutcome>((resolve) => {
          const wait: Waiting = { resolve };
          waiting.current = wait;
          if (interactive.current) openDialog();
          else wait.timer = setTimeout(() => settle('failed'), WAIT_MS);
          retry.current?.();
        });
      },
      reset() {
        token.current = undefined;
        interactive.current = false;
        if (widget.current) widget.current.api.reset(widget.current.id);
      },
    }),
    [openDialog, settle],
  );

  useEffect(() => {
    let cancelled = false;
    failed.current = false;
    interactive.current = false;
    const fail = () => {
      failed.current = true;
      settle('failed');
    };
    const mount = () => {
      retry.current = null;
      loadTurnstile()
        .then((api) => {
          if (cancelled || !container.current) return;
          const id = api.render(container.current, {
            sitekey: siteKey,
            language: locale.toLowerCase(),
            theme: 'auto',
            appearance: 'interaction-only',
            'refresh-expired': 'auto',
            callback: (value) => {
              token.current = value;
              interactive.current = false;
              settle({ token: value });
            },
            'expired-callback': () => {
              token.current = undefined;
            },
            'error-callback': () => {
              token.current = undefined;
              settle('failed');
            },
            'before-interactive-callback': () => {
              interactive.current = true;
              openDialog();
            },
            'after-interactive-callback': () => {
              interactive.current = false;
            },
            'unsupported-callback': fail,
          });
          if (id) widget.current = { api, id };
          else fail();
        })
        .catch(() => {
          if (cancelled) return;
          // A dropped connection: the next submit tries the script again.
          retry.current = mount;
          settle('failed');
        });
    };
    mount();
    return () => {
      cancelled = true;
      retry.current = null;
      token.current = undefined;
      settle('cancelled');
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey, locale, openDialog, settle]);

  return (
    <dialog
      ref={dialog}
      className="of-turnstile"
      open
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={(e) => {
        e.preventDefault();
        settle('cancelled');
      }}
      onClose={(e) => {
        // Closed by the browser rather than by `settle`: keep the iframe alive.
        if (e.currentTarget.open) return;
        e.currentTarget.show();
        settle('cancelled');
      }}
    >
      <p className="of-turnstile-title" id={titleId}>
        {labels.title}
      </p>
      <div className="of-turnstile-widget" ref={container} />
      <div className="of-turnstile-actions">
        <Button type="button" variant="secondary" onClick={() => settle('cancelled')}>
          {labels.cancel}
        </Button>
      </div>
    </dialog>
  );
}
