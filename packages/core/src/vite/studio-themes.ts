import type { IncomingMessage, ServerResponse } from 'node:http';
import type { ViteDevServer } from 'vite';
import { FONT_CATEGORIES, searchGoogleFonts } from '../editing/google-fonts.ts';
import { addStarterTheme, readThemeDoc } from '../editing/theme-files.ts';
import { pickTokens } from '../editing/theme-tokens.ts';
import type { OpenFormConfig } from '../schema/index.ts';
import { findStarterThemes, type ProjectPaths, resolveThemes, type ThemeEntry } from './project.ts';
import { assertSameOrigin, readBody, StudioError, send } from './studio-http.ts';
import { addThemeFont, loadThemeFile, saveThemeTokens, themeDesign } from './theme-design.ts';

// Dev-only Studio endpoints for the theme gallery and design panel. They touch
// the filesystem and Vite's module graph, so they live beside the dev server
// rather than in the web-standard form handler. Like open-slide, themes are the
// project's references under themes/: an agent reads them while writing a form's
// own look, and no form imports them, so nothing here changes an existing form.
//
//   GET  /api/studio/themes              gallery: the project's themes
//   POST /api/studio/themes              { starter, as? } → copy a starter into themes/<as>/
//   GET  /api/studio/themes/_starters    the starters, with their key colors
//   GET  /api/studio/themes/_fonts       ?q=&category=&cjk=1 → search the Google Fonts catalog
//   GET  /api/studio/themes/:id          detail: tokens, web fonts, THEME.md, contrast report
//   PUT  /api/studio/themes/:id          { patch } → rewrite tokens in the theme's source
//   POST /api/studio/themes/:id/fonts    { family } → download a Google font into the theme

type Context = {
  server: ViteDevServer;
  paths: ProjectPaths;
  config: OpenFormConfig;
  authorize(req: IncomingMessage): Promise<boolean>;
};

function findTheme(ctx: Context, id: string): ThemeEntry {
  const entry = resolveThemes(ctx.paths.themesRoot).find((t) => t.id === id);
  if (!entry) throw new StudioError(404, `No theme "${id}".`);
  return entry;
}

async function listThemes(ctx: Context) {
  const entries = resolveThemes(ctx.paths.themesRoot);
  const themes = await Promise.all(
    entries.map(async (entry) => {
      const doc = await readThemeDoc(entry.file);
      return {
        id: entry.id,
        name: doc.name ?? entry.id,
        description: doc.description,
        layout: doc.layout,
        hasDoc: doc.doc !== null,
      };
    }),
  );
  return { themes };
}

async function listStarters(ctx: Context) {
  return Promise.all(
    findStarterThemes().map(async (entry) => {
      const doc = await readThemeDoc(entry.file);
      const tokens = pickTokens(await loadThemeFile(ctx, entry.file));
      return {
        id: entry.id,
        name: doc.name ?? entry.id,
        description: doc.description,
        colors: tokens.colors ?? {},
        colorScheme: tokens.colorScheme,
      };
    }),
  );
}

async function themeDetail(ctx: Context, id: string) {
  const entry = findTheme(ctx, id);
  const doc = await readThemeDoc(entry.file);
  return {
    id,
    name: doc.name ?? id,
    description: doc.description,
    layout: doc.layout,
    doc: doc.doc,
    ...(await themeDesign(ctx, entry.file)),
  };
}

async function searchFonts(params: URLSearchParams) {
  const category = params.get('category') ?? '';
  try {
    const fonts = await searchGoogleFonts({
      q: params.get('q') ?? '',
      category: (FONT_CATEGORIES as readonly string[]).includes(category) ? category : undefined,
      cjk: params.get('cjk') === '1',
    });
    return { fonts };
  } catch (err) {
    throw new StudioError(502, err instanceof Error ? err.message : String(err));
  }
}

async function addStarter(ctx: Context, body: Record<string, unknown>) {
  const starter = typeof body.starter === 'string' ? body.starter : '';
  const as = typeof body.as === 'string' && body.as.trim() ? body.as.trim() : undefined;
  try {
    const result = await addStarterTheme(ctx.paths.userCwd, starter, { as });
    return { id: result.name, files: result.files };
  } catch (err) {
    throw new StudioError(422, err instanceof Error ? err.message : String(err));
  }
}

export function studioThemesMiddleware(ctx: Context) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    // `_starters` and `_fonts` can't clash with a theme: ids don't start with `_`.
    const match =
      /^\/api\/studio\/themes(?:\/(_starters|_fonts|[A-Za-z0-9][\w-]*)(\/fonts)?)?\/?$/.exec(
        url.pathname,
      );
    if (!match) return next();
    const [, id, fonts] = match;
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
      if (!id && req.method === 'GET') return send(res, 200, await listThemes(ctx));
      if (!id && req.method === 'POST') {
        assertSameOrigin(req);
        return send(res, 201, await addStarter(ctx, await readBody(req)));
      }
      if (id === '_starters' && req.method === 'GET') {
        return send(res, 200, { starters: await listStarters(ctx) });
      }
      if (id === '_fonts' && req.method === 'GET') {
        return send(res, 200, await searchFonts(url.searchParams));
      }
      if (id && fonts && req.method === 'POST') {
        assertSameOrigin(req);
        return send(
          res,
          201,
          await addThemeFont(ctx, findTheme(ctx, id).file, await readBody(req)),
        );
      }
      if (fonts) throw new StudioError(405, 'Method not allowed.');
      if (id && req.method === 'GET') return send(res, 200, await themeDetail(ctx, id));
      if (id && req.method === 'PUT') {
        assertSameOrigin(req);
        return send(
          res,
          200,
          await saveThemeTokens(ctx, findTheme(ctx, id).file, await readBody(req)),
        );
      }
      throw new StudioError(405, 'Method not allowed.');
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      console.error('[open-form] studio themes:', err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
