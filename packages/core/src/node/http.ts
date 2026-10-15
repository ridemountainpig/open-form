import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';
import { isLoopbackHost } from '../server/address.ts';

export type NodeRequestOptions = {
  /**
   * Honour X-Forwarded-* headers: `true` for one proxy, or how many proxies sit
   * in front of the server. Only behind proxies you control.
   */
  trustProxy?: boolean | number;
};

/** `OPEN_FORM_TRUST_PROXY`: `true`, `false` or a number of proxies; unset is `undefined`. */
export function parseTrustProxy(value: string | undefined): boolean | number | undefined {
  const text = value?.trim().toLowerCase();
  if (!text) return undefined;
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (/^\d+$/.test(text)) return Number(text);
  throw new Error(
    `OPEN_FORM_TRUST_PROXY must be true, false or the number of proxies in front of the server (usually 1), not "${value}".`,
  );
}

function firstHeader(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value?.split(',')[0]?.trim() || undefined;
}

export function requestOrigin(req: IncomingMessage, opts: NodeRequestOptions = {}): string {
  const encrypted = 'encrypted' in req.socket && Boolean(req.socket.encrypted);
  const proto =
    (opts.trustProxy && firstHeader(req, 'x-forwarded-proto')) || (encrypted ? 'https' : 'http');
  const host =
    (opts.trustProxy && firstHeader(req, 'x-forwarded-host')) || req.headers.host || 'localhost';
  return `${proto}://${host}`;
}

/**
 * The client in an `X-Forwarded-For` chain. Each proxy appends the address it
 * saw, so only the last `hops` entries are trustworthy; anything to their left
 * came from the client.
 */
export function forwardedAddress(
  header: string | readonly string[] | null | undefined,
  trustProxy: boolean | number | undefined,
): string | undefined {
  const hops = trustProxy === true ? 1 : Number(trustProxy) || 0;
  if (hops <= 0 || !header) return undefined;
  const chain = (typeof header === 'string' ? header : header.join(','))
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return chain[Math.max(chain.length - hops, 0)];
}

export function clientAddress(req: IncomingMessage, opts: NodeRequestOptions = {}): string {
  return (
    forwardedAddress(req.headers['x-forwarded-for'], opts.trustProxy) ??
    req.socket.remoteAddress ??
    'unknown'
  );
}

export function isLoopback(address: string | undefined): boolean {
  return address === '127.0.0.1' || address === '::1' || address === '::ffff:127.0.0.1';
}

const PROXY_HEADERS = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-real-ip'];

/** Sent by a page on another origin, e.g. another dev server on localhost. */
function fromOtherSite(req: IncomingMessage): boolean {
  const site = req.headers['sec-fetch-site'];
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return true;
  const origin = req.headers.origin;
  if (origin === undefined) return false;
  try {
    return new URL(origin).host !== req.headers.host;
  } catch {
    return true;
  }
}

/**
 * Typed on this machine. Tunnels (ngrok, cloudflared) and reverse proxies also
 * connect from loopback, so the Host and proxy headers have to agree too, and
 * pages on other local origins don't count.
 */
export function isLocalRequest(req: IncomingMessage): boolean {
  return (
    isLoopback(req.socket.remoteAddress) &&
    isLoopbackHost(req.headers.host) &&
    !PROXY_HEADERS.some((name) => req.headers[name] !== undefined) &&
    !fromOtherSite(req)
  );
}

export function requestTarget(req: IncomingMessage): string {
  return req.url?.startsWith('/') ? req.url : '/';
}

export function requestHeaders(req: IncomingMessage): Headers {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const v of value) headers.append(key, v);
    else headers.set(key, value);
  }
  return headers;
}

/**
 * Starts reading only when the handler asks for the body. One it never asks for
 * (refused first, or too large by its Content-Length) Node then drains itself,
 * instead of it stalling the next request on a kept-alive connection.
 */
function requestBody(req: IncomingMessage): ReadableStream<Uint8Array> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        reader ??= (Readable.toWeb(req) as ReadableStream<Uint8Array>).getReader();
        const { done, value } = await reader.read();
        if (done) controller.close();
        else controller.enqueue(value);
      },
      cancel: (reason) => reader?.cancel(reason),
    },
    { highWaterMark: 0 },
  );
}

export function toWebRequest(req: IncomingMessage, opts: NodeRequestOptions = {}): Request {
  // Appended, not resolved: a target like `//evil.example/api` must stay a path.
  const url = new URL(`${requestOrigin(req, opts)}${requestTarget(req)}`);
  const headers = requestHeaders(req);
  const method = req.method ?? 'GET';
  const hasBody = method !== 'GET' && method !== 'HEAD';
  return new Request(url, {
    method,
    headers,
    body: hasBody ? requestBody(req) : undefined,
    // Required by Node's fetch for streamed request bodies.
    ...(hasBody ? { duplex: 'half' } : {}),
  } as RequestInit);
}

export async function sendWebResponse(res: ServerResponse, response: Response): Promise<void> {
  res.statusCode = response.status;
  // Answered before the body arrived: the rest of it would sit in front of the
  // next request a proxy sends down this connection.
  if (res.req && !res.req.complete) res.setHeader('connection', 'close');
  const cookies = response.headers.getSetCookie();
  for (const [key, value] of response.headers) {
    if (key === 'set-cookie') continue;
    res.setHeader(key, value);
  }
  if (cookies.length) res.setHeader('set-cookie', cookies);
  if (!response.body) {
    res.end();
    return;
  }
  const body = Buffer.from(await response.arrayBuffer());
  res.setHeader('content-length', body.byteLength);
  res.end(body);
}
