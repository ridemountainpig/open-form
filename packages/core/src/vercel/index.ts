import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { forwardedAddress, parseTrustProxy } from '../node/http.ts';
import { resolveDatabasePath, resolveSecret, secretPath } from '../node/secret.ts';
import {
  createEntryRegistry,
  inlineScriptHashes,
  pageHeaders,
  pageRoute,
  type ServerEntry,
} from '../node/server.ts';
import { openStorage, resolveStorage } from '../node/storage.ts';
import { studioProblem } from '../schema/index.ts';
import {
  adminPasswordProblem,
  createOpenFormHandler,
  type OpenFormHandler,
  type StorageAdapter,
} from '../server/index.ts';

export type OpenFormAppOptions = {
  /** Project root: where `open-form.config.ts` and `dist/` live. Default `process.cwd()`. */
  root?: string;
  /** `open-form build` output directory. Default `dist`. */
  outDir?: string;
  /** Default: Postgres at `OPEN_FORM_DATABASE_URL` or `storage.url`. */
  storage?: StorageAdapter;
  /** Default: `OPEN_FORM_SECRET`. */
  secret?: string;
  /** Keep webhook deliveries alive after the response: `waitUntil` from `@vercel/functions`. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

export type OpenFormApp = { fetch(request: Request): Promise<Response> };

const DOCS = 'https://open-form.build/docs/deploy/vercel';

const errorCode = (err: unknown) =>
  (err as NodeJS.ErrnoException | undefined)?.code ?? (err instanceof Error ? err.message : err);

type App = {
  handler: OpenFormHandler;
  indexHtml: string;
  scriptHashes: string[];
  studio: boolean;
  config: ServerEntry['config'];
};

/**
 * A whole Open Form project as one Vercel Function: `export default createOpenFormApp()`
 * in `api/index.ts`. It answers the API and the page shells; Vercel serves
 * `dist/client` itself and rewrites every other path here.
 */
export function createOpenFormApp(opts: OpenFormAppOptions = {}): OpenFormApp {
  const root = path.resolve(opts.root ?? process.cwd());
  const outDir = path.resolve(root, opts.outDir ?? 'dist');
  const entryFile = path.join(outDir, 'server', 'entry.js');
  const indexFile = path.join(outDir, 'client', 'index.html');

  const setUp = async (): Promise<App> => {
    if (!existsSync(entryFile) || !existsSync(indexFile)) {
      throw new Error(
        `No production build at ${path.relative(root, outDir) || '.'}. Run \`open-form build\` as the build command, and add "includeFiles": "dist/**" to the function in vercel.json (${DOCS}).`,
      );
    }
    const entry = (await import(/* @vite-ignore */ pathToFileURL(entryFile).href)) as ServerEntry;
    const config = entry.config ?? {};
    const adminPassword = process.env.OPEN_FORM_ADMIN_PASSWORD || undefined;
    const passwordProblem = adminPassword && adminPasswordProblem(adminPassword);
    if (passwordProblem) throw new Error(`OPEN_FORM_ADMIN_PASSWORD: ${passwordProblem}`);
    const studioConfigProblem = studioProblem(config.studio);
    if (studioConfigProblem) throw new Error(`open-form.config.ts: ${studioConfigProblem}`);
    const publicStudio = config.studio?.public === 'read-only';
    const trustProxy = config.trustProxy ?? parseTrustProxy(process.env.OPEN_FORM_TRUST_PROXY) ?? 1;

    const target = resolveStorage(root, config);
    let storage = opts.storage;
    if (!storage) {
      try {
        storage = await openStorage(target);
      } catch (err) {
        throw new Error(
          target.kind === 'sqlite'
            ? `Couldn't open the SQLite database at ${target.path} (${errorCode(err)}). Vercel has no persistent disk: set OPEN_FORM_DATABASE_URL to a Postgres database (${DOCS}).`
            : `Couldn't connect to Postgres (${errorCode(err)}).`,
        );
      }
    }
    let secret = opts.secret;
    if (!secret) {
      const databasePath = resolveDatabasePath(root, config.storage?.path);
      try {
        secret = resolveSecret(root, databasePath);
      } catch (err) {
        throw new Error(
          `Couldn't create the signing secret at ${secretPath(databasePath)} (${errorCode(err)}). Set OPEN_FORM_SECRET (${DOCS}).`,
        );
      }
    }

    const handler = createOpenFormHandler({
      registry: createEntryRegistry(entry),
      storage,
      config,
      secret,
      adminAuth: adminPassword ? { password: adminPassword } : undefined,
      publicStudio: publicStudio ? 'read-only' : undefined,
      webhookSecret: process.env.OPEN_FORM_WEBHOOK_SECRET || undefined,
      waitUntil: opts.waitUntil,
      clientAddress: (request) =>
        forwardedAddress(request.headers.get('x-forwarded-for'), trustProxy),
    });
    const indexHtml = await readFile(indexFile, 'utf8');
    return {
      handler,
      indexHtml,
      scriptHashes: inlineScriptHashes(indexHtml),
      studio: Boolean(adminPassword) || publicStudio,
      config,
    };
  };

  let app: Promise<App> | undefined;
  const current = () => {
    app ??= setUp().catch((err) => {
      app = undefined;
      throw err;
    });
    return app;
  };

  return {
    async fetch(request) {
      const { handler, indexHtml, scriptHashes, studio, config } = await current();
      const url = new URL(request.url);
      if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return handler(request);
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        return new Response(null, { status: 405 });
      }
      const route = pageRoute(url.pathname, { studio });
      if ('redirect' in route) {
        return new Response(null, { status: 302, headers: { location: route.redirect } });
      }
      const headers = pageHeaders(route.page, config, {
        scriptHashes,
        https: url.protocol === 'https:',
      });
      return new Response(request.method === 'HEAD' ? null : indexHtml, {
        status: route.status,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'cache-control': 'no-cache',
          ...headers,
        },
      });
    },
  };
}
