import { describe, expect, it } from 'vitest';
import { attachmentDisposition, createS3FileStore, parseS3Url, signS3 } from './s3.ts';

const KEYS = {
  accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
};
const MAY_24_2013 = Date.UTC(2013, 4, 24);

describe('signS3', () => {
  // The examples in AWS's "Signature Version 4" documentation for S3.
  it('signs headers like the AWS example', async () => {
    const { headers } = await signS3({
      ...KEYS,
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      region: 'us-east-1',
      now: MAY_24_2013,
      headers: { range: 'bytes=0-9' },
    });
    expect(headers.authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request, SignedHeaders=host;range;x-amz-content-sha256;x-amz-date, Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41',
    );
  });

  it('presigns a URL like the AWS example', async () => {
    const { url } = await signS3({
      ...KEYS,
      method: 'GET',
      url: new URL('https://examplebucket.s3.amazonaws.com/test.txt'),
      region: 'us-east-1',
      now: MAY_24_2013,
      expiresInSeconds: 86400,
    });
    expect(url.searchParams.get('X-Amz-Signature')).toBe(
      'aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404',
    );
  });
});

describe('parseS3Url', () => {
  it('reads the bucket, prefix and endpoint', () => {
    expect(
      parseS3Url('s3://forms/uploads/?endpoint=https://acct.r2.cloudflarestorage.com&region=auto'),
    ).toEqual({
      bucket: 'forms',
      prefix: 'uploads/',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      region: 'auto',
      pathStyle: undefined,
    });
  });

  it('keeps keys and plain http out', () => {
    expect(() => parseS3Url('s3://key:secret@forms')).toThrow(/access keys/);
    expect(() => parseS3Url('s3://forms?endpoint=http://example.com')).toThrow(/https/);
    expect(() => parseS3Url('https://forms')).toThrow(/s3:\/\//);
  });
});

describe('S3 file store', () => {
  // A bucket that answers the few calls the store makes.
  function fakeBucket() {
    const objects = new Map<string, Uint8Array>();
    const calls: string[] = [];
    const fakeFetch = (async (input: URL | string, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      const headers = new Headers(init?.headers);
      expect(headers.get('authorization')).toMatch(/^AWS4-HMAC-SHA256 /);
      const key = decodeURIComponent(url.pathname.replace(/^\/forms\//, ''));
      calls.push(`${method} ${url.pathname}${url.search ? '?' : ''}`);
      if (url.searchParams.get('list-type') === '2') {
        const prefix = url.searchParams.get('prefix') ?? '';
        const keys = [...objects.keys()].filter((k) => k.startsWith(prefix));
        const xml = keys
          .map(
            (k) =>
              `<Contents><Key>${k}</Key><LastModified>2020-01-01T00:00:00.000Z</LastModified></Contents>`,
          )
          .join('');
        return new Response(
          `<ListBucketResult><IsTruncated>false</IsTruncated>${xml}</ListBucketResult>`,
        );
      }
      const bytes = objects.get(key);
      if (method === 'HEAD') {
        return bytes
          ? new Response(null, { headers: { 'content-length': String(bytes.length) } })
          : new Response(null, { status: 404 });
      }
      if (method === 'GET') {
        if (!bytes) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
        const end = Number(/bytes=0-(\d+)/.exec(headers.get('range') ?? '')?.[1] ?? bytes.length);
        return new Response(bytes.slice(0, end + 1), { status: 206 });
      }
      if (method === 'PUT') {
        const source = headers.get('x-amz-copy-source');
        const from = source && decodeURIComponent(source.replace(/^\/forms\//, ''));
        const found = from ? objects.get(from) : undefined;
        if (!found) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 });
        objects.set(key, found);
        return new Response('<CopyObjectResult/>');
      }
      if (method === 'DELETE') {
        objects.delete(key);
        return new Response(null, { status: 204 });
      }
      return new Response(null, { status: 400 });
    }) as typeof globalThis.fetch;
    return { objects, calls, fetch: fakeFetch };
  }

  it('reads, moves, lists and deletes under its prefix', async () => {
    const bucket = fakeBucket();
    const store = createS3FileStore({
      ...KEYS,
      bucket: 'forms',
      prefix: 'of/',
      endpoint: 'https://acct.r2.cloudflarestorage.com',
      fetch: bucket.fetch,
    });
    bucket.objects.set('of/tmp/abc', new TextEncoder().encode('%PDF-1.7 hello'));
    expect(await store.stat('tmp/abc')).toEqual({ size: 14 });
    expect(new TextDecoder().decode((await store.readHead('tmp/abc', 4)) ?? undefined)).toBe(
      '%PDF',
    );
    expect(await store.move('tmp/abc', 'apply/abc')).toBe(true);
    expect([...bucket.objects.keys()]).toEqual(['of/apply/abc']);
    expect(await store.move('tmp/abc', 'apply/abc')).toBe(false);

    const download = await store.download('apply/abc', { name: 'cv.pdf', type: 'application/pdf' });
    expect(
      download &&
        'redirect' in download &&
        new URL(download.redirect).searchParams.get('response-content-disposition'),
    ).toBe(attachmentDisposition('cv.pdf'));

    const target = await store.uploadTarget('tmp/new', { size: 10, type: 'application/pdf' }, 900);
    const signed = new URL(target?.url ?? '');
    expect(signed.pathname).toBe('/forms/of/tmp/new');
    expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBe('content-length;host');

    bucket.objects.set('of/tmp/old', new Uint8Array([1]));
    await store.sweep?.(60_000);
    expect(bucket.objects.has('of/tmp/old')).toBe(false);
    await store.deletePrefix('apply/');
    expect(bucket.objects.size).toBe(0);
  });
});
