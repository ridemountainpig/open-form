import { readFile, writeFile } from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { insertComment, listComments, removeComment } from '../editing/comments.ts';
import { FORM_ID_RE } from '../server/index.ts';
import {
  displayPath,
  queueFormEdit,
  resolveFormSource,
  resolveLoc,
  sourceFiles,
} from './form-files.ts';
import type { ProjectPaths } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';

// Dev-only Studio endpoints for review comments (`@form-comment` markers in a
// form's source, applied by the `apply-comments` skill):
//
//   GET    /api/studio/comments?form=<id>   markers in forms/<id>/
//   POST   /api/studio/comments             { loc: "forms/<id>/x.tsx:12:7", text }
//   DELETE /api/studio/comments             { file: "forms/<id>/x.tsx", line }

type Context = {
  paths: ProjectPaths;
  authorize(req: IncomingMessage): Promise<boolean>;
};

export function studioCommentsMiddleware(ctx: Context) {
  const display = (file: string) => displayPath(ctx.paths, file);

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== '/api/studio/comments') return next();
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
      if (req.method === 'GET') {
        const formId = url.searchParams.get('form') ?? '';
        if (!FORM_ID_RE.test(formId)) throw new StudioError(404, 'No such form.');
        const comments = [];
        for (const file of sourceFiles(path.join(ctx.paths.formsRoot, formId))) {
          for (const comment of listComments(await readFile(file, 'utf8'))) {
            comments.push({ file: display(file), ...comment });
          }
        }
        return send(res, 200, { comments });
      }
      assertSameOrigin(req);
      const body = await readBody(req);
      if (req.method === 'POST') {
        const { file, line, column } = resolveLoc(ctx.paths, body.loc);
        const added = await queueFormEdit(async () => {
          try {
            const result = insertComment(
              await readFile(file, 'utf8'),
              line,
              column,
              body.text as string,
            );
            await writeFile(file, result.source);
            return result;
          } catch (err) {
            throw new StudioError(422, err instanceof Error ? err.message : String(err));
          }
        });
        return send(res, 201, { file: display(file), line: added.line, shifted: added.shifted });
      }
      if (req.method === 'DELETE') {
        const file = resolveFormSource(ctx.paths, body.file);
        await queueFormEdit(async () => {
          try {
            await writeFile(file, removeComment(await readFile(file, 'utf8'), Number(body.line)));
          } catch (err) {
            throw new StudioError(422, err instanceof Error ? err.message : String(err));
          }
        });
        return send(res, 200, { ok: true });
      }
      throw new StudioError(405, 'Method not allowed.');
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      console.error('[open-form] studio comments:', err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
