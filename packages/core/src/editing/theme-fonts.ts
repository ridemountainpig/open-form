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
// Open Form's languages are written in Latin and CJK, and respondents type names
// in Vietnamese and other Latin-script languages. Other scripts only appear in
// what a respondent types, where the system font the browser falls back to is enough.
const KEPT_SUBSETS = new Set(['latin', 'latin-ext', 'vietnamese']);
// Google's unicode-range for each subset, the same in every family, for a face
// whose subset comment is gone. A CJK family's slices fit none of them; `math`
// and `symbols` are left out because some CJK slices hold only symbols.
const SUBSET_RANGES: Record<string, string> = {
  latin:
    'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD',
  'latin-ext':
    'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF',
  vietnamese:
    'U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB',
  cyrillic: 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116',
  'cyrillic-ext': 'U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F',
  greek: 'U+0370-0377, U+037A-037F, U+0384-038A, U+038C, U+038E-03A1, U+03A3-03FF',
  'greek-ext': 'U+1F00-1FFF',
  arabic:
    'U+0600-06FF, U+0750-077F, U+0870-0891, U+0897-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE74, U+FE76-FEFC, U+102E0-102FB, U+10E60-10E7E, U+10EC2-10EC7, U+10EC9-10EEE, U+10EF0-10EFF, U+1EE00-1EE03, U+1EE05-1EE1F, U+1EE21-1EE22, U+1EE24, U+1EE27, U+1EE29-1EE32, U+1EE34-1EE37, U+1EE39, U+1EE3B, U+1EE42, U+1EE47, U+1EE49, U+1EE4B, U+1EE4D-1EE4F, U+1EE51-1EE52, U+1EE54, U+1EE57, U+1EE59, U+1EE5B, U+1EE5D, U+1EE5F, U+1EE61-1EE62, U+1EE64, U+1EE67-1EE6A, U+1EE6C-1EE72, U+1EE74-1EE77, U+1EE79-1EE7C, U+1EE7E, U+1EE80-1EE89, U+1EE8B-1EE9B, U+1EEA1-1EEA3, U+1EEA5-1EEA9, U+1EEAB-1EEBB, U+1EEF0-1EEF1',
  devanagari:
    'U+0900-097F, U+1CD0-1CF4, U+1CF7-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B0A',
  hebrew: 'U+0307-0308, U+0590-05FF, U+200C-2010, U+20AA, U+25CC, U+FB1D-FB4F',
};

type CodeRange = [number, number];

function parseUnicodeRange(value: string): CodeRange[] | null {
  const ranges: CodeRange[] = [];
  for (const part of value.split(',')) {
    const match = /^\s*U\+([0-9a-f]{1,6})(?:-([0-9a-f]{1,6}))?\s*$/i.exec(part);
    if (!match) return null;
    const start = Number.parseInt(match[1] as string, 16);
    ranges.push([start, match[2] ? Number.parseInt(match[2], 16) : start]);
  }
  return ranges;
}

const SUBSET_CODES = Object.entries(SUBSET_RANGES).map(([subset, value]) => {
  const merged: CodeRange[] = [];
  for (const [start, end] of (parseUnicodeRange(value) ?? []).sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && start <= last[1] + 1) last[1] = Math.max(last[1], end);
    else merged.push([start, end]);
  }
  return { subset, merged };
});

/**
 * The subset a face is for: the comment above it, else the subset whose range
 * covers its whole `unicode-range`. Never the file name, which a hand-downloaded
 * font keeps from Google as a hash.
 */
export function faceSubset(rule: FontFaceRule): string | undefined {
  if (rule.subset) return rule.subset;
  const ranges = rule.unicodeRange ? parseUnicodeRange(rule.unicodeRange) : null;
  if (!ranges) return undefined;
  return SUBSET_CODES.find(({ merged }) =>
    ranges.every(([start, end]) => merged.some(([from, to]) => from <= start && end <= to)),
  )?.subset;
}

/** A face Open Form's languages can use: a Latin subset, or a CJK family's slice, which Google leaves unnamed. */
export function isKeptFace(rule: FontFaceRule): boolean {
  const subset = faceSubset(rule);
  return !subset || KEPT_SUBSETS.has(subset);
}

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

/** The families a stack names, however they're quoted: `'Inter', "Fira Sans", serif` → `inter`, `fira sans`, `serif`. */
export function stackFamilies(stack: string | undefined): string[] {
  return (stack ?? '')
    .split(',')
    .map((part) =>
      part
        .trim()
        .replace(/^(["'])(.*)\1$/, '$2')
        .trim()
        .toLowerCase(),
    )
    .filter(Boolean);
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
 * Download the faces of a Google Fonts stylesheet that Open Form's languages use
 * into the theme's `fonts/` folder, write a matching stylesheet and import it
 * from the theme. Adding the same family again replaces its files.
 */
export async function installThemeFont(opts: InstallFontOptions): Promise<ThemeFont> {
  const faces = parseFontFaces(opts.css);
  if (faces.length === 0)
    throw new FontInstallError(`Google Fonts returned no faces for "${opts.family}".`);
  if (faces.length > MAX_FACES) {
    throw new FontInstallError(`Google Fonts returned too many faces for "${opts.family}".`);
  }
  const rules = faces.filter(isKeptFace);
  if (rules.length === 0) {
    throw new FontInstallError(
      `"${opts.family}" has no Latin or CJK faces, the only scripts Open Form's languages use.`,
    );
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
