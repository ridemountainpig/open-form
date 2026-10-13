import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { deleteForm } from '../editing/delete-form.ts';
import { writeScheduleChanges } from '../editing/form-config.ts';
import { formTimeZone, type OpenFormConfig, scheduleEdit } from '../schema/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { createDevRegistry } from './api-plugin.ts';
import { findForms, type ProjectPaths } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';

// Dev-only Studio endpoints that change a form's files. Production Studio stores
// schedule edits as overrides in the database instead (`PUT /api/forms/:id/overrides`)
// and can't delete forms: they're part of the build.
//
//   PUT    /api/studio/forms/:id/schedule   { submissions, timeZone } → rewrite opensAt /
//                                          closesAt / maxResponses / closed and timeZone
//                                          in forms/<id>/index.tsx
//   DELETE /api/studio/forms/:id            { confirm: id } → erase its responses and
//                                          data, then remove forms/<id>/

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
    input: { submissions?: unknown; timeZone?: unknown },
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

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = /^\/api\/studio\/forms\/([\w-]+)(\/schedule)?\/?$/.exec(url.pathname);
    if (!match) return next();
    const [, id = '', schedule] = match;
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
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
      console.error(`[open-form] studio ${schedule ? 'schedule' : 'delete form'}:`, err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
