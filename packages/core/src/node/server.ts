import { createReadStream, existsSync, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { OpenFormConfig } from '../schema/index.ts';
import {
  adminPasswordProblem,
  createOpenFormHandler,
  type FormDefinition,
  type FormRegistry,
  type OpenFormHandler,
} from '../server/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';
import {
  clientAddress,
  parseTrustProxy,
  requestTarget,
  sendWebResponse,
  toWebRequest,
} from './http.ts';
import { resolveDatabasePath, resolveSecret } from './secret.ts';

/** What `open-form build` emits at `dist/server/entry.js`. */
export type ServerEntry = {
  config: OpenFormConfig;
  formIds: string[];
  loadFormDefinition(id: string): Promise<FormDefinition | null>;
  formUpdatedAt?: Record<string, string | undefined>;
  folders?: unknown;
};

export type StartServerOptions = {
  root: string;
  port?: number;
  host?: string;
  outDir?: string;
};

export type StartedServer = {
  server: http.Server;
  url: string;
  adminEnabled: boolean;
  forms: string[];
  close(): Promise<void>;
};

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
};

export function createEntryRegistry(entry: ServerEntry): FormRegistry {
  const cache = new Map<string, Promise<FormDefinition | null>>();
  return {
    async list() {
      return entry.formIds;
    },
    load(id) {
      if (!entry.formIds.includes(id)) return Promise.resolve(null);
      let pending = cache.get(id);
      if (!pending) {
        pending = entry.loadFormDefinition(id);
        cache.set(id, pending);
      }
      return pending;
    },
    async updatedAt(id) {
      return entry.formUpdatedAt?.[id];
    },
    async folders() {
      return entry.folders;
    },
  };
}

function resolveStatic(clientDir: string, pathname: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const file = path.resolve(clientDir, `.${path.posix.normalize(decoded)}`);
  if (!file.startsWith(clientDir + path.sep)) return null;
  if (!existsSync(file) || !statSync(file).isFile()) return null;
  return file;
}

function sendFile(res: ServerResponse, file: string, immutable: boolean): void {
  res.statusCode = 200;
  res.setHeader(
    'content-type',
    MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
  );
  res.setHeader(
    'cache-control',
    immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=0, must-revalidate',
  );
  res.setHeader('x-content-type-options', 'nosniff');
  // The file can vanish between the stat and the read (a rebuild): end the
  // response instead of crashing the process on an unhandled stream error.
  createReadStream(file)
    .on('error', () => {
      if (!res.headersSent) res.statusCode = 404;
      res.destroy();
    })
    .pipe(res);
}

export function pageHeaders(
  page: 'studio' | 'form',
  config: OpenFormConfig,
): Record<string, string> {
  if (page === 'studio') {
    return {
      'content-security-policy': "frame-ancestors 'self'",
      'x-frame-options': 'SAMEORIGIN',
      'referrer-policy': 'same-origin',
      'x-content-type-options': 'nosniff',
    };
  }
  const origins = config.embed?.origins ?? [];
  return {
    'content-security-policy': `frame-ancestors ${
      origins.includes('*') ? '*' : ["'self'", ...origins].join(' ')
    }`,
    ...(origins.length ? {} : { 'x-frame-options': 'SAMEORIGIN' }),
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-content-type-options': 'nosniff',
  };
}

/** Production server: the built app, the API, and SQLite. No other services. */
export async function startServer(opts: StartServerOptions): Promise<StartedServer> {
  const root = path.resolve(opts.root);
  const outDir = path.resolve(root, opts.outDir ?? 'dist');
  const clientDir = path.join(outDir, 'client');
  const entryFile = path.join(outDir, 'server', 'entry.js');
  if (!existsSync(entryFile) || !existsSync(path.join(clientDir, 'index.html'))) {
    throw new Error(`No production build found in ${outDir}. Run \`open-form build\` first.`);
  }

  const entry = (await import(pathToFileURL(entryFile).href)) as ServerEntry;
  const config = entry.config ?? {};
  const registry = createEntryRegistry(entry);

  // Render every form once at startup so a broken form fails the deploy, not a respondent.
  for (const id of entry.formIds) await registry.load(id);

  const storage = await createSqliteStorage({
    path: resolveDatabasePath(root, config.storage?.path),
  });
  const adminPassword = process.env.OPEN_FORM_ADMIN_PASSWORD || undefined;
  const adminEnabled = Boolean(adminPassword);
  const passwordProblem = adminPassword && adminPasswordProblem(adminPassword);
  if (passwordProblem) throw new Error(`OPEN_FORM_ADMIN_PASSWORD: ${passwordProblem}`);
  const envTrustProxy = parseTrustProxy(process.env.OPEN_FORM_TRUST_PROXY);
  const trustProxy = config.trustProxy ?? envTrustProxy ?? false;
  const sockets = new WeakMap<Request, IncomingMessage>();

  const handler: OpenFormHandler = createOpenFormHandler({
    registry,
    storage,
    config,
    secret: resolveSecret(root),
    adminAuth: adminPassword ? { password: adminPassword } : undefined,
    webhookSecret: process.env.OPEN_FORM_WEBHOOK_SECRET || undefined,
    clientAddress: (request) => {
      const req = sockets.get(request);
      return req ? clientAddress(req, { trustProxy }) : undefined;
    },
    secureCookies: process.env.OPEN_FORM_SECURE_COOKIES !== '0' && Boolean(trustProxy),
  });

  const indexHtml = await readFile(path.join(clientDir, 'index.html'));
  // Studio signs in inside the page, so the shell itself is not secret; what
  // matters is that nobody can frame it. Forms may be framed by `embed.origins`.
  const sendIndex = (res: ServerResponse, page: 'studio' | 'form', status = 200) => {
    res.statusCode = status;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.setHeader('cache-control', 'no-cache');
    for (const [key, value] of Object.entries(pageHeaders(page, config))) res.setHeader(key, value);
    res.end(indexHtml);
  };

  let warnedProxy = false;
  const server = http.createServer(async (req, res) => {
    try {
      if (!trustProxy && !warnedProxy && req.headers['x-forwarded-for']) {
        warnedProxy = true;
        console.warn(
          "[open-form] Requests come through a proxy (X-Forwarded-For) but OPEN_FORM_TRUST_PROXY is not set, so every visitor shares the proxy's address: one person can use up a form's rate limit for everyone and lock everyone out of Studio sign-in. Set OPEN_FORM_TRUST_PROXY to the number of proxies in front of the server (usually 1).",
        );
      }
      const pathname = new URL(`http://localhost${requestTarget(req)}`).pathname;

      if (pathname === '/api' || pathname.startsWith('/api/')) {
        const request = toWebRequest(req, { trustProxy });
        sockets.set(request, req);
        await sendWebResponse(res, await handler(request));
        return;
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.statusCode = 405;
        res.end();
        return;
      }

      const file = resolveStatic(clientDir, pathname);
      if (file && pathname !== '/index.html') {
        sendFile(res, file, pathname.startsWith('/assets/'));
        return;
      }

      if (pathname === '/' || pathname === '/studio' || pathname.startsWith('/studio/')) {
        if (!adminEnabled) {
          sendIndex(res, 'form', 404);
          return;
        }
        if (pathname === '/') {
          res.statusCode = 302;
          res.setHeader('location', '/studio');
          res.end();
          return;
        }
        sendIndex(res, 'studio');
        return;
      }
      sendIndex(res, 'form', pathname.startsWith('/f/') ? 200 : 404);
    } catch (err) {
      console.error('[open-form]', err);
      if (!res.headersSent) res.statusCode = 500;
      res.end();
    }
  });

  const port = opts.port ?? (Number(process.env.PORT) || config.port || 3000);
  const host = opts.host ?? process.env.HOST ?? '0.0.0.0';
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolve);
  });
  const address = server.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;

  return {
    server,
    url: `http://${host === '0.0.0.0' ? 'localhost' : host}:${actualPort}`,
    adminEnabled,
    forms: entry.formIds,
    async close() {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await storage.close();
    },
  };
}
