import fs from 'node:fs/promises';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { FORM_ID_RE } from '../server/index.ts';
import { findForms, formThemeFile, type ProjectPaths, resolveThemes } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';

type Incoming = {
  formId?: unknown;
  themeId?: unknown;
  view?: unknown;
  step?: unknown;
  stepNumber?: unknown;
  totalSteps?: unknown;
  stepTitle?: unknown;
  /** The element last picked with Studio's inspector; `null` clears it. */
  selection?: unknown;
};

type Selection = { file: string; line: number; column: number; field?: string; text?: string };

function selectionOf(raw: unknown, paths: ProjectPaths): Selection | null {
  const value = raw as { loc?: unknown; field?: unknown; text?: unknown } | null;
  const loc = typeof value?.loc === 'string' && value.loc.length <= 500 ? value.loc : null;
  const match = loc ? /^(.+):(\d+):(\d+)$/.exec(loc) : null;
  if (!match) return null;
  const file = (match[1] ?? '').split('/').join(path.sep);
  const rel = path.relative(paths.formsRoot, path.resolve(paths.userCwd, file));
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  return {
    file: match[1] as string,
    line: Number(match[2]),
    column: Number(match[3]),
    ...(typeof value?.field === 'string' ? { field: value.field.slice(0, 100) } : {}),
    ...(typeof value?.text === 'string' ? { text: value.text.slice(0, 200) } : {}),
  };
}

const VIEWS = new Set(['preview', 'responses', 'schema', 'settings', 'form', 'forms', 'themes']);

function int(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : null;
}

/**
 * `POST /api/studio/current` (dev): mirrors what the user is looking at into
 * node_modules/.open-form/current.json so the `current-form` skill can resolve
 * "this form" / "this step". Studio's sign-in applies: what lands in the file
 * reaches the agent.
 */
export function studioCurrentMiddleware(ctx: {
  paths: ProjectPaths;
  authorize(req: IncomingMessage): Promise<boolean>;
}) {
  const { paths } = ctx;
  const outDir = path.join(paths.userCwd, 'node_modules', '.open-form');
  const outFile = path.join(outDir, 'current.json');
  let last: Record<string, unknown> = {};
  // Navigation reports arrive in bursts; one at a time keeps `last` and the
  // temp-file rename from racing.
  let queue: Promise<void> = Promise.resolve();

  async function record(raw: Incoming) {
    const formId =
      typeof raw.formId === 'string' && FORM_ID_RE.test(raw.formId) ? raw.formId : null;
    const view = typeof raw.view === 'string' && VIEWS.has(raw.view) ? raw.view : 'forms';
    const entry = formId ? findForms(paths.formsRoot).find((f) => f.id === formId) : undefined;
    const themeId =
      typeof raw.themeId === 'string' && /^[A-Za-z0-9][\w-]*$/.test(raw.themeId)
        ? raw.themeId
        : null;
    const theme = themeId
      ? resolveThemes(paths.themesRoot).find((t) => t.id === themeId)
      : undefined;
    const formTheme = entry && formId ? formThemeFile(paths.formsRoot, formId) : null;
    const sameForm = last.formId === formId;
    // Responses, Schema and Settings show no step, and leaving Preview drops Edit mode's pick.
    const keepStep = sameForm && (view === 'preview' || view === 'form');
    const keepSelection = sameForm && view === 'preview';
    const next = {
      formId,
      view,
      formPath: entry ? path.relative(paths.userCwd, entry.file).split(path.sep).join('/') : null,
      // The form's own look: "this form's colors" means this file, never themes/.
      formThemePath: formTheme
        ? path.relative(paths.userCwd, formTheme).split(path.sep).join('/')
        : null,
      step: int(raw.step) ?? (keepStep ? last.step : null) ?? null,
      stepNumber: int(raw.stepNumber) ?? (keepStep ? last.stepNumber : null) ?? null,
      totalSteps: int(raw.totalSteps) ?? (keepStep ? last.totalSteps : null) ?? null,
      // A step report without a title is an untitled page, not "same as before".
      stepTitle:
        typeof raw.stepTitle === 'string'
          ? raw.stepTitle.slice(0, 200)
          : keepStep && int(raw.step) === null
            ? (last.stepTitle ?? null)
            : null,
      publicUrl: formId ? `/f/${formId}` : null,
      // Set while a reference theme is open in Studio's Themes pages.
      themeId: theme ? themeId : null,
      themePath: theme ? path.relative(paths.userCwd, theme.file).split(path.sep).join('/') : null,
      // Picked with the inspector: what "this" means in "make this required".
      selection:
        'selection' in raw
          ? selectionOf(raw.selection, paths)
          : keepSelection
            ? (last.selection ?? null)
            : null,
      updatedAt: new Date().toISOString(),
    };
    last = next;
    await fs.mkdir(outDir, { recursive: true });
    await fs.writeFile(`${outFile}.tmp`, `${JSON.stringify(next, null, 2)}\n`);
    await fs.rename(`${outFile}.tmp`, outFile);
  }

  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (new URL(req.url ?? '/', 'http://localhost').pathname !== '/api/studio/current') {
      return next();
    }
    try {
      if (req.method !== 'POST') throw new StudioError(405, 'Method not allowed.');
      // Respondents' pages report too; for them this is quietly a no-op.
      if (!(await ctx.authorize(req))) return send(res, 202, { recorded: false });
      assertSameOrigin(req);
      const body = (await readBody(req)) as Incoming;
      const done = queue.then(() => record(body));
      queue = done.catch(() => {});
      await done;
      return send(res, 200, { recorded: true });
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      send(res, 500, { message: 'Could not record the current view.' });
    }
  };
}
