import { type FileStore, PENDING_PREFIX } from './files.ts';

// An S3-compatible bucket (AWS S3, Cloudflare R2, Supabase Storage, Backblaze
// B2…) spoken to with fetch and Web Crypto, so it runs on Node, Vercel and
// Workers alike without an SDK. Browsers upload straight to the bucket with a
// presigned PUT, so file bodies never pass through a serverless function.

export type S3FileStoreOptions = {
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** `https://<account>.r2.cloudflarestorage.com`; default AWS for `region`. */
  endpoint?: string;
  /** Default `auto` with an `endpoint` (R2), else `us-east-1`. */
  region?: string;
  /** Keys start with this, e.g. `open-form/`, to share a bucket. */
  prefix?: string;
  /** `bucket` in the path instead of the host name. Default: on with an `endpoint`. */
  pathStyle?: boolean;
  fetch?: typeof fetch;
  now?: () => number;
};

export type S3Location = Pick<
  S3FileStoreOptions,
  'bucket' | 'endpoint' | 'region' | 'prefix' | 'pathStyle'
>;

/** `s3://bucket/optional/prefix?endpoint=https://…&region=auto` */
export function parseS3Url(raw: string): S3Location {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('the file storage URL must look like s3://bucket?endpoint=https://….');
  }
  if (url.protocol !== 's3:' || !url.hostname) {
    throw new Error('the file storage URL must start with s3://<bucket>.');
  }
  if (url.username || url.password) {
    throw new Error(
      'keep the access keys out of the file storage URL: set OPEN_FORM_FILES_ACCESS_KEY_ID and OPEN_FORM_FILES_SECRET_ACCESS_KEY.',
    );
  }
  const endpoint = url.searchParams.get('endpoint') ?? undefined;
  if (endpoint) {
    let parsed: URL;
    try {
      parsed = new URL(endpoint);
    } catch {
      throw new Error(`endpoint ${JSON.stringify(endpoint)} isn't a URL.`);
    }
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(parsed.hostname);
    if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
      throw new Error('the file storage endpoint must be https:// (http:// only for localhost).');
    }
  }
  const style = url.searchParams.get('style');
  const path = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
  return {
    bucket: url.hostname,
    endpoint: endpoint?.replace(/\/+$/, ''),
    region: url.searchParams.get('region') ?? undefined,
    prefix: path ? `${path.replace(/\/+$/, '')}/` : undefined,
    pathStyle: style === 'path' ? true : style === 'virtual' ? false : undefined,
  };
}

const encoder = new TextEncoder();
const EMPTY_HASH = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function hex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', encoder.encode(text)));
}

async function hmac(
  key: ArrayBuffer | Uint8Array<ArrayBuffer>,
  data: string,
): Promise<ArrayBuffer> {
  const imported = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return crypto.subtle.sign('HMAC', imported, encoder.encode(data));
}

/** RFC 3986, as SigV4 wants: everything but unreserved characters escaped. */
export function uriEncode(value: string, keepSlash = false): string {
  return Array.from(encoder.encode(value), (byte) => {
    const c = String.fromCharCode(byte);
    if (/[A-Za-z0-9\-._~]/.test(c) || (keepSlash && c === '/')) return c;
    return `%${byte.toString(16).toUpperCase().padStart(2, '0')}`;
  }).join('');
}

function amzDate(ms: number): string {
  return new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

export type SignInput = {
  method: string;
  url: URL;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  now: number;
  /** Lowercase names. `host` is added. */
  headers?: Record<string, string>;
  /** Presign into the query string, valid this long, instead of signing headers. */
  expiresInSeconds?: number;
  payloadHash?: string;
};

/** AWS Signature Version 4 for S3: the request's headers, or a presigned URL. */
export async function signS3(
  input: SignInput,
): Promise<{ url: URL; headers: Record<string, string> }> {
  const date = amzDate(input.now);
  const day = date.slice(0, 8);
  const scope = `${day}/${input.region}/s3/aws4_request`;
  const url = new URL(input.url);
  const headers: Record<string, string> = { ...input.headers, host: url.host };
  const presign = input.expiresInSeconds !== undefined;
  const payloadHash = input.payloadHash ?? (presign ? 'UNSIGNED-PAYLOAD' : EMPTY_HASH);
  if (!presign) {
    headers['x-amz-date'] = date;
    headers['x-amz-content-sha256'] = payloadHash;
  }
  const names = Object.keys(headers)
    .map((n) => n.toLowerCase())
    .sort();
  const signedHeaders = names.join(';');
  if (presign) {
    url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256');
    url.searchParams.set('X-Amz-Credential', `${input.accessKeyId}/${scope}`);
    url.searchParams.set('X-Amz-Date', date);
    url.searchParams.set('X-Amz-Expires', String(input.expiresInSeconds));
    url.searchParams.set('X-Amz-SignedHeaders', signedHeaders);
  }
  const query = [...url.searchParams]
    .map(([k, v]) => [uriEncode(k), uriEncode(v)] as const)
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  const canonical = [
    input.method,
    url.pathname,
    query,
    names.map((n) => `${n}:${String(lower[n]).trim().replace(/\s+/g, ' ')}\n`).join(''),
    signedHeaders,
    payloadHash,
  ].join('\n');
  const toSign = ['AWS4-HMAC-SHA256', date, scope, await sha256(canonical)].join('\n');
  let key: ArrayBuffer = await hmac(encoder.encode(`AWS4${input.secretAccessKey}`), day);
  for (const part of [input.region, 's3', 'aws4_request']) key = await hmac(key, part);
  const signature = hex(await hmac(key, toSign));
  if (presign) {
    url.searchParams.set('X-Amz-Signature', signature);
    // URLSearchParams writes spaces as `+`; S3 reads them per RFC 3986.
    url.search = `?${query}&X-Amz-Signature=${signature}`;
    return { url, headers: {} };
  }
  const { host: _host, ...sent } = headers;
  return {
    url,
    headers: {
      ...sent,
      authorization: `AWS4-HMAC-SHA256 Credential=${input.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    },
  };
}

function xmlText(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

/** `attachment; filename="…"; filename*=UTF-8''…`: ASCII fallback plus the real name. */
export function attachmentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]|["\\]/g, '_');
  return `attachment; filename="${fallback}"; filename*=UTF-8''${uriEncode(name)}`;
}

export function createS3FileStore(opts: S3FileStoreOptions): FileStore {
  const region = opts.region ?? (opts.endpoint ? 'auto' : 'us-east-1');
  const pathStyle = opts.pathStyle ?? Boolean(opts.endpoint);
  const prefix = opts.prefix ?? '';
  const doFetch = opts.fetch ?? fetch;
  const clock = opts.now ?? Date.now;
  const origin = opts.endpoint
    ? opts.endpoint
    : `https://${pathStyle ? '' : `${opts.bucket}.`}s3.${region}.amazonaws.com`;
  const objectUrl = (key = '') =>
    new URL(
      `${origin}${pathStyle ? `/${uriEncode(opts.bucket)}` : ''}/${uriEncode(prefix + key, true)}`,
    );

  const sign = (method: string, url: URL, extra: Partial<SignInput> = {}) =>
    signS3({
      method,
      url,
      region,
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      now: clock(),
      ...extra,
    });

  async function send(method: string, url: URL, headers: Record<string, string> = {}) {
    const signed = await sign(method, url, { headers });
    return doFetch(signed.url, { method, headers: signed.headers });
  }

  async function fail(res: Response, action: string): Promise<never> {
    const body = await res.text().catch(() => '');
    const code = /<Code>([^<]*)<\/Code>/.exec(body)?.[1];
    throw new Error(`S3 ${action} failed: ${res.status}${code ? ` ${code}` : ''}.`);
  }

  async function list(listPrefix: string): Promise<Array<{ key: string; modified: number }>> {
    const out: Array<{ key: string; modified: number }> = [];
    let token: string | undefined;
    do {
      const url = objectUrl();
      url.pathname = pathStyle ? `/${uriEncode(opts.bucket)}` : '/';
      url.searchParams.set('list-type', '2');
      url.searchParams.set('prefix', prefix + listPrefix);
      if (token) url.searchParams.set('continuation-token', token);
      const res = await send('GET', url);
      if (!res.ok) await fail(res, 'list');
      const xml = await res.text();
      for (const [, block = ''] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
        const key = /<Key>([^<]*)<\/Key>/.exec(block)?.[1];
        const modified = /<LastModified>([^<]*)<\/LastModified>/.exec(block)?.[1];
        if (key)
          out.push({
            key: xmlText(key).slice(prefix.length),
            modified: Date.parse(modified ?? ''),
          });
      }
      token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
        ? xmlText(/<NextContinuationToken>([^<]*)<\/NextContinuationToken>/.exec(xml)?.[1] ?? '')
        : undefined;
    } while (token);
    return out;
  }

  async function remove(keys: readonly string[]) {
    // One at a time in small batches: DeleteObjects needs Content-MD5, which Web Crypto lacks.
    for (let i = 0; i < keys.length; i += 8) {
      await Promise.all(
        keys.slice(i, i + 8).map(async (key) => {
          const res = await send('DELETE', objectUrl(key));
          if (!res.ok && res.status !== 404) await fail(res, 'delete');
        }),
      );
    }
  }

  return {
    kind: 's3',
    describe: () =>
      `S3 ${opts.bucket}${prefix ? `/${prefix}` : ''}${opts.endpoint ? ` at ${new URL(opts.endpoint).host}` : ` (${region})`}`,
    async uploadTarget(key, file, expiresInSeconds) {
      // The browser sends Content-Length itself; signing it holds the upload to the declared size.
      const signed = await sign('PUT', objectUrl(key), {
        headers: { 'content-length': String(file.size) },
        expiresInSeconds,
      });
      return { url: signed.url.toString(), headers: {} };
    },
    async stat(key) {
      const res = await send('HEAD', objectUrl(key));
      if (res.status === 404) return null;
      if (!res.ok) await fail(res, 'head');
      return { size: Number(res.headers.get('content-length') ?? 0) };
    },
    async readHead(key, bytes) {
      const res = await send('GET', objectUrl(key), { range: `bytes=0-${bytes - 1}` });
      if (res.status === 404) return null;
      if (res.status === 416) return new Uint8Array();
      if (!res.ok) await fail(res, 'read');
      return new Uint8Array(await res.arrayBuffer()).slice(0, bytes);
    },
    async move(from, to) {
      const source = `/${opts.bucket}/${uriEncode(prefix + from, true)}`;
      const res = await send('PUT', objectUrl(to), { 'x-amz-copy-source': source });
      if (res.status === 404) return false;
      const body = await res.text();
      // A copy can answer 200 and still fail, with the error in the body.
      if (!res.ok || /<Error>/.test(body)) {
        if (/NoSuchKey/.test(body)) return false;
        throw new Error(`S3 copy failed: ${res.status}.`);
      }
      await remove([from]);
      return true;
    },
    async download(key, file) {
      if (!(await this.stat(key))) return null;
      const url = objectUrl(key);
      url.searchParams.set('response-content-disposition', attachmentDisposition(file.name));
      url.searchParams.set('response-content-type', file.type);
      const signed = await sign('GET', url, { expiresInSeconds: 60 });
      return { redirect: signed.url.toString() };
    },
    delete: remove,
    async deletePrefix(keyPrefix) {
      await remove((await list(keyPrefix)).map((item) => item.key));
    },
    async sweep(olderThanMs, now = clock()) {
      const stale = (await list(PENDING_PREFIX)).filter(
        (item) => !(now - item.modified <= olderThanMs),
      );
      await remove(stale.map((item) => item.key));
    },
  };
}
