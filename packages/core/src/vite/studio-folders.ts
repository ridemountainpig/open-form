import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  assignForm,
  createFolder,
  deleteFolder,
  editManifest,
  FOLDER_ID_RE,
  FolderNotFound,
  type FoldersManifest,
  foldersPath,
  readManifest,
  reorderFolders,
  updateFolder,
} from '../editing/folders.ts';
import { findForms, type ProjectPaths } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';

// Dev-only Studio endpoints for folders (`forms/.folders.json`):
//
//   GET    /api/studio/folders             the manifest
//   POST   /api/studio/folders             { name, icon? } → new folder, appended
//   PUT    /api/studio/folders/assign      { formId, folderId | null }
//   PUT    /api/studio/folders/reorder     { ids } — every folder id, in the new order
//   PATCH  /api/studio/folders/:id         { name?, icon? }
//   DELETE /api/studio/folders/:id         its forms become unfiled

type Context = {
  paths: ProjectPaths;
  authorize(req: IncomingMessage): Promise<boolean>;
};

export function studioFoldersMiddleware(ctx: Context) {
  const file = foldersPath(ctx.paths.formsRoot);
  const edit = <T>(fn: (m: FoldersManifest) => { manifest: FoldersManifest; result: T }) =>
    editManifest(file, fn);

  const guard = (fn: () => unknown) => {
    try {
      return fn();
    } catch (err) {
      if (err instanceof FolderNotFound) throw new StudioError(404, err.message);
      throw new StudioError(422, err instanceof Error ? err.message : String(err));
    }
  };

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const match = /^\/api\/studio\/folders(?:\/([\w-]+))?\/?$/.exec(url.pathname);
    if (!match) return next();
    const [, sub] = match;
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
      if (!sub && req.method === 'GET') return send(res, 200, await readManifest(file));
      if (req.method !== 'GET') assertSameOrigin(req);

      if (!sub && req.method === 'POST') {
        const body = await readBody(req);
        const folder = await edit((m) => {
          const { manifest, folder } = guard(() =>
            createFolder(m, { name: body.name, icon: body.icon }),
          ) as ReturnType<typeof createFolder>;
          return { manifest, result: folder };
        });
        return send(res, 201, folder);
      }
      if (sub === 'assign' && req.method === 'PUT') {
        const body = await readBody(req);
        const formId = body.formId;
        if (
          typeof formId !== 'string' ||
          !findForms(ctx.paths.formsRoot).some((f) => f.id === formId)
        ) {
          throw new StudioError(404, `No form "${String(formId)}".`);
        }
        await edit((m) => ({
          manifest: guard(() => assignForm(m, formId, body.folderId ?? null)) as FoldersManifest,
          result: null,
        }));
        return send(res, 200, { ok: true });
      }
      if (sub === 'reorder' && req.method === 'PUT') {
        const body = await readBody(req);
        await edit((m) => ({
          manifest: guard(() => reorderFolders(m, body.ids)) as FoldersManifest,
          result: null,
        }));
        return send(res, 200, { ok: true });
      }
      if (sub && FOLDER_ID_RE.test(sub) && req.method === 'PATCH') {
        const body = await readBody(req);
        const folder = await edit((m) => {
          const { manifest, folder } = guard(() => updateFolder(m, sub, body)) as ReturnType<
            typeof updateFolder
          >;
          return { manifest, result: folder };
        });
        return send(res, 200, folder);
      }
      if (sub && FOLDER_ID_RE.test(sub) && req.method === 'DELETE') {
        await edit((m) => ({
          manifest: guard(() => deleteFolder(m, sub)) as FoldersManifest,
          result: null,
        }));
        return send(res, 200, { ok: true });
      }
      throw new StudioError(405, 'Method not allowed.');
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      console.error('[open-form] studio folders:', err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
