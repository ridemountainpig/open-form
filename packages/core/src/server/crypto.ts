const encoder = new TextEncoder();

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type Signer = {
  sign(data: string): Promise<string>;
  verify(data: string, signature: string): Promise<boolean>;
};

export function createSigner(secret: string): Signer {
  if (!secret || secret.length < 16) {
    throw new Error('Open Form needs a secret of at least 16 characters (OPEN_FORM_SECRET).');
  }
  const key = crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sign = async (data: string) => {
    const signature = await crypto.subtle.sign('HMAC', await key, encoder.encode(data));
    return base64url(new Uint8Array(signature));
  };
  return {
    sign,
    async verify(data, signature) {
      return constantTimeEqual(await sign(data), signature);
    },
  };
}

const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export async function issueTimingToken(signer: Signer, formId: string, now: number) {
  return `${now}.${await signer.sign(`timing:${formId}:${now}`)}`;
}

export type TimingCheck = 'ok' | 'invalid' | 'too-fast' | 'expired';

export async function checkTimingToken(
  signer: Signer,
  formId: string,
  token: unknown,
  minimumMs: number,
  now: number,
): Promise<TimingCheck> {
  if (typeof token !== 'string') return 'invalid';
  const dot = token.indexOf('.');
  const issuedAt = Number(token.slice(0, dot));
  if (dot === -1 || !Number.isSafeInteger(issuedAt)) return 'invalid';
  if (!(await signer.verify(`timing:${formId}:${issuedAt}`, token.slice(dot + 1))))
    return 'invalid';
  if (now - issuedAt < minimumMs) return 'too-fast';
  if (now - issuedAt > TOKEN_MAX_AGE_MS) return 'expired';
  return 'ok';
}
