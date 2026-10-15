import { createServer, type IncomingMessage, type Server } from 'node:http';
import net, { type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clientAddress,
  isLocalRequest,
  parseTrustProxy,
  sendWebResponse,
  toWebRequest,
} from './http.ts';

function request(headers: Record<string, string>, remoteAddress = '127.0.0.1') {
  return { headers, socket: { remoteAddress } } as unknown as IncomingMessage;
}

describe('clientAddress', () => {
  it('ignores X-Forwarded-For unless a proxy is trusted', () => {
    expect(clientAddress(request({ 'x-forwarded-for': '1.2.3.4' }, '10.0.0.2'))).toBe('10.0.0.2');
  });

  it('reads from the right so clients cannot pick their own address', () => {
    const spoofed = request({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7' }, '10.0.0.2');
    expect(clientAddress(spoofed, { trustProxy: true })).toBe('203.0.113.7');
    expect(clientAddress(spoofed, { trustProxy: 1 })).toBe('203.0.113.7');
  });

  it('skips one entry per trusted proxy', () => {
    const chain = request({ 'x-forwarded-for': '6.6.6.6, 203.0.113.7, 10.0.0.1' }, '10.0.0.2');
    expect(clientAddress(chain, { trustProxy: 2 })).toBe('203.0.113.7');
    expect(clientAddress(chain, { trustProxy: 5 })).toBe('6.6.6.6');
  });

  it('falls back to the socket without the header', () => {
    expect(clientAddress(request({}, '10.0.0.2'), { trustProxy: true })).toBe('10.0.0.2');
  });
});

describe('isLocalRequest', () => {
  it('accepts direct requests on this machine', () => {
    expect(isLocalRequest(request({ host: 'localhost:3000' }))).toBe(true);
    expect(isLocalRequest(request({ host: '127.0.0.1:3000' }, '::ffff:127.0.0.1'))).toBe(true);
    expect(isLocalRequest(request({ host: '[::1]:3000' }, '::1'))).toBe(true);
    expect(isLocalRequest(request({ host: 'forms.localhost:3000' }))).toBe(true);
  });

  it('refuses other machines', () => {
    expect(isLocalRequest(request({ host: 'localhost:3000' }, '192.168.1.20'))).toBe(false);
  });

  it('refuses tunnels and proxies that connect from loopback', () => {
    expect(isLocalRequest(request({ host: 'abc.ngrok.app' }))).toBe(false);
    expect(isLocalRequest(request({ host: 'localhost:3000', 'x-forwarded-for': '1.2.3.4' }))).toBe(
      false,
    );
    expect(isLocalRequest(request({ host: 'localhost:3000', forwarded: 'for=1.2.3.4' }))).toBe(
      false,
    );
    expect(isLocalRequest(request({}))).toBe(false);
  });

  it('refuses pages on other origins, even on localhost', () => {
    const studio = { host: 'localhost:3000' };
    expect(isLocalRequest(request({ ...studio, 'sec-fetch-site': 'same-origin' }))).toBe(true);
    expect(isLocalRequest(request({ ...studio, 'sec-fetch-site': 'none' }))).toBe(true);
    expect(
      isLocalRequest(
        request({ ...studio, origin: 'http://localhost:3000', 'sec-fetch-site': 'same-origin' }),
      ),
    ).toBe(true);
    expect(isLocalRequest(request({ ...studio, 'sec-fetch-site': 'same-site' }))).toBe(false);
    expect(isLocalRequest(request({ ...studio, origin: 'http://localhost:5173' }))).toBe(false);
    expect(isLocalRequest(request({ ...studio, origin: 'null' }))).toBe(false);
  });
});

describe('toWebRequest', () => {
  it('keeps the request target on this origin', () => {
    const req = {
      url: '//evil.example/api/forms',
      method: 'GET',
      headers: { host: 'localhost:3000' },
      socket: { remoteAddress: '127.0.0.1' },
    } as unknown as IncomingMessage;
    const url = new URL(toWebRequest(req).url);
    expect(url.origin).toBe('http://localhost:3000');
    expect(url.pathname).toBe('//evil.example/api/forms');
  });
});

describe('parseTrustProxy', () => {
  it('reads true, false and a number of proxies', () => {
    expect(parseTrustProxy(undefined)).toBeUndefined();
    expect(parseTrustProxy(' ')).toBeUndefined();
    expect(parseTrustProxy('true')).toBe(true);
    expect(parseTrustProxy('TRUE')).toBe(true);
    expect(parseTrustProxy('False')).toBe(false);
    expect(parseTrustProxy('0')).toBe(0);
    expect(parseTrustProxy(' 2 ')).toBe(2);
  });

  it('refuses anything else instead of ignoring it', () => {
    for (const value of ['yes', '1.5', '-1', 'one']) {
      expect(() => parseTrustProxy(value)).toThrow(/OPEN_FORM_TRUST_PROXY/);
    }
  });
});

describe('a body the handler never read', () => {
  let server: Server | undefined;
  afterEach(() => server?.close());

  /** Sends `first`, then a GET down the same connection, as a reverse proxy reusing it would. */
  async function pipelined(handle: (request: Request) => Promise<Response>, first: string) {
    server = createServer(async (req, res) => {
      await sendWebResponse(res, await handle(toWebRequest(req)));
    });
    await new Promise<void>((resolve) => server?.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    const socket = net.connect(port, '127.0.0.1');
    let text = '';
    socket.on('data', (chunk) => {
      text += chunk.toString('latin1');
    });
    // Closing with part of the body unread may reset the connection while we still write.
    socket.on('error', () => {});
    socket.write(first, () => socket.write('GET /second HTTP/1.1\r\nHost: x\r\n\r\n'));
    const until = Date.now() + 1500;
    while (Date.now() < until && !socket.closed && (text.match(/HTTP\/1\.1 /g) ?? []).length < 2) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    const closed = socket.closed;
    socket.destroy();
    return { statuses: text.match(/HTTP\/1\.1 \d+/g), text: text.toLowerCase(), closed };
  }

  const post = (size: number) =>
    `POST /first HTTP/1.1\r\nHost: x\r\nContent-Type: application/json\r\nContent-Length: ${size}\r\n\r\n${'x'.repeat(size)}`;
  const refuseLater = async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return new Response('{}', { status: 404 });
  };

  it('closes the connection instead of stalling behind a large body', async () => {
    const { statuses, text, closed } = await pipelined(refuseLater, post(200 * 1024));
    expect(statuses).toEqual(['HTTP/1.1 404']);
    expect(text).toContain('connection: close');
    expect(closed).toBe(true);
  });

  it('closes the connection when it answers before the body arrived', async () => {
    const refuse = async () => new Response('{}', { status: 413 });
    const { statuses, text, closed } = await pipelined(refuse, post(200 * 1024).slice(0, 1024));
    expect(statuses).toEqual(['HTTP/1.1 413']);
    expect(text).toContain('connection: close');
    expect(closed).toBe(true);
  });

  it('drains a small one and keeps the connection', async () => {
    const { statuses, text } = await pipelined(refuseLater, post(2048));
    expect(statuses).toEqual(['HTTP/1.1 404', 'HTTP/1.1 404']);
    expect(text).not.toContain('connection: close');
  });

  it('keeps the connection after a body that was read', async () => {
    const echo = async (request: Request) =>
      new Response(request.method === 'POST' ? await request.text() : 'ok');
    const { statuses, text } = await pipelined(echo, post(10));
    expect(statuses).toEqual(['HTTP/1.1 200', 'HTTP/1.1 200']);
    expect(text).not.toContain('connection: close');
  });
});
