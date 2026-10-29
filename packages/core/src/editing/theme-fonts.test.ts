import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cssRequestUrl, type GoogleFont } from './google-fonts.ts';
import {
  addCssImport,
  type FontFaceRule,
  FontInstallError,
  faceSubset,
  fontFileNames,
  fontSlug,
  fontStack,
  installThemeFont,
  isKeptFace,
  parseFontFaces,
  readFontHeader,
  readThemeFonts,
} from './theme-fonts.ts';

const GSTATIC = 'https://fonts.gstatic.com/s';

const VARIABLE_CSS = `/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(${GSTATIC}/inter/v20/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA, U+1E00-1E9F;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 400 700;
  font-display: swap;
  src: url(${GSTATIC}/inter/v20/latin.woff2) format('woff2');
  unicode-range: U+0000-00FF, U+0131;
}
`;

const STATIC_CSS = ['400', '700']
  .map(
    (w) => `/* latin */
@font-face {
  font-family: 'Lato';
  font-style: normal;
  font-weight: ${w};
  src: url(${GSTATIC}/lato/v24/${w}.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`,
  )
  .join('\n');

const SLICED_CSS = [0, 1]
  .map(
    (n) => `@font-face {
  font-family: 'Noto Sans TC';
  font-style: normal;
  font-weight: 400 700;
  src: url(${GSTATIC}/notosanstc/v40/abc.${n}.woff2) format('woff2');
  unicode-range: U+4e00-4e10;
}`,
  )
  .join('\n');

const scriptsCss = (family: string, subsets: string[]) =>
  subsets
    .map(
      (subset) => `/* ${subset} */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: 400 700;
  src: url(${GSTATIC}/${fontSlug(family)}/v1/${subset}.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}`,
    )
    .join('\n');

const LATIN_RANGE =
  'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';

// Inter's subsets, in the order css2 lists them.
const SCRIPTS_CSS = scriptsCss('Inter', [
  'cyrillic-ext',
  'cyrillic',
  'greek-ext',
  'greek',
  'vietnamese',
  'latin-ext',
  'latin',
]);

const THEME = `import { defineTheme } from '@open-form-build/core';
import './brand.css';

export default defineTheme({ radius: '8px' });
`;

describe('Google Fonts stylesheets', () => {
  it('reads every face with its subset, weight and range', () => {
    const faces = parseFontFaces(VARIABLE_CSS);
    expect(faces).toHaveLength(2);
    expect(faces[1]).toEqual({
      family: 'Inter',
      style: 'normal',
      weight: '400 700',
      unicodeRange: 'U+0000-00FF, U+0131',
      url: `${GSTATIC}/inter/v20/latin.woff2`,
      subset: 'latin',
    });
  });

  it('names files by subset or slice, adding the weight when it varies', () => {
    expect(fontFileNames(parseFontFaces(VARIABLE_CSS))).toEqual(['latin-ext.woff2', 'latin.woff2']);
    expect(fontFileNames(parseFontFaces(STATIC_CSS))).toEqual([
      'latin-400.woff2',
      'latin-700.woff2',
    ]);
    expect(fontFileNames(parseFontFaces(SLICED_CSS))).toEqual(['0.woff2', '1.woff2']);
  });

  it("keeps Latin faces and a CJK family's unnamed slices, nothing else", () => {
    const kept = (css: string) => parseFontFaces(css).filter(isKeptFace);
    expect(kept(SCRIPTS_CSS).map((f) => f.subset)).toEqual(['vietnamese', 'latin-ext', 'latin']);
    expect(kept(SLICED_CSS)).toHaveLength(2);
    // css2 has also numbered the slices in a comment.
    let n = 0;
    expect(
      kept(SLICED_CSS.replace(/@font-face/g, () => `/* [${n++}] */\n@font-face`)),
    ).toHaveLength(2);
    expect(kept(scriptsCss('Noto Sans Arabic', ['arabic', 'math', 'symbols']))).toEqual([]);
  });

  it("reads a face's subset from its comment, else from its unicode-range", () => {
    const face = (unicodeRange: string, subset?: string): FontFaceRule => ({
      family: 'Archivo',
      style: 'normal',
      weight: '400',
      unicodeRange,
      url: `${GSTATIC}/archivo/k3kQo8UDI-1M0wlSfdboLmvDIaK18A.woff2`,
      ...(subset ? { subset } : {}),
    });
    expect(faceSubset(face('U+0400-045F', 'latin'))).toBe('latin');
    expect(faceSubset(face(LATIN_RANGE))).toBe('latin');
    const cyrillic = face('U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116');
    expect(faceSubset(cyrillic)).toBe('cyrillic');
    expect(isKeptFace(cyrillic)).toBe(false);
    // Before 2023 Google's Cyrillic range had no U+0301.
    expect(faceSubset(face('U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116'))).toBe('cyrillic');
    expect(faceSubset(face('U+1F00-1FFF'))).toBe('greek-ext');
    // CJK slices fit no subset, even Noto Sans TC's slice of nothing but symbols.
    for (const slice of ['U+4e00-4e10, U+ff70', 'U+2649-2656, U+2658-265c, U+265e-2660']) {
      expect(faceSubset(face(slice))).toBeUndefined();
      expect(isKeptFace(face(slice))).toBe(true);
    }
  });

  it('keeps names from a hostile stylesheet inside the fonts folder', () => {
    const face = (weight: string) =>
      `/* latin */ @font-face { font-family: 'X'; font-weight: ${weight}; src: url(https://fonts.gstatic.com/s/x.woff2); }`;
    const names = fontFileNames(parseFontFaces(face('/../../../../tmp/pwn') + face('400')));
    expect(names).toEqual(['latin-tmp-pwn.woff2', 'latin-400.woff2']);
  });

  it('falls back to system fonts of the same kind, then the CJK stack', () => {
    expect(fontStack('Inter', 'Sans Serif')).toBe(
      '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
    );
    expect(fontStack('Lora', 'Serif')).toBe(
      '"Lora", ui-serif, Georgia, var(--of-cjk-serif), serif',
    );
    expect(fontStack('Fira Code', 'Monospace')).toMatch(/var\(--of-cjk\), monospace$/);
  });

  it('requests the whole weight axis of a variable family, or static weights 400–700', () => {
    const font = (over: Partial<GoogleFont>): GoogleFont => ({
      family: 'Noto Sans TC',
      category: 'Sans Serif',
      weights: [100, 300, 400, 500, 700, 900],
      italicOnly: false,
      subsets: ['latin'],
      cjk: false,
      popularity: 1,
      ...over,
    });
    expect(cssRequestUrl(font({ axis: { min: 100, max: 900 } }))).toBe(
      'https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@100..900&display=swap',
    );
    expect(cssRequestUrl(font({}))).toContain(':wght@400;500;700&');
    expect(cssRequestUrl(font({ weights: [300, 900] }))).toContain(':wght@300&');
    expect(cssRequestUrl(font({ weights: [], italicOnly: true }))).toContain(':ital@1&');
  });
});

describe('addCssImport', () => {
  it('goes after the last import, once', () => {
    const out = addCssImport(THEME, './fonts/inter.css');
    expect(out).toContain("import './brand.css';\nimport './fonts/inter.css';\n");
    expect(addCssImport(out, './fonts/inter.css')).toBe(out);
  });

  it('starts the file when there are no imports', () => {
    expect(addCssImport('export default {};\n', './fonts/inter.css')).toBe(
      "import './fonts/inter.css';\nexport default {};\n",
    );
  });
});

describe('installThemeFont', () => {
  let root: string;
  let themeFile: string;
  const downloads: string[] = [];
  const download = async (url: string) => {
    downloads.push(url);
    return new TextEncoder().encode(`font:${url}`);
  };

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'open-form-fonts-'));
    mkdirSync(path.join(root, 'themes/brand'), { recursive: true });
    themeFile = path.join(root, 'themes/brand/index.tsx');
    writeFileSync(themeFile, THEME);
    downloads.length = 0;
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const install = (css: string, family = 'Inter') =>
    installThemeFont({
      themeFile,
      projectRoot: root,
      family,
      category: 'Sans Serif',
      css,
      download,
    });

  it('copies the faces into the theme and imports a local stylesheet', async () => {
    const font = await install(VARIABLE_CSS);
    expect(font).toMatchObject({
      family: 'Inter',
      css: 'themes/brand/fonts/inter.css',
      files: 2,
    });
    expect(downloads).toHaveLength(2);
    expect(existsSync(path.join(root, 'themes/brand/fonts/inter/latin.woff2'))).toBe(true);

    const css = readFileSync(path.join(root, 'themes/brand/fonts/inter.css'), 'utf8');
    expect(css).not.toContain('gstatic');
    expect(css).toContain("src: url('./inter/latin.woff2') format('woff2');");
    expect(css).toContain('unicode-range: U+0000-00FF, U+0131;');
    expect(readFontHeader(css)).toEqual({ family: 'Inter', stack: font.stack });

    expect(readFileSync(themeFile, 'utf8')).toContain("import './fonts/inter.css';");
    expect(await readThemeFonts(themeFile, root)).toEqual([font]);
  });

  it('downloads only the faces for scripts forms are written in', async () => {
    const font = await install(SCRIPTS_CSS);
    expect(font.files).toBe(3);
    expect(downloads.map((url) => path.basename(url)).sort()).toEqual([
      'latin-ext.woff2',
      'latin.woff2',
      'vietnamese.woff2',
    ]);
    expect(readdirSync(path.join(root, 'themes/brand/fonts/inter')).sort()).toEqual([
      'latin-ext.woff2',
      'latin.woff2',
      'vietnamese.woff2',
    ]);
    const css = readFileSync(path.join(root, 'themes/brand/fonts/inter.css'), 'utf8');
    expect(parseFontFaces(css).map((f) => f.subset)).toEqual(['vietnamese', 'latin-ext', 'latin']);
    expect(css).not.toMatch(/cyrillic|greek/);
  });

  it('keeps every slice of a CJK family and drops its other scripts', async () => {
    const font = await install(
      `${SLICED_CSS}\n${scriptsCss('Noto Sans TC', ['cyrillic', 'latin'])}`,
      'Noto Sans TC',
    );
    expect(font.files).toBe(3);
    expect(readdirSync(path.join(root, 'themes/brand/fonts/noto-sans-tc')).sort()).toEqual([
      '0.woff2',
      '1.woff2',
      'latin.woff2',
    ]);
  });

  it('refuses a family with no Latin or CJK faces', async () => {
    const arabic = install(scriptsCss('Noto Kufi Arabic', ['arabic', 'math']), 'Noto Kufi Arabic');
    await expect(arabic).rejects.toThrow(FontInstallError);
    await expect(arabic).rejects.toThrow(/no Latin or CJK faces/);
    expect(downloads).toEqual([]);
    expect(readFileSync(themeFile, 'utf8')).toBe(THEME);
  });

  it('replaces the files when the same family is added again', async () => {
    await install(STATIC_CSS, 'Inter');
    await install(VARIABLE_CSS);
    expect(existsSync(path.join(root, 'themes/brand/fonts/inter/latin-400.woff2'))).toBe(false);
    const source = readFileSync(themeFile, 'utf8');
    expect(source.match(/fonts\/inter\.css/g)).toHaveLength(1);
    expect((await readThemeFonts(themeFile, root))[0]?.files).toBe(2);
  });

  it('only downloads from Google’s font host', async () => {
    await expect(
      install(VARIABLE_CSS.replaceAll('fonts.gstatic.com', 'example.com')),
    ).rejects.toThrow(/Unexpected font URL/);
    expect(downloads).toEqual([]);
  });

  it("leaves a stylesheet it didn't write alone", async () => {
    mkdirSync(path.join(root, 'themes/brand/fonts'));
    writeFileSync(path.join(root, 'themes/brand/fonts/inter.css'), '@font-face {}');
    await expect(install(VARIABLE_CSS)).rejects.toThrow(/wasn't added by Open Form/);
    expect(readFileSync(themeFile, 'utf8')).toBe(THEME);
  });
});
