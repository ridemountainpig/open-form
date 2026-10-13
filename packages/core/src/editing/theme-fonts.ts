import { existsSync } from 'node:fs';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ImportDeclaration, Statement } from '@babel/types';
import { parseProgram } from './source-object.ts';

// Web fonts a theme serves itself: `fonts/<slug>.css` next to the theme's
// entry file declares the faces, `fonts/<slug>/` holds the files, and the theme
// imports the CSS. Nothing is loaded from a font CDN at runtime.

/** One `@font-face` rule from a Google Fonts stylesheet. */
export type FontFaceRule = {
  family: string;
  style: string;
  weight: string;
  unicodeRange?: string;
  url: string;
  /** The subset named in the comment above the rule, e.g. `latin`. */
  subset?: string;
};

export type ThemeFont = {
  family: string;
  /** The `font` / `headingFont` value that uses it. */
  stack: string;
  /** The stylesheet, relative to the project. */
  css: string;
  files: number;
  bytes: number;
};

/** A request that can't succeed as asked (as opposed to Google being unreachable). */
export class FontInstallError extends Error {}

const MARKER = 'open-form font:';
const FONT_IMPORT_RE = /^\.\/fonts\/[a-z0-9][a-z0-9-]*\.css$/;

export function fontSlug(family: string): string {
  return family
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The value for `font` / `headingFont`: the family, then system fonts of the same kind. */
export function fontStack(family: string, category: string): string {
  const name = `"${family}"`;
  if (category === 'Serif') return `${name}, ui-serif, Georgia, var(--of-cjk-serif), serif`;
  if (category === 'Monospace') {
    return `${name}, ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace`;
  }
  return `${name}, ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif`;
}

function descriptor(block: string, name: string): string | undefined {
  return new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(block)?.[1]?.trim();
}

export function parseFontFaces(css: string): FontFaceRule[] {
  const rules: FontFaceRule[] = [];
  const re = /(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*\{([^}]*)\}/g;
  for (const match of css.matchAll(re)) {
    const block = match[2] ?? '';
    const url = /url\(\s*['"]?([^'")\s]+)['"]?\s*\)/.exec(block)?.[1];
    const family = descriptor(block, 'font-family')?.replace(/^['"]|['"]$/g, '');
    if (!url || !family) continue;
    rules.push({
      family,
      style: descriptor(block, 'font-style') ?? 'normal',
      weight: descriptor(block, 'font-weight') ?? '400',
      unicodeRange: descriptor(block, 'unicode-range'),
      url,
      subset: match[1],
    });
  }
  return rules;
}

function fileSafe(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** A local file name for each rule: its subset (or slice number), plus weight and style when they vary. */
export function fontFileNames(rules: FontFaceRule[]): string[] {
  const weights = new Set(rules.map((r) => r.weight)).size > 1;
  const styles = new Set(rules.map((r) => r.style)).size > 1;
  const used = new Set<string>();
  return rules.map((rule, i) => {
    const slice = /\.(\d+)\.woff2$/.exec(new URL(rule.url).pathname)?.[1];
    // Every part comes from downloaded CSS, so none of it may shape a path.
    let base = fileSafe(rule.subset ?? slice ?? '') || String(i);
    if (weights) base += `-${fileSafe(rule.weight)}`;
    if (styles && rule.style !== 'normal') base += `-${fileSafe(rule.style)}`;
    let name = `${base}.woff2`;
    for (let n = 2; used.has(name); n++) name = `${base}-${n}.woff2`;
    used.add(name);
    return name;
  });
}

export function fontCss(opts: {
  family: string;
  stack: string;
  slug: string;
  rules: FontFaceRule[];
  files: string[];
}): string {
  const specimen = `https://fonts.google.com/specimen/${opts.family.replace(/ /g, '+')}`;
  const header = [
    '/*',
    ` * ${opts.family} from Google Fonts, served from this folder so respondents never contact Google.`,
    ` * License: ${specimen}/license`,
    ` * ${MARKER} ${opts.stack}`,
    ' */',
  ].join('\n');
  const faces = opts.rules.map((rule, i) => {
    const lines = [
      `  font-family: '${opts.family}';`,
      `  font-style: ${rule.style};`,
      `  font-weight: ${rule.weight};`,
      '  font-display: swap;',
      `  src: url('./${opts.slug}/${opts.files[i]}') format('woff2');`,
    ];
    if (rule.unicodeRange) lines.push(`  unicode-range: ${rule.unicodeRange};`);
    return `${rule.subset ? `/* ${rule.subset} */\n` : ''}@font-face {\n${lines.join('\n')}\n}`;
  });
  return `${header}\n\n${faces.join('\n')}\n`;
}

/** The family and stack recorded in a stylesheet this module wrote, or null for any other CSS. */
export function readFontHeader(css: string): { family: string; stack: string } | null {
  const stack = new RegExp(`^ \\* ${MARKER} (.+)$`, 'm').exec(css)?.[1]?.trim();
  const family = stack && /^"([^"]+)"/.exec(stack)?.[1];
  return stack && family ? { family, stack } : null;
}

const isImport = (s: Statement): s is ImportDeclaration => s.type === 'ImportDeclaration';

/** Add `import '<spec>';` after the theme's last import, unless it's already there. */
export function addCssImport(source: string, spec: string): string {
  const imports = parseProgram(source).body.filter(isImport);
  if (imports.some((s) => s.source.value === spec)) return source;
  const statement = `import '${spec}';`;
  const last = imports.at(-1);
  if (!last || last.end == null) return `${statement}\n${source}`;
  return `${source.slice(0, last.end)}\n${statement}${source.slice(last.end)}`;
}

/** `./fonts/<slug>.css` imports in a theme's source. */
export function fontImports(source: string): string[] {
  try {
    return parseProgram(source)
      .body.filter(isImport)
      .map((s) => s.source.value)
      .filter((spec) => FONT_IMPORT_RE.test(spec));
  } catch {
    return [];
  }
}

/** The font files a stylesheet points at, as long as they sit next to it. */
async function fontFilesOf(cssFile: string, css: string): Promise<string[]> {
  const dir = path.dirname(cssFile);
  return parseFontFaces(css)
    .map((rule) => path.resolve(dir, rule.url))
    .filter((file) => {
      const rel = path.relative(dir, file);
      return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel) && existsSync(file);
    });
}

/** The web fonts a theme file imports from its `fonts/` folder. */
export async function readThemeFonts(themeFile: string, projectRoot: string): Promise<ThemeFont[]> {
  const dir = path.dirname(themeFile);
  const fonts: ThemeFont[] = [];
  for (const spec of fontImports(await readFile(themeFile, 'utf8'))) {
    const cssFile = path.join(dir, spec);
    const css = await readFile(cssFile, 'utf8').catch(() => null);
    const header = css && readFontHeader(css);
    if (!css || !header) continue;
    const files = await fontFilesOf(cssFile, css);
    const sizes = await Promise.all(files.map(async (f) => (await stat(f)).size));
    fonts.push({
      ...header,
      css: path.relative(projectRoot, cssFile).split(path.sep).join('/'),
      files: files.length,
      bytes: sizes.reduce((a, b) => a + b, 0),
    });
  }
  return fonts;
}

export type InstallFontOptions = {
  themeFile: string;
  projectRoot: string;
  family: string;
  category: string;
  /** The Google Fonts stylesheet to mirror. */
  css: string;
  download(url: string): Promise<Uint8Array>;
};

const CONCURRENCY = 8;
// CJK families come in ~100 slices per style; far more means a bad stylesheet.
const MAX_FACES = 500;

/**
 * Download every face of a Google Fonts stylesheet into the theme's `fonts/`
 * folder, write a matching stylesheet and import it from the theme.
 * Adding the same family again replaces its files.
 */
export async function installThemeFont(opts: InstallFontOptions): Promise<ThemeFont> {
  const rules = parseFontFaces(opts.css);
  if (rules.length === 0)
    throw new FontInstallError(`Google Fonts returned no faces for "${opts.family}".`);
  if (rules.length > MAX_FACES) {
    throw new FontInstallError(`Google Fonts returned too many faces for "${opts.family}".`);
  }
  for (const rule of rules) {
    const url = new URL(rule.url);
    if (url.protocol !== 'https:' || url.hostname !== 'fonts.gstatic.com') {
      throw new Error(`Unexpected font URL ${url.origin}.`);
    }
  }

  const slug = fontSlug(opts.family);
  if (!slug) throw new FontInstallError(`Can't name a folder after "${opts.family}".`);
  const fontsDir = path.join(path.dirname(opts.themeFile), 'fonts');
  const cssFile = path.join(fontsDir, `${slug}.css`);
  const filesDir = path.join(fontsDir, slug);
  const rel = (file: string) => path.relative(opts.projectRoot, file).split(path.sep).join('/');

  const previous = await readFile(cssFile, 'utf8').catch(() => null);
  if (previous !== null && !readFontHeader(previous)) {
    throw new FontInstallError(`${rel(cssFile)} already exists and wasn't added by Open Form.`);
  }

  const names = fontFileNames(rules);
  const data: Uint8Array[] = new Array(rules.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, rules.length) }, async () => {
      while (next < rules.length) {
        const i = next++;
        data[i] = await opts.download((rules[i] as FontFaceRule).url);
      }
    }),
  );

  if (previous !== null) {
    for (const file of await fontFilesOf(cssFile, previous)) await rm(file, { force: true });
  }
  await mkdir(filesDir, { recursive: true });
  await Promise.all(
    names.map((name, i) => writeFile(path.join(filesDir, name), data[i] as Uint8Array)),
  );
  const stack = fontStack(opts.family, opts.category);
  await writeFile(cssFile, fontCss({ family: opts.family, stack, slug, rules, files: names }));

  const source = await readFile(opts.themeFile, 'utf8');
  const updated = addCssImport(source, `./fonts/${slug}.css`);
  if (updated !== source) await writeFile(opts.themeFile, updated);

  return {
    family: opts.family,
    stack,
    css: rel(cssFile),
    files: names.length,
    bytes: data.reduce((sum, d) => sum + d.byteLength, 0),
  };
}
