import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { forwardedAddress } from '../node/http.ts';
import { DATA_DIR, resolveDatabasePath, resolveSecret } from '../node/secret.ts';
import { createEntryRegistry, type ServerEntry } from '../node/server.ts';
import type { OpenFormConfig } from '../schema/index.ts';
import {
  type AdminAuth,
  createOpenFormHandler,
  type FormRegistry,
  type OpenFormHandler,
  type StorageAdapter,
} from '../server/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';

export type OpenFormRouteOptions = {
  /** Project root: where `forms/`, `open-form.config.ts` and `dist/` live. Default `process.cwd()`. */
  root?: string;
  /** `open-form build` output directory. Default `dist`. */
  outDir?: string;
  /** Default: SQLite at `OPEN_FORM_DB`, else `.open-form/open-form.db`. Needs a persistent disk. */
  storage?: StorageAdapter;
  /** Default: `OPEN_FORM_SECRET`, else a generated `.open-form/secret`. */
  secret?: string;
  /**
   * Who may use the admin API. Default: sign in with `OPEN_FORM_ADMIN_PASSWORD`
   * when it's set; otherwise there is no admin API.
   */
  adminAuth?: AdminAuth;
  /** Where the route is mounted. Default `/api` (`app/api/[...openform]/route.ts`). */
  basePath?: string;
  /**
   * Proxies in front of Next.js that append to `X-Forwarded-For`. Default `1`:
   * Vercel and a reverse proxy in front of `next start` put the client's address
   * last. Without a proxy, Next.js keeps the header the client sent, so rate
   * limits can't tell clients apart — don't expose `next start` directly.
   */
  trustProxy?: boolean | number;
  /** Keep webhook deliveries alive after the response, e.g. `after` from `next/server`. */
  waitUntil?: (promise: Promise<unknown>) => void;
};

type RouteHandler = (request: Request) => Promise<Response>;

export type OpenFormRoute = {
  GET: RouteHandler;
  POST: RouteHandler;
  PUT: RouteHandler;
  DELETE: RouteHandler;
  OPTIONS: RouteHandler;
};

type Loaded = { mtimeMs: number; entry: ServerEntry; registry: FormRegistry };

const DOCS = 'https://open-form.build/docs/deploy/nextjs';

const errorCode = (err: unknown) =>
  (err as NodeJS.ErrnoException | undefined)?.code ?? (err instanceof Error ? err.message : err);

/** Serverless functions can't write next to the app, so the secret has to come from the environment. */
function defaultSecret(root: string): string {
  try {
    return resolveSecret(root);
  } catch (err) {
    throw new Error(
      `Couldn't create the signing secret in ${path.join(root, DATA_DIR)} (${errorCode(err)}). ` +
        `Set OPEN_FORM_SECRET, as you must on Vercel and other read-only hosts (${DOCS}).`,
    );
  }
}

async function defaultStorage(file: string): Promise<StorageAdapter> {
  try {
    return await createSqliteStorage({ path: file });
  } catch (err) {
    throw new Error(
      `Couldn't open the SQLite database at ${file} (${errorCode(err)}). ` +
        `It needs a persistent, writable disk; on serverless hosts pass \`storage\` to createOpenFormRoute() (${DOCS}).`,
    );
  }
}

/**
 * Route handlers for Next.js: `export const { GET, POST, PUT, DELETE, OPTIONS } = createOpenFormRoute()`.
 *
 * Forms are read from the server bundle `open-form build` writes (it carries its
 * own React), because App Router route handlers can't render the forms to learn
 * their fields. Outside production a rebuilt bundle is picked up on the next request.
 */
export function createOpenFormRoute(opts: OpenFormRouteOptions = {}): OpenFormRoute {
  const root = path.resolve(opts.root ?? process.cwd());
  const entryFile = path.join(root, opts.outDir ?? 'dist', 'server', 'entry.js');
  const watch = process.env.NODE_ENV !== 'production';
  let loaded: Promise<Loaded> | undefined;

  const loadEntry = async (): Promise<Loaded> => {
    if (!existsSync(entryFile)) {
      const bundle = path.relative(root, entryFile).split(path.sep).join('/');
      throw new Error(
        `No Open Form server bundle at ${bundle}. Run \`open-form build --server-only\` before \`next build\` / \`next dev\`. ` +
          `Deployed with \`output: 'standalone'\` or to Vercel? Next.js can't see the bundle on its own: add './${path.posix.dirname(bundle)}/**/*' to \`outputFileTracingIncludes\` in next.config (${DOCS}).`,
      );
    }
    const { mtimeMs } = statSync(entryFile);
    // `webpackIgnore` / `turbopackIgnore`: the bundle is loaded by Node, not bundled again.
    const entry = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ `${
        pathToFileURL(entryFile).href
      }?v=${mtimeMs}`
    )) as ServerEntry;
    return { mtimeMs, entry, registry: createEntryRegistry(entry) };
  };

  const reload = () => {
    loaded = loadEntry().catch((err) => {
      loaded = undefined;
      throw err;
    });
    return loaded;
  };
  const current = async (): Promise<Loaded> => {
    const previous = await (loaded ?? reload());
    if (watch && existsSync(entryFile) && statSync(entryFile).mtimeMs !== previous.mtimeMs) {
      return reload();
    }
    return previous;
  };

  const registry: FormRegistry = {
    list: async () => (await current()).registry.list(),
    load: async (id) => (await current()).registry.load(id),
    updatedAt: async (id) => (await current()).registry.updatedAt?.(id),
  };

  let storage: Promise<StorageAdapter> | undefined;
  let secret: string | undefined;
  const createHandler = async ({ entry }: Loaded): Promise<OpenFormHandler> => {
    const config: OpenFormConfig = entry.config ?? {};
    const adminPassword = process.env.OPEN_FORM_ADMIN_PASSWORD || undefined;
    const trustProxy = opts.trustProxy ?? config.trustProxy ?? 1;
    storage ??= opts.storage
      ? Promise.resolve(opts.storage)
      : defaultStorage(resolveDatabasePath(root, config.storage?.path)).catch((err) => {
          storage = undefined;
          throw err;
        });
    secret ??= opts.secret ?? defaultSecret(root);
    return createOpenFormHandler({
      registry,
      storage: await storage,
      config,
      secret,
      basePath: opts.basePath,
      adminAuth: opts.adminAuth ?? (adminPassword ? { password: adminPassword } : undefined),
      webhookSecret: process.env.OPEN_FORM_WEBHOOK_SECRET || undefined,
      waitUntil: opts.waitUntil,
      exposeErrors: watch,
      clientAddress: (request) =>
        forwardedAddress(request.headers.get('x-forwarded-for'), trustProxy),
    });
  };

  // A rebuilt bundle can carry a changed open-form.config.ts, so the handler follows it.
  let handler: { loaded: Loaded; handler: Promise<OpenFormHandler> } | undefined;
  const handle: RouteHandler = async (request) => {
    const now = await current();
    if (handler?.loaded !== now) {
      const created = createHandler(now);
      handler = { loaded: now, handler: created };
      created.catch(() => {
        if (handler?.handler === created) handler = undefined;
      });
    }
    return (await handler.handler)(request);
  };
  return { GET: handle, POST: handle, PUT: handle, DELETE: handle, OPTIONS: handle };
}
