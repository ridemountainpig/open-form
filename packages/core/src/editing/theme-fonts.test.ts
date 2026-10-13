import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cssRequestUrl, type GoogleFont } from './google-fonts.ts';
import {
  addCssImport,
  fontFileNames,
  fontStack,
  installThemeFont,
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

  it('copies every face into the theme and imports a local stylesheet', async () => {
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
