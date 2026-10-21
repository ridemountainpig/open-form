import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizePath, type ViteDevServer } from 'vite';
import { addGoogleFont } from '../editing/google-fonts.ts';
import { FontInstallError, readThemeFonts } from '../editing/theme-fonts.ts';
import { pickTokens, validatePatch, writeThemeTokens } from '../editing/theme-tokens.ts';
import type { Theme } from '../schema/index.ts';
import { contrastReport } from '../schema/index.ts';
import type { ProjectPaths } from './project.ts';
import { StudioError } from './studio-http.ts';

// What a form's Adjust panel in Studio reads and writes in its own look,
// forms/<id>/theme/. Tokens only; components and CSS stay hand-written.

type DesignContext = { server: ViteDevServer; paths: ProjectPaths };

export async function loadThemeFile(ctx: DesignContext, file: string): Promise<Theme> {
  for (const mod of ctx.server.moduleGraph.getModulesByFile(file) ?? []) {
    ctx.server.moduleGraph.invalidateModule(mod);
  }
  const mod = (await ctx.server.ssrLoadModule(file)) as { default?: Theme };
  if (!mod.default) throw new StudioError(500, `${file} has no default export.`);
  return mod.default;
}

export const displayPath = (ctx: DesignContext, file: string) =>
  path.relative(ctx.paths.userCwd, file).split(path.sep).join('/');

export async function themeDesign(ctx: DesignContext, file: string) {
  const theme = await loadThemeFile(ctx, file);
  return {
    file: displayPath(ctx, file),
    tokens: pickTokens(theme),
    fonts: (await readThemeFonts(file, ctx.paths.userCwd)).map((font) => ({
      ...font,
      href: `/@fs/${normalizePath(path.join(ctx.paths.userCwd, font.css)).replace(/^\/+/, '')}`,
    })),
    contrast: contrastReport(theme),
  };
}

export async function saveThemeTokens(
  ctx: DesignContext,
  file: string,
  body: Record<string, unknown>,
) {
  let next: string;
  try {
    next = writeThemeTokens(await readFile(file, 'utf8'), validatePatch(body.patch));
  } catch (err) {
    throw new StudioError(422, err instanceof Error ? err.message : String(err));
  }
  await writeFile(file, next);
  const theme = await loadThemeFile(ctx, file);
  return { tokens: pickTokens(theme), contrast: contrastReport(theme) };
}

export async function addThemeFont(
  ctx: DesignContext,
  file: string,
  body: Record<string, unknown>,
) {
  const family = typeof body.family === 'string' ? body.family : '';
  if (!family.trim()) throw new StudioError(422, 'Pick a font family.');
  try {
    const font = await addGoogleFont({ themeFile: file, projectRoot: ctx.paths.userCwd, family });
    return { font };
  } catch (err) {
    const status = err instanceof FontInstallError ? 422 : 502;
    throw new StudioError(status, err instanceof Error ? err.message : String(err));
  }
}
