import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import type { ViteDevServer } from 'vite';
import { deleteForm } from '../editing/delete-form.ts';
import { writeScheduleChanges } from '../editing/form-config.ts';
import { wireFormTheme } from '../editing/form-theme.ts';
import { writeFormTheme } from '../editing/theme-files.ts';
import { formTimeZone, isPublished, type OpenFormConfig, scheduleEdit } from '../schema/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { createDevRegistry } from './api-plugin.ts';
import { findForms, formThemeFile, type ProjectPaths, THEME_DIR } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';
import { addThemeFont, displayPath, saveThemeTokens, themeDesign } from './theme-design.ts';

// Dev-only Studio endpoints that change a form's files. Production Studio stores
// schedule edits as overrides in the database instead (`PUT /api/forms/:id/overrides`)
// and can't delete forms: they're part of the build.
//
//   PUT    /api/studio/forms/:id/schedule   { submissions, timeZone, published } → rewrite
//                                          opensAt / closesAt / maxResponses / closed,
//                                          timeZone and published in forms/<id>/index.tsx
//   DELETE /api/studio/forms/:id            { confirm: id } → erase its responses and
//                                          data, then remove forms/<id>/
//   GET    /api/studio/forms/:id/theme      the form's own look: tokens, web fonts, contrast
//                                          (`missing` when it has no theme/index.ts)
//   POST   /api/studio/forms/:id/theme      write theme/index.ts and pass it to the <Form>
//   PUT    /api/studio/forms/:id/theme      { patch } → rewrite tokens in theme/index.ts
//   POST   /api/studio/forms/:id/theme/fonts  { family } → download a Google font into theme/fonts/

type Context = {
  server: ViteDevServer;
  paths: ProjectPaths;
  config: OpenFormConfig;
  getStorage(): Promise<StorageAdapter>;
  authorize(req: IncomingMessage): Promise<boolean>;
};

export function studioFormsMiddleware(ctx: Context) {
  const registry = createDevRegistry(ctx.server, ctx.paths);
  let queue: Promise<unknown> = Promise.resolve();

  async function saveSchedule(
    id: string,
    input: { submissions?: unknown; timeZone?: unknown; published?: unknown },
  ): Promise<void> {
    const entry = findForms(ctx.paths.formsRoot).find((f) => f.id === id);
    if (!entry) throw new StudioError(404, `No form "${id}".`);
    // Diff against the file as it is now, not a module Vite hasn't reloaded yet.
    for (const mod of ctx.server.moduleGraph.getModulesByFile(entry.file) ?? []) {
      ctx.server.moduleGraph.invalidateModule(mod);
    }
    const def = await registry.load(id);
    if (!def) throw new StudioError(404, `No form "${id}".`);
    try {
      const changes = scheduleEdit(input, {
        policy: def.config.submissions,
        timeZone: formTimeZone(def.config, ctx.config.timeZone),
        published: isPublished(def.config, null),
      });
      if (Object.keys(changes).length === 0) return;
      const source = await readFile(entry.file, 'utf8');
      await writeFile(entry.file, writeScheduleChanges(source, changes));
    } catch (err) {
      if (err instanceof StudioError) throw err;
      throw new StudioError(422, err instanceof Error ? err.message : String(err));
    }
  }

  async function remove(id: string, input: { confirm?: unknown }) {
    // The dialog makes people type the id; the server holds it to the same bar.
    if (input.confirm !== id) throw new StudioError(400, `Confirm with the form id "${id}".`);
    if (!findForms(ctx.paths.formsRoot).some((f) => f.id === id)) {
      throw new StudioError(404, `No form "${id}".`);
    }
    return deleteForm({
      formsRoot: ctx.paths.formsRoot,
      id,
      storage: await ctx.getStorage(),
    });
  }

  function formEntry(id: string) {
    const entry = findForms(ctx.paths.formsRoot).find((f) => f.id === id);
    if (!entry) throw new StudioError(404, `No form "${id}".`);
    return entry;
  }

  function ownTheme(id: string) {
    formEntry(id);
    const file = formThemeFile(ctx.paths.formsRoot, id);
    if (!file) throw new StudioError(409, `forms/${id} has no theme/index.ts yet.`);
    return file;
  }

  async function themeOf(id: string) {
    formEntry(id);
    const file = formThemeFile(ctx.paths.formsRoot, id);
    if (file) return { id, ...(await themeDesign(ctx, file)) };
    const planned = path.join(ctx.paths.formsRoot, id, THEME_DIR, 'index.ts');
    return { id, missing: true as const, file: displayPath(ctx, planned) };
  }

  async function createTheme(id: string) {
    const entry = formEntry(id);
    let wired: string;
    try {
      wired = wireFormTheme(await readFile(entry.file, 'utf8'));
      await writeFormTheme(ctx.paths.userCwd, id);
    } catch (err) {
      throw new StudioError(422, err instanceof Error ? err.message : String(err));
    }
    await writeFile(entry.file, wired);
    return themeOf(id);
  }

  async function themeRoute(id: string, req: IncomingMessage, fonts: boolean) {
    if (req.method === 'GET' && !fonts) return { status: 200, body: await themeOf(id) };
    assertSameOrigin(req);
    const body = await readBody(req);
    const write = (): Promise<{ status: number; body: unknown }> => {
      if (fonts && req.method === 'POST') {
        return addThemeFont(ctx, ownTheme(id), body).then((r) => ({ status: 201, body: r }));
      }
      if (!fonts && req.method === 'POST') {
        return createTheme(id).then((r) => ({ status: 201, body: r }));
      }
      if (!fonts && req.method === 'PUT') {
        return saveThemeTokens(ctx, ownTheme(id), body).then((r) => ({ status: 200, body: r }));
      }
      throw new StudioError(405, 'Method not allowed.');
    };
    const run = queue.then(write);
    queue = run.catch(() => {});
    return run;
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = /^\/api\/studio\/forms\/([\w-]+)(\/schedule|\/theme(\/fonts)?)?\/?$/.exec(
      url.pathname,
    );
    if (!match) return next();
    const [, id = '', route, fonts] = match;
    const schedule = route === '/schedule';
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
      if (route?.startsWith('/theme')) {
        const result = await themeRoute(id, req, Boolean(fonts));
        return send(res, result.status, result.body);
      }
      if (req.method !== (schedule ? 'PUT' : 'DELETE')) {
        throw new StudioError(405, 'Method not allowed.');
      }
      assertSameOrigin(req);
      const body = await readBody(req);
      const run = queue.then(
        (): Promise<unknown> => (schedule ? saveSchedule(id, body) : remove(id, body)),
      );
      queue = run.catch(() => {});
      const result = await run;
      send(res, 200, result ?? { ok: true });
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      console.error(`[open-form] studio ${route ? route.slice(1) : 'delete form'}:`, err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
