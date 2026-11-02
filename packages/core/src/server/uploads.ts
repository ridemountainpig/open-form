import type { Signer } from './crypto.ts';

/** What an upload token vouches for: this file, for this form's field, until `expires`. */
export type UploadClaim = {
  formId: string;
  field: string;
  /** Random id; the bytes wait at `tmp/<fileId>` and move to `<formId>/<fileId>`. */
  fileId: string;
  size: number;
  name: string;
  expires: number;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(text: string): Uint8Array {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function newFileId(): string {
  return toBase64url(crypto.getRandomValues(new Uint8Array(18)));
}

export async function issueUploadToken(signer: Signer, claim: UploadClaim): Promise<string> {
  const payload = toBase64url(
    encoder.encode(
      JSON.stringify({
        f: claim.formId,
        n: claim.field,
        k: claim.fileId,
        s: claim.size,
        m: claim.name,
        e: claim.expires,
      }),
    ),
  );
  return `${payload}.${await signer.sign(`upload:${payload}`)}`;
}

export type UploadTokenCheck =
  | { ok: true; claim: UploadClaim }
  | { ok: false; reason: 'invalid' | 'expired' };

export async function readUploadToken(
  signer: Signer,
  token: unknown,
  now: number,
): Promise<UploadTokenCheck> {
  if (typeof token !== 'string' || token.length > 2048) return { ok: false, reason: 'invalid' };
  const dot = token.indexOf('.');
  if (dot <= 0) return { ok: false, reason: 'invalid' };
  const payload = token.slice(0, dot);
  if (!(await signer.verify(`upload:${payload}`, token.slice(dot + 1)))) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    const raw = JSON.parse(decoder.decode(fromBase64url(payload))) as Record<string, unknown>;
    const claim: UploadClaim = {
      formId: String(raw.f),
      field: String(raw.n),
      fileId: String(raw.k),
      size: Number(raw.s),
      name: String(raw.m),
      expires: Number(raw.e),
    };
    if (!/^[\w-]+$/.test(claim.fileId) || !Number.isSafeInteger(claim.size)) {
      return { ok: false, reason: 'invalid' };
    }
    if (!(now < claim.expires)) return { ok: false, reason: 'expired' };
    return { ok: true, claim };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
