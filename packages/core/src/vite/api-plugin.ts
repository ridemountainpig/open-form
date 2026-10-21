import type { IncomingMessage } from 'node:http';
import type { Plugin, ViteDevServer } from 'vite';
import {
  clientAddress,
  isLocalRequest,
  requestHeaders,
  requestOrigin,
  sendWebResponse,
  toWebRequest,
} from '../node/http.ts';
import { resolveDatabasePath, resolveSecret } from '../node/secret.ts';
import type { OpenFormConfig } from '../schema/index.ts';
import {
  type AdminAuth,
  adminPasswordProblem,
  createAdminGate,
  createOpenFormHandler,
  createSigner,
  type FormDefinition,
  type FormRegistry,
  type OpenFormHandler,
  type StorageAdapter,
} from '../server/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';
import { DEFINITION_MODULE, findForms, formUpdatedAt, type ProjectPaths } from './project.ts';
import { studioCommentsMiddleware } from './studio-comments.ts';
import { studioCurrentMiddleware } from './studio-current.ts';
import { studioFoldersMiddleware } from './studio-folders.ts';
import { studioFontsMiddleware } from './studio-fonts.ts';
import { studioFormsMiddleware } from './studio-forms.ts';
import { studioSourceMiddleware } from './studio-source.ts';

export type ApiPluginOptions = {
  paths: ProjectPaths;
  config: OpenFormConfig;
};

type DefinitionModule = {
  toFormDefinition(id: string, mod: unknown): FormDefinition;
};

/**
 * Forms are loaded through Vite's SSR module graph, so the server sees every
 * edit immediately and shares one copy of the runtime with the form module.
 */
export function createDevRegistry(server: ViteDevServer, paths: ProjectPaths): FormRegistry {
  const cache = new WeakMap<object, FormDefinition>();
  return {
    async list() {
      return findForms(paths.formsRoot).map((f) => f.id);
    },
    async load(id) {
      const entry = findForms(paths.formsRoot).find((f) => f.id === id);
      if (!entry) return null;
      const mod = (await server.ssrLoadModule(entry.file)) as object;
      const cached = cache.get(mod);
      if (cached) return cached;
      const { toFormDefinition } = (await server.ssrLoadModule(
        DEFINITION_MODULE,
      )) as DefinitionModule;
      const def = toFormDefinition(id, mod);
      cache.set(mod, def);
      return def;
    },
    async updatedAt(id) {
      const entry = findForms(paths.formsRoot).find((f) => f.id === id);
      return entry ? formUpdatedAt(entry.file) : undefined;
    },
  };
}

export function apiPlugin(opts: ApiPluginOptions): Plugin {
  const { paths, config } = opts;
  return {
    name: 'open-form:api',
    apply: 'serve',
    configureServer(server) {
      let storage: Promise<StorageAdapter> | undefined;
      let handler: Promise<OpenFormHandler> | undefined;
      const databasePath = resolveDatabasePath(paths.userCwd, config.storage?.path);
      const getStorage = () => (storage ??= createSqliteStorage({ path: databasePath }));
      const sockets = new WeakMap<Request, IncomingMessage>();
      const secret = resolveSecret(paths.userCwd, databasePath);
      const adminPassword = process.env.OPEN_FORM_ADMIN_PASSWORD || undefined;
      const passwordProblem = adminPassword && adminPasswordProblem(adminPassword);
      if (passwordProblem) throw new Error(`OPEN_FORM_ADMIN_PASSWORD: ${passwordProblem}`);

      let warned = false;
      // Without a password, Studio is open to direct requests on this machine.
      // With one, everyone signs in: a reverse proxy or a raw TCP tunnel
      // (ssh -R, socat) can make a remote request look local.
      const adminAuth: AdminAuth = {
        password: adminPassword,
        authorize(request) {
          if (adminPassword) return false;
          const req = sockets.get(request);
          if (req && isLocalRequest(req)) return true;
          if (!warned) {
            warned = true;
            server.config.logger.warn(
              `[open-form] Studio refused a request from ${req?.headers.origin ?? req?.headers.host ?? 'another host'}: it is only open to direct requests on this machine. Set OPEN_FORM_ADMIN_PASSWORD to sign in through a network, tunnel or proxy.`,
            );
          }
          return false;
        },
      };
      const gate = createAdminGate(adminAuth, createSigner(secret), {
        revocations: {
          revokeSession: async (...args) => (await getStorage()).revokeSession(...args),
          isSessionRevoked: async (id) => (await getStorage()).isSessionRevoked(id),
        },
      });
      const authorize = async (req: IncomingMessage) => {
        const request = new Request(
          new URL(req.url ?? '/', requestOrigin(req, { trustProxy: config.trustProxy })),
          { headers: requestHeaders(req) },
        );
        sockets.set(request, req);
        return (await gate.check(request)) !== null;
      };

      const getHandler = () => {
        handler ??= (async () => {
          return createOpenFormHandler({
            registry: createDevRegistry(server, paths),
            storage: await getStorage(),
            config,
            secret,
            exposeErrors: true,
            adminAuth,
            webhookSecret: process.env.OPEN_FORM_WEBHOOK_SECRET || undefined,
            clientAddress: (request) => {
              const req = sockets.get(request);
              return req ? clientAddress(req, { trustProxy: config.trustProxy }) : undefined;
            },
          });
        })();
        return handler;
      };

      server.httpServer?.once('close', () => {
        void storage?.then((s) => s.close());
      });

      server.middlewares.use(studioFontsMiddleware({ authorize }));
      server.middlewares.use(studioFoldersMiddleware({ paths, authorize }));
      server.middlewares.use(
        studioFormsMiddleware({ server, paths, config, getStorage, authorize }),
      );
      server.middlewares.use(studioCommentsMiddleware({ paths, authorize }));
      server.middlewares.use(studioCurrentMiddleware({ paths, authorize }));
      server.middlewares.use(studioSourceMiddleware({ paths, authorize }));

      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        if (url !== '/api' && !url.startsWith('/api/') && !url.startsWith('/api?')) return next();
        try {
          const request = toWebRequest(req, { trustProxy: config.trustProxy });
          sockets.set(request, req);
          await sendWebResponse(res, await (await getHandler())(request));
        } catch (err) {
          next(err);
        }
      });
    },
  };
}
