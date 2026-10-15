import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { type InlineConfig, normalizePath } from 'vite';
import { DATA_DIR, resolveDatabasePath, secretPath } from '../node/secret.ts';
import type { OpenFormConfig } from '../schema/index.ts';
import { apiPlugin } from './api-plugin.ts';
import { formsPlugin } from './forms-plugin.ts';
import { locPlugin } from './loc-plugin.ts';
import {
  APP_ROOT,
  loadUserConfig,
  PACKAGE_NAME,
  PKG_ROOT,
  projectPaths,
  readPackageVersion,
  SRC_ROOT,
} from './project.ts';

const globEscape = (file: string) => normalizePath(file).replace(/[*?[\]{}()!+@\\]/g, '\\$&');

/**
 * Files the dev server must never serve, not even to localhost: `allow` covers
 * the whole project, which holds the responses database and the signing secret.
 * Setting `deny` replaces Vite's own list, so that list is repeated first.
 */
export function devServerDeny(databaseFile: string): string[] {
  return [
    '.env',
    '.env.*',
    '.envrc',
    '.dev.vars',
    '*.{crt,pem,key,p12,pfx,cer,der}',
    'id_{rsa,dsa,ecdsa,ed25519}*',
    '.npmrc',
    '.yarnrc.yml',
    '**/.git/**',
    `**/${DATA_DIR}/**`,
    // Other databases, and responses exported next to the project.
    '*.{db,sqlite,sqlite3}',
    '*.{db,sqlite,sqlite3}-{wal,shm,journal}',
    'responses*.{csv,xlsx,json}',
    '*-responses-*.{csv,xlsx,json}',
    // A custom `storage.path` / OPEN_FORM_DB, with its -wal / -shm / -journal files and secret.
    `${globEscape(databaseFile)}*`,
    globEscape(secretPath(databaseFile)),
  ];
}

export type CreateViteConfigOptions = {
  userCwd: string;
  config?: OpenFormConfig;
};

/**
 * The whole Vite setup lives here, inside the package — a workspace only has
 * `forms/`, `themes/` and `open-form.config.ts`.
 */
export async function createViteConfig(opts: CreateViteConfigOptions): Promise<InlineConfig> {
  const userCwd = path.resolve(opts.userCwd);
  const config = opts.config ?? (await loadUserConfig(userCwd));
  const paths = projectPaths(userCwd, config);
  const version = readPackageVersion();

  return {
    root: APP_ROOT,
    base: '/',
    configFile: false,
    envDir: userCwd,
    publicDir: path.join(userCwd, 'public'),
    plugins: [
      react(),
      tailwindcss(),
      locPlugin(paths),
      formsPlugin({ paths, config, version }),
      apiPlugin({ paths, config }),
    ],
    resolve: {
      // Forms import `@open-form-build/core`; point it at the same source the app uses so
      // the runtime (and its React contexts) exists exactly once.
      alias: [{ find: /^@open-form-build\/core$/, replacement: path.join(SRC_ROOT, 'index.ts') }],
      dedupe: ['react', 'react-dom'],
    },
    optimizeDeps: {
      entries: [path.join(APP_ROOT, 'main.tsx')],
      // Installed from npm, the alias lands in node_modules, so Vite would pre-bundle a
      // second copy of the runtime for forms and they'd lose the page's context.
      exclude: [PACKAGE_NAME],
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-router-dom',
        'lucide-react',
        'sonner',
      ],
      rolldownOptions: {
        plugins: [
          {
            name: 'open-form:virtual-externals',
            resolveId(id: string) {
              return id.startsWith('virtual:open-form/') ? { id, external: true } : null;
            },
          },
        ],
      },
    },
    ssr: {
      noExternal: [PACKAGE_NAME],
    },
    server: {
      port: config.port ?? 3000,
      // Vite answers CORS for every localhost origin by default, which would let
      // pages from other local dev servers read Studio's data.
      cors: false,
      ...(config.allowedHosts !== undefined ? { allowedHosts: config.allowedHosts } : {}),
      fs: {
        allow: [PKG_ROOT, userCwd, paths.formsRoot, paths.themesRoot],
        deny: devServerDeny(resolveDatabasePath(userCwd, config.storage?.path)),
      },
    },
    build: {
      outDir: path.join(userCwd, 'dist', 'client'),
      emptyOutDir: true,
    },
  };
}
