import type { IncomingMessage, ServerResponse } from 'node:http';

// Shared by the dev-only Studio endpoints that write to the project.

export class StudioError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function send(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  if (!req.headers['content-type']?.startsWith('application/json')) {
    throw new StudioError(415, 'Content-Type must be application/json.');
  }
  // Joined before decoding, so a character split across chunks stays whole.
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).byteLength;
    if (size > 64 * 1024) throw new StudioError(413, 'Body too large.');
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new StudioError(400, 'Body must be JSON.');
  }
}

export function assertSameOrigin(req: IncomingMessage): void {
  if (req.headers['sec-fetch-site'] === 'cross-site') {
    throw new StudioError(403, 'Cross-site request blocked.');
  }
  const origin = req.headers.origin;
  if (origin === undefined) return;
  let host: string | null = null;
  try {
    host = new URL(origin).host;
  } catch {}
  if (host !== req.headers.host) throw new StudioError(403, 'Origin mismatch.');
}
