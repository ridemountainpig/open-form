import { type Duration, parseDuration } from '../schema/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
import type { Signer } from './crypto.ts';

/** Who may use Studio and the admin API. Without one, those endpoints don't exist. */
export type AdminAuth = {
  /**
   * A shared password you choose, at least 16 characters (a passphrase works).
   * Studio asks for it once and then keeps a signed session cookie; changing it
   * signs everyone out.
   */
  password?: string;
  /** Your own check: an SSO session, "requests from this machine", … */
  authorize?(request: Request): boolean | Promise<boolean>;
  /** Where Studio sends signed-out people when there is no password, e.g. your SSO page. */
  signInUrl?: string;
  /** How long a Studio sign-in lasts. Default `'7d'`. */
  sessionMaxAge?: Duration;
};

export const ADMIN_PASSWORD_MIN_LENGTH = 16;
export const SESSION_COOKIE = 'of_session';

export function adminPasswordProblem(password: string): string | null {
  return password.length < ADMIN_PASSWORD_MIN_LENGTH
    ? `The admin password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters. A passphrase of a few words works.`
    : null;
}

export type AdminGate = {
  /** How the request is signed in, or null. */
  check(request: Request): Promise<'authorized' | 'session' | null>;
  /** A session cookie for the right password; null for a wrong one. */
  signIn(request: Request, candidate: unknown, now: number): Promise<string | null>;
  /** Clears the cookie and revokes its session, so a copied cookie stops working too. */
  signOut(request: Request): Promise<string>;
};

export type SessionRevocations = Pick<StorageAdapter, 'revokeSession' | 'isSessionRevoked'>;

/**
 * Whether the browser used HTTPS. Behind a proxy that ends TLS the URL can say
 * http while the page that sent the request is https, and an https page can't
 * call an http server, so its `Origin` tells.
 */
export function sentOverHttps(request: Request): boolean {
  return (
    new URL(request.url).protocol === 'https:' ||
    (request.headers.get('origin')?.startsWith('https://') ?? false)
  );
}

function readCookie(request: Request, name: string): string | undefined {
  for (const part of request.headers.get('cookie')?.split(';') ?? []) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return rest.join('=');
  }
  return undefined;
}

export function createAdminGate(
  auth: AdminAuth,
  signer: Signer,
  opts: { revocations: SessionRevocations; secureCookies?: boolean; now?: () => number },
): AdminGate {
  if (auth.password !== undefined) {
    const problem = adminPasswordProblem(auth.password);
    if (problem) throw new Error(problem);
  }
  const maxAgeMs = parseDuration(auth.sessionMaxAge ?? '7d');
  const clock = opts.now ?? Date.now;
  // Comparing signatures instead of the passwords keeps the comparison constant
  // time and the password's length out of it. Sessions carry a tag of the
  // password, so a new password ends every old session.
  const expected =
    auth.password === undefined ? null : signer.sign(`admin-password:${auth.password}`);
  const sessionData = async (expires: number) =>
    `admin-session:${expires}:${((await expected) ?? '').slice(0, 16)}`;

  const validSession = async (request: Request) => {
    if (!expected) return null;
    const value = readCookie(request, SESSION_COOKIE);
    const dot = value?.indexOf('.') ?? -1;
    if (!value || dot === -1) return null;
    const expires = Number(value.slice(0, dot));
    if (!Number.isSafeInteger(expires) || expires <= clock()) return null;
    const signature = value.slice(dot + 1);
    return (await signer.verify(await sessionData(expires), signature))
      ? { expires, signature }
      : null;
  };

  const cookie = (request: Request, value: string, maxAgeS: number) => {
    const secure = opts.secureCookies || sentOverHttps(request);
    return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAgeS}; HttpOnly; SameSite=Strict${
      secure ? '; Secure' : ''
    }`;
  };

  return {
    async check(request) {
      if (await auth.authorize?.(request)) return 'authorized';
      const session = await validSession(request);
      if (!session) return null;
      return (await opts.revocations.isSessionRevoked(session.signature)) ? null : 'session';
    },
    async signIn(request, candidate, now) {
      if (!expected || typeof candidate !== 'string' || candidate.length > 1024) return null;
      if (!(await signer.verify(`admin-password:${candidate}`, await expected))) return null;
      const expires = now + maxAgeMs;
      const signature = await signer.sign(await sessionData(expires));
      return cookie(request, `${expires}.${signature}`, Math.floor(maxAgeMs / 1000));
    },
    async signOut(request) {
      const session = await validSession(request);
      if (session) {
        await opts.revocations.revokeSession(session.signature, session.expires, clock());
      }
      return cookie(request, '', 0);
    },
  };
}
