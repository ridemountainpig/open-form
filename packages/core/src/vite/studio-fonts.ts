import type { IncomingMessage, ServerResponse } from 'node:http';
import { FONT_CATEGORIES, searchGoogleFonts } from '../editing/google-fonts.ts';
import { StudioError, send } from './studio-http.ts';

// Dev-only search of the Google Fonts catalog for the font picker in a form's
// Adjust panel. Reference themes in themes/ are read-only in Studio: agents and
// `open-form theme add` change them.
//
//   GET  /api/studio/fonts    ?q=&category=&cjk=1 → matching families

type Context = { authorize(req: IncomingMessage): Promise<boolean> };

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

export function studioFontsMiddleware(ctx: Context) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (!/^\/api\/studio\/fonts\/?$/.test(url.pathname)) return next();
    try {
      if (!(await ctx.authorize(req))) throw new StudioError(401, 'Sign in to Studio.');
      if (req.method !== 'GET') throw new StudioError(405, 'Method not allowed.');
      return send(res, 200, await searchFonts(url.searchParams));
    } catch (err) {
      if (err instanceof StudioError) return send(res, err.status, { message: err.message });
      console.error('[open-form] studio fonts:', err);
      send(res, 500, { message: err instanceof Error ? err.message : String(err) });
    }
  };
}
