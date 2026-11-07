export const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

// Cloudflare's always-pass test pair. The test secret accepts only the test site
// key's dummy token, so the two are always swapped in together.
export const TURNSTILE_TEST_SITE_KEY = '1x00000000000000000000AA';
export const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';

const TOKEN_MAX_LENGTH = 2048;
const TIMEOUT_MS = 10_000;

/** `misconfigured`: Cloudflare rejected the secret key itself. */
export type TurnstileCheck = 'ok' | 'invalid' | 'unavailable' | 'misconfigured';

export async function verifyTurnstile(opts: {
  secret: string;
  token: unknown;
  remoteIp?: string;
  fetch?: typeof fetch;
}): Promise<TurnstileCheck> {
  const { token } = opts;
  if (typeof token !== 'string' || !token || token.length > TOKEN_MAX_LENGTH) return 'invalid';
  const body = new URLSearchParams({ secret: opts.secret, response: token });
  if (opts.remoteIp && opts.remoteIp !== 'unknown') body.set('remoteip', opts.remoteIp);
  let res: Response;
  try {
    res = await (opts.fetch ?? fetch)(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    return 'unavailable';
  }
  if (!res.ok) return 'unavailable';
  const result = (await res.json().catch(() => null)) as {
    success?: unknown;
    'error-codes'?: unknown;
  } | null;
  if (!result) return 'unavailable';
  if (result.success === true) return 'ok';
  const codes = Array.isArray(result['error-codes']) ? result['error-codes'] : [];
  return codes.includes('invalid-input-secret') ? 'misconfigured' : 'invalid';
}
