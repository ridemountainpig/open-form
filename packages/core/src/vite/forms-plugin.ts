import { existsSync } from 'node:fs';
import path from 'node:path';
import { normalizePath, type Plugin, type ViteDevServer } from 'vite';
import { foldersPath, readManifest } from '../editing/folders.ts';
import { readThemeDoc } from '../editing/theme-files.ts';
import type { OpenFormConfig } from '../schema/index.ts';
import { displayPath } from './form-files.ts';
import {
  CONFIG_FILE,
  DEFINITION_MODULE,
  findForms,
  formIdForFile,
  formUpdatedAt,
  type ProjectPaths,
  resolveThemes,
  type ThemeEntry,
  themeIdForFile,
} from './project.ts';

export const FORMS_VMOD = 'virtual:open-form/forms';
export const THEMES_VMOD = 'virtual:open-form/themes';
export const CONFIG_VMOD = 'virtual:open-form/config';
export const SERVER_ENTRY_VMOD = 'virtual:open-form/server-entry';
const VMODS = [FORMS_VMOD, THEMES_VMOD, CONFIG_VMOD, SERVER_ENTRY_VMOD];

export type FormsPluginOptions = {
  paths: ProjectPaths;
  config: OpenFormConfig;
  version: string;
  /** Reference themes to leave out of a build: ones that fail to load. */
  skipThemes?: readonly string[];
};

/** Client view of the project config: only what the browser needs. */
export function clientConfig(config: OpenFormConfig, version: string, dev: boolean) {
  return {
    version,
    dev,
    locale: config.locale ?? 'en',
  };
}

function formsModule(paths: ProjectPaths, dev: boolean): string {
  const forms = findForms(paths.formsRoot);
  const ids = JSON.stringify(forms.map((f) => f.id));
  if (!dev) {
    const cases = forms
      .map((f) => `    case ${JSON.stringify(f.id)}: return import(${JSON.stringify(f.file)});`)
      .join('\n');
    return `export const formIds = ${ids};
export function loadForm(id) {
  switch (id) {
${cases}
    default: return Promise.reject(new Error('Form not found: ' + id));
  }
}
`;
  }
  // Dev: re-import a changed form through a cache-busting query so the app can
  // swap it in place (forms export a non-component `config`, which React Fast
  // Refresh can't hot-swap on its own).
  const tokens = JSON.stringify(Object.fromEntries(forms.map((f) => [f.id, 0])));
  const cases = forms
    .map((f) => {
      const url = `@fs/${normalizePath(f.file).replace(/^\/+/, '')}`;
      return `    case ${JSON.stringify(f.id)}: return import(/* @vite-ignore */ import.meta.env.BASE_URL + ${JSON.stringify(`${url}?t=`)} + tokens[${JSON.stringify(f.id)}]);`;
    })
    .join('\n');
  return `export const formIds = ${ids};
const tokens = ${tokens};
if (import.meta.hot) {
  import.meta.hot.on('open-form:form-changed', (data) => {
    for (const id of data?.formIds ?? []) if (id in tokens) tokens[id] = data.timestamp;
  });
}
export function loadForm(id) {
  switch (id) {
${cases}
    default: return Promise.reject(new Error('Form not found: ' + id));
  }
}
`;
}

/** What Studio's Themes pages show about a reference besides running it: its THEME.md. */
export async function themeInfo(paths: ProjectPaths, entry: ThemeEntry) {
  const doc = await readThemeDoc(entry.file);
  return {
    id: entry.id,
    name: doc.name ?? entry.id,
    description: doc.description,
    layout: doc.layout,
    doc: doc.doc,
    file: displayPath(paths, entry.file),
  };
}

// The project's themes are references for new forms, shown read-only in Studio's
// Themes pages under dev and in production. Each loads on demand, and no form
// page imports this module: forms bring their own copy of a look.
// In dev, a changed theme is re-imported through a cache-busting query (like forms).
export async function themesModule(
  paths: ProjectPaths,
  dev: boolean,
  skip: readonly string[] = [],
): Promise<string> {
  const entries = resolveThemes(paths.themesRoot).filter((t) => !skip.includes(t.id));
  const catalog = `export const themes = ${JSON.stringify(
    await Promise.all(entries.map((entry) => themeInfo(paths, entry))),
  )};\n`;
  if (!dev) {
    const cases = entries
      .map((t) => `    case ${JSON.stringify(t.id)}: return import(${JSON.stringify(t.file)});`)
      .join('\n');
    return `${catalog}export function loadTheme(id) {
  switch (id) {
${cases}
    default: return Promise.resolve(undefined);
  }
}
`;
  }
  const tokens = JSON.stringify(Object.fromEntries(entries.map((t) => [t.id, 0])));
  const cases = entries
    .map((t) => {
      const url = `@fs/${normalizePath(t.file).replace(/^\/+/, '')}`;
      return `    case ${JSON.stringify(t.id)}: return import(/* @vite-ignore */ import.meta.env.BASE_URL + ${JSON.stringify(`${url}?t=`)} + tokens[${JSON.stringify(t.id)}]);`;
    })
    .join('\n');
  return `${catalog}const tokens = ${tokens};
if (import.meta.hot) {
  import.meta.hot.on('open-form:theme-changed', (data) => {
    if (data && data.themeId in tokens) tokens[data.themeId] = data.timestamp;
  });
}
export function loadTheme(id) {
  switch (id) {
${cases}
    default: return Promise.resolve(undefined);
  }
}
`;
}

export async function serverEntryModule(paths: ProjectPaths): Promise<string> {
  const configFile = path.join(paths.userCwd, CONFIG_FILE);
  // Imported, not serialized: the config runs when the server starts, so values
  // it reads from process.env (webhook URLs) never end up in the build output.
  const configExport = existsSync(configFile)
    ? `export { default as config } from ${JSON.stringify(normalizePath(configFile))};`
    : 'export const config = {};';
  const forms = findForms(paths.formsRoot);
  const loaders = forms
    .map((f) => `  ${JSON.stringify(f.id)}: () => import(${JSON.stringify(f.file)}),`)
    .join('\n');
  const updated = Object.fromEntries(forms.map((f) => [f.id, formUpdatedAt(f.file)]));
  const folders = await readManifest(foldersPath(paths.formsRoot));
  return `import { toFormDefinition } from ${JSON.stringify(DEFINITION_MODULE)};
${configExport}
const loaders = {
${loaders}
};
export const formIds = Object.keys(loaders);
/** Source mtimes at build time. */
export const formUpdatedAt = ${JSON.stringify(updated)};
/** forms/.folders.json at build time, served to signed-in Studio only. */
export const folders = ${JSON.stringify(folders)};
export async function loadFormDefinition(id) {
  const load = loaders[id];
  if (!load) return null;
  return toFormDefinition(id, await load());
}
`;
}

export function formsPlugin(opts: FormsPluginOptions): Plugin {
  const { paths, config, version, skipThemes } = opts;
  let dev = false;
  // Vite hands hot updates over with forward slashes, the watcher with the OS's separators.
  const manifestFile = normalizePath(foldersPath(paths.formsRoot));
  const isManifest = (file: string) => normalizePath(file) === manifestFile;

  return {
    name: 'open-form:forms',
    config(_c, env) {
      dev = env.command === 'serve';
    },
    resolveId(id) {
      return VMODS.includes(id) ? `\0${id}` : null;
    },
    load(id) {
      if (id === `\0${FORMS_VMOD}`) return formsModule(paths, dev);
      if (id === `\0${THEMES_VMOD}`) return themesModule(paths, dev, skipThemes);
      if (id === `\0${CONFIG_VMOD}`) {
        return `export default ${JSON.stringify(clientConfig(config, version, dev))};\n`;
      }
      if (id === `\0${SERVER_ENTRY_VMOD}`) return serverEntryModule(paths);
      return null;
    },
    hotUpdate({ type, file, modules }) {
      // When a file appears, Vite retries every module that failed to resolve an import,
      // and reloads every open page doing so. The form the file belongs to retries in
      // place instead (retryForm); anything else keeps Vite's retry.
      const formId = type === 'create' && formIdForFile(paths.formsRoot, file);
      if (!formId) return;
      return modules.filter(
        (mod) => !mod.file || formIdForFile(paths.formsRoot, mod.file) !== formId,
      );
    },
    async handleHotUpdate(ctx) {
      if (isManifest(ctx.file)) {
        ctx.server.ws.send({ type: 'custom', event: 'open-form:folders-changed', data: {} });
        return [];
      }
      const themeId = themeIdForFile(paths.themesRoot, ctx.file);
      // CSS keeps Vite's own hot update; scripts and THEME.md swap the theme in place.
      if (themeId && !ctx.file.endsWith('.css')) {
        for (const mod of ctx.modules) {
          ctx.server.moduleGraph.invalidateModule(mod, new Set(), ctx.timestamp, true);
        }
        // A changed THEME.md travels with the event; a later page load rebuilds the catalog.
        const catalog = ctx.server.moduleGraph.getModuleById(`\0${THEMES_VMOD}`);
        if (catalog) ctx.server.moduleGraph.invalidateModule(catalog);
        const entry = resolveThemes(paths.themesRoot).find((t) => t.id === themeId);
        const info =
          entry && path.basename(ctx.file) === 'THEME.md'
            ? await themeInfo(paths, entry)
            : undefined;
        ctx.server.ws.send({
          type: 'custom',
          event: 'open-form:theme-changed',
          data: { themeId, timestamp: ctx.timestamp, info },
        });
        return [];
      }
      const formId = formIdForFile(paths.formsRoot, ctx.file);
      if (!formId) return;
      // Stamp the changed modules so the re-imported form fetches fresh copies
      // of any local files it imports, then let the app swap the form in place.
      for (const mod of ctx.modules) {
        ctx.server.moduleGraph.invalidateModule(mod, new Set(), ctx.timestamp, true);
      }
      ctx.server.ws.send({
        type: 'custom',
        event: 'open-form:form-changed',
        data: { formIds: [formId], timestamp: ctx.timestamp },
      });
      return [];
    },
    configureServer(server: ViteDevServer) {
      for (const dir of [paths.formsRoot, paths.themesRoot]) {
        if (existsSync(dir)) server.watcher.add(dir);
      }
      let timer: ReturnType<typeof setTimeout> | null = null;
      const reload = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          for (const vmod of VMODS) {
            const mod = server.moduleGraph.getModuleById(`\0${vmod}`);
            if (mod) server.moduleGraph.invalidateModule(mod);
          }
          // Not a full reload: a page whose form is still there keeps its answers.
          server.ws.send({
            type: 'custom',
            event: 'open-form:project-changed',
            data: { formIds: findForms(paths.formsRoot).map((f) => f.id) },
          });
        }, 150);
      };
      // A form that imported a file before it existed failed to load, and the server
      // keeps that failure until the form changes: once the file is here, treat the
      // form's files as changed so they load again in place (see hotUpdate).
      const retryForm = (file: string) => {
        const formId = formIdForFile(paths.formsRoot, file);
        if (!formId) return;
        const dir = path.join(paths.formsRoot, formId) + path.sep;
        for (const modFile of server.environments.client.moduleGraph.fileToModulesMap.keys()) {
          if (modFile !== normalizePath(file) && path.resolve(modFile).startsWith(dir)) {
            server.watcher.emit('change', modFile);
          }
        }
      };
      const isStructural = (file: string) => {
        const rel = path.relative(paths.formsRoot, file);
        const inForms = !rel.startsWith('..') && rel.split(path.sep).length === 2;
        const themeRel = path.relative(paths.themesRoot, file).split(path.sep);
        const inThemes =
          !themeRel[0]?.startsWith('..') &&
          (themeRel.length === 1 || (themeRel.length === 2 && /^index\./.test(themeRel[1] ?? '')));
        return inForms || inThemes;
      };
      // A new or removed manifest doesn't go through handleHotUpdate.
      const foldersChanged = (file: string) => {
        if (!isManifest(file)) return;
        server.ws.send({ type: 'custom', event: 'open-form:folders-changed', data: {} });
      };
      server.watcher.on('add', foldersChanged);
      server.watcher.on('add', retryForm);
      server.watcher.on('unlink', foldersChanged);
      server.watcher.on('add', (file) => isStructural(file) && reload());
      server.watcher.on('unlink', (file) => isStructural(file) && reload());
      server.watcher.on(
        'unlinkDir',
        (dir) =>
          (path.dirname(dir) === paths.formsRoot || path.dirname(dir) === paths.themesRoot) &&
          reload(),
      );
    },
  };
}
