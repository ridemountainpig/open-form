import { visitorHeaders } from './visitor.ts';

export type UploadResult = { token: string; expires: number; type: string };

export class UploadError extends Error {}

type Target = { url: string; headers: Record<string, string> };

/** Where uploads for the form behind `endpoint` (its submissions URL) are asked for. */
export function uploadsUrl(endpoint: string): string {
  return endpoint.replace(/\/submissions\/?$/, '/uploads');
}

/**
 * Asks the server where to send a file, then sends it there: a bucket's
 * presigned URL, or the server itself. Resolves the token the submission carries.
 */
export async function uploadFile(opts: {
  endpoint: string;
  field: string;
  file: File;
  locale?: string;
  signal: AbortSignal;
  onProgress(percent: number): void;
}): Promise<UploadResult> {
  const base = new URL(uploadsUrl(opts.endpoint), window.location.href);
  const res = await fetch(base, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...visitorHeaders() },
    credentials: 'same-origin',
    signal: opts.signal,
    body: JSON.stringify({
      field: opts.field,
      name: opts.file.name,
      size: opts.file.size,
      type: opts.file.type,
      locale: opts.locale,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    token?: string;
    expires?: number;
    type?: string;
    upload?: Target;
  };
  if (!res.ok || !body.token || !body.upload) throw new UploadError(body.message ?? '');
  await put(new URL(body.upload.url, base), body.upload.headers, opts);
  return { token: body.token, expires: body.expires ?? 0, type: body.type ?? opts.file.type };
}

// XMLHttpRequest, not fetch: only it reports upload progress.
function put(
  url: URL,
  headers: Record<string, string>,
  opts: { file: File; signal: AbortSignal; onProgress(percent: number): void },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) opts.onProgress(Math.floor((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = '';
      try {
        message = (JSON.parse(xhr.responseText) as { message?: string }).message ?? '';
      } catch {}
      reject(new UploadError(message));
    };
    xhr.onerror = () => reject(new UploadError(''));
    xhr.onabort = () => reject(new DOMException('Aborted', 'AbortError'));
    opts.signal.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(opts.file);
  });
}
