import { ArrowLeft, ArrowRight, KeyRound, RotateCw } from 'lucide-react';
import {
  createContext,
  type FormEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ApiError, SIGNED_OUT_EVENT } from './api.ts';
import { useT } from './i18n.tsx';
import { Logo } from './sidebar.tsx';
import { Button, ButtonLink, Card } from './ui.tsx';

const SESSION_API = '/api/studio/session';

type SessionInfo = {
  signedIn: boolean;
  canSignOut: boolean;
  /** Not signed in, but the server lets everyone read Studio (`studio.public`). */
  readOnly?: boolean;
  signIn: 'password' | 'url' | null;
  signInUrl?: string;
};

type Session = { info: SessionInfo; signOut(): Promise<void>; openSignIn(): void };

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session | null {
  return useContext(SessionContext);
}

/** Studio is open to read without signing in: hide everything that changes data. */
export function useReadOnly(): boolean {
  return useSession()?.info.readOnly ?? false;
}

async function fetchSession(): Promise<SessionInfo> {
  const res = await fetch(SESSION_API, { credentials: 'same-origin' });
  // No admin configured at all: nobody can sign in from here.
  if (res.status === 404) return { signedIn: false, canSignOut: false, signIn: null };
  if (!res.ok) throw new ApiError(res.status, res.statusText);
  return (await res.json()) as SessionInfo;
}

/** Renders Studio once signed in or open to read; otherwise the sign-in screen. */
export function SessionGate({ children }: { children: ReactNode }) {
  const [info, setInfo] = useState<SessionInfo | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  const load = useCallback(
    () =>
      fetchSession().then(
        (next) => {
          setInfo(next);
          setError(null);
        },
        (err: Error) => setError(err),
      ),
    [],
  );

  useEffect(() => {
    load();
    // Any 401 — an expired session, a changed password — sends Studio back here.
    window.addEventListener(SIGNED_OUT_EVENT, load);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, load);
  }, [load]);

  const signOut = useCallback(async () => {
    await fetch(SESSION_API, { method: 'DELETE', credentials: 'same-origin' });
    load();
  }, [load]);

  if (error) {
    return (
      <SessionFailed
        error={error}
        retrying={retrying}
        onRetry={() => {
          setRetrying(true);
          void load().finally(() => setRetrying(false));
        }}
      />
    );
  }
  if (!info) return <div aria-busy="true" className="min-h-dvh" />;
  if (!info.signedIn && (!info.readOnly || signingIn)) {
    return (
      <SignIn
        info={info}
        onSignedIn={() => {
          setSigningIn(false);
          load();
        }}
        onBack={info.readOnly ? () => setSigningIn(false) : undefined}
      />
    );
  }
  const openSignIn = () => setSigningIn(true);
  return (
    <SessionContext.Provider value={{ info, signOut, openSignIn }}>
      {children}
    </SessionContext.Provider>
  );
}

function SessionFailed({
  error,
  retrying,
  onRetry,
}: {
  error: Error;
  retrying: boolean;
  onRetry(): void;
}) {
  const t = useT();
  return (
    <Screen>
      <h1 className="text-lg font-semibold">{t('session.failed')}</h1>
      <p role="alert" className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">
        {error instanceof ApiError
          ? t('session.failedStatus', { status: error.status })
          : error instanceof TypeError
            ? t('session.offline')
            : t('common.error')}
      </p>
      <Button variant="primary" className="mt-5 w-full" onClick={onRetry} disabled={retrying}>
        <RotateCw />
        {retrying ? t('session.retrying') : t('session.retry')}
      </Button>
    </Screen>
  );
}

function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-zinc-100/70 px-4 py-10 dark:bg-zinc-950">
      <Card className="w-full max-w-sm p-6">
        <Logo className="mb-5 size-9" />
        {children}
      </Card>
    </main>
  );
}

function SignIn({
  info,
  onSignedIn,
  onBack,
}: {
  info: SessionInfo;
  onSignedIn(): void;
  /** Back to the read-only Studio, when there is one. */
  onBack?(): void;
}) {
  const t = useT();
  const back = onBack && (
    <Button variant="ghost" className="mt-2 w-full" onClick={onBack}>
      <ArrowLeft />
      {t('session.back')}
    </Button>
  );
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setProblem(null);
    try {
      const res = await fetch(SESSION_API, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) return onSignedIn();
      setProblem(
        res.status === 429
          ? t('session.rateLimited')
          : res.status === 401
            ? t('session.invalid')
            : t('common.error'),
      );
    } catch {
      setProblem(t('common.error'));
    } finally {
      setBusy(false);
    }
  };

  const code = (
    <code className="rounded bg-zinc-100 px-1 py-px font-mono text-[12px] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200">
      OPEN_FORM_ADMIN_PASSWORD
    </code>
  );

  if (info.signIn === 'url' && info.signInUrl) {
    return (
      <Screen>
        <h1 className="text-lg font-semibold">{t('session.title')}</h1>
        <p className="mt-1.5 text-sm text-zinc-500 dark:text-zinc-400">{t('session.ssoHint')}</p>
        <ButtonLink variant="primary" className="mt-5 w-full" href={info.signInUrl}>
          {t('session.sso')}
          <ArrowRight />
        </ButtonLink>
        {back}
      </Screen>
    );
  }

  if (info.signIn !== 'password') {
    return (
      <Screen>
        <h1 className="text-lg font-semibold">{t('session.title')}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('session.unavailable.before')}
          {code}
          {t('session.unavailable.after')}
        </p>
        {back}
      </Screen>
    );
  }

  return (
    <Screen>
      <h1 className="text-lg font-semibold">{t('session.title')}</h1>
      <form className="mt-5 space-y-3" onSubmit={submit}>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium">{t('session.password')}</span>
          <span className="relative block">
            <KeyRound
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-zinc-400"
              aria-hidden
            />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
              // biome-ignore lint/a11y/noAutofocus: the only thing to do on this screen
              autoFocus
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={problem ? true : undefined}
              aria-describedby={problem ? 'sign-in-problem' : undefined}
              className="focus-ring h-9 w-full rounded-md border border-zinc-200 bg-white pr-3 pl-8 font-mono text-[13px] dark:border-zinc-800 dark:bg-zinc-900"
            />
          </span>
        </label>
        {problem && (
          <p
            id="sign-in-problem"
            role="alert"
            className="text-[13px] text-red-600 dark:text-red-400"
          >
            {problem}
          </p>
        )}
        <Button type="submit" variant="primary" className="h-9 w-full" disabled={busy || !password}>
          {busy ? t('session.submitting') : t('session.submit')}
        </Button>
      </form>
      {back}
    </Screen>
  );
}
