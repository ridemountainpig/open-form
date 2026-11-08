import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeFormTheme } from '../editing/theme-files.ts';
import { formThemeFile, resolveThemes } from '../vite/project.ts';
import { deadFontWarnings, importWarnings } from './check.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-theme-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('themes', () => {
  it("uses only the project's own themes", () => {
    mkdirSync(path.join(root, 'themes'), { recursive: true });
    writeFileSync(path.join(root, 'themes', 'terminal.ts'), 'export default {};\n');
    writeFileSync(path.join(root, 'themes', 'brand.ts'), 'export default {};\n');
    expect(resolveThemes(path.join(root, 'themes')).map((t) => t.id)).toEqual([
      'brand',
      'terminal',
    ]);
  });
});

function makeForm(id: string): string {
  const dir = path.join(root, 'forms', id);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'index.tsx'), 'export default function F() { return null; }\n');
  return dir;
}

function fontCss(family: string): string {
  return `/*\n * open-form font: "${family}", sans-serif\n */\n@font-face {}\n`;
}

describe("a form's own look", () => {
  it('starts as the default look in theme/index.ts', async () => {
    makeForm('meetup');
    const file = await writeFormTheme(root, 'meetup');
    expect(readFileSync(file, 'utf8')).toBe(
      "import { defineTheme } from '@open-form-build/core';\n\nexport default defineTheme({});\n",
    );
    expect(formThemeFile(path.join(root, 'forms'), 'meetup')).toBe(
      path.join(root, 'forms/meetup/theme/index.ts'),
    );
  });

  it('never replaces a look the form already has, and needs the form', async () => {
    makeForm('contact');
    await writeFormTheme(root, 'contact');
    await expect(writeFormTheme(root, 'contact')).rejects.toThrow(/already exists/);
    await expect(writeFormTheme(root, 'missing')).rejects.toThrow(/No form "missing"/);
  });
});

/** A font as `theme font` writes it: `fonts/<slug>.css` and a file per subset. */
function writeFont(fontsDir: string, family: string, subsets: string[]): void {
  const slug = family.toLowerCase().replace(/ /g, '-');
  mkdirSync(path.join(fontsDir, slug), { recursive: true });
  const faces = subsets.map(
    (subset) =>
      `/* ${subset} */\n@font-face {\n  font-family: '${family}';\n  src: url('./${slug}/${subset}.woff2') format('woff2');\n}\n`,
  );
  writeFileSync(path.join(fontsDir, `${slug}.css`), `${fontCss(family)}\n${faces.join('')}`);
  for (const subset of subsets) writeFileSync(path.join(fontsDir, slug, `${subset}.woff2`), '');
}

describe('check: font files the form never loads', () => {
  function form(themeSource = "import './fonts/inter.css';\nexport default {};\n") {
    const dir = makeForm('cafe');
    const fonts = path.join(dir, 'theme/fonts');
    mkdirSync(fonts, { recursive: true });
    writeFileSync(path.join(dir, 'theme/index.ts'), themeSource);
    return { dir, fonts, warnings: () => deadFontWarnings(dir, root) };
  }

  it('says nothing when the form loads every font file', () => {
    const { fonts, warnings } = form();
    writeFont(fonts, 'Inter', ['vietnamese', 'latin-ext', 'latin']);
    expect(warnings()).toEqual([]);
  });

  it('flags a font stylesheet nothing imports, with its folder', () => {
    const { fonts, warnings } = form();
    writeFont(fonts, 'Inter', ['latin']);
    writeFont(fonts, 'JetBrains Mono', ['latin']);
    expect(warnings()).toEqual([
      "forms/cafe/theme/fonts/jetbrains-mono.css isn't imported, so the form never loads JetBrains Mono: delete it and its jetbrains-mono/ folder.",
    ]);
  });

  it("counts imports from anywhere in the form, and fonts the form's own CSS declares", () => {
    const { dir, fonts, warnings } = form("import './cafe.css';\nexport default {};\n");
    writeFont(fonts, 'Inter', ['latin']);
    writeFont(fonts, 'JetBrains Mono', ['latin']);
    writeFileSync(path.join(dir, 'index.tsx'), "import './theme/fonts/inter.css?url';\n");
    mkdirSync(path.join(dir, 'theme/parts/code/blocks'), { recursive: true });
    writeFileSync(
      path.join(dir, 'theme/parts/code/blocks/Snippet.tsx'),
      "import '../../../fonts/jetbrains-mono.css';\n",
    );
    mkdirSync(path.join(fonts, 'brand'));
    writeFileSync(path.join(fonts, 'brand/regular.woff2'), '');
    writeFileSync(path.join(fonts, 'brand/bold.woff2'), '');
    writeFileSync(
      path.join(dir, 'theme/cafe.css'),
      "@font-face { font-family: 'Brand'; src: url('./fonts/brand/regular.woff2?v=2'); }\n" +
        "@font-face { font-family: 'Brand'; font-weight: 700; src: url('./fonts/brand/bold.woff2#bold'); }\n",
    );
    expect(warnings()).toEqual([]);
  });

  it("flags faces for scripts none of Open Form's languages use", () => {
    const { fonts, warnings } = form();
    writeFont(fonts, 'Inter', ['cyrillic', 'greek', 'latin-ext', 'latin']);
    expect(warnings()).toEqual([
      "forms/cafe/theme/fonts/inter.css has cyrillic, greek faces, for scripts none of Open Form's languages use: delete those @font-face rules and inter/cyrillic.woff2, inter/greek.woff2.",
    ]);
  });

  it('tells a face by its comment or unicode-range, never by its file name', () => {
    const { fonts, warnings } = form("import './fonts/archivo.css';\nexport default {};\n");
    // Downloaded by hand: Google's hashed file names, and one comment lost.
    const files = {
      cyrillicExt: 'k3kQo8UDI-1M0wlSfdboLmvDIaK18A.woff2',
      cyrillic: 'k3kQo8UDI-1M0wlSfdfoLmvDIaK18A.woff2',
      latin: 'k3kQo8UDI-1M0wlSfdnoLmvDIaI.woff2',
    };
    const face = (file: string, range: string) =>
      `@font-face {\n  font-family: 'Archivo';\n  src: url(./archivo/${file}) format('woff2');\n  unicode-range: ${range};\n}\n`;
    writeFileSync(
      path.join(fonts, 'archivo.css'),
      `${fontCss('Archivo')}\n/* cyrillic-ext */\n${face(files.cyrillicExt, 'U+0460-052F, U+20B4')}` +
        face(files.cyrillic, 'U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116') +
        `/* latin */\n${face(files.latin, 'U+0000-00FF, U+0131')}`,
    );
    mkdirSync(path.join(fonts, 'archivo'));
    for (const file of Object.values(files)) writeFileSync(path.join(fonts, 'archivo', file), '');
    expect(warnings()).toEqual([
      `forms/cafe/theme/fonts/archivo.css has cyrillic-ext, cyrillic faces, for scripts none of Open Form's languages use: delete those @font-face rules and archivo/${files.cyrillicExt}, archivo/${files.cyrillic}.`,
    ]);
  });

  it('flags folders and files no stylesheet points at', () => {
    const { fonts, warnings } = form();
    writeFont(fonts, 'Inter', ['latin']);
    writeFileSync(path.join(fonts, 'inter/greek.woff2'), '');
    writeFileSync(path.join(fonts, 'inter/OFL.txt'), '');
    mkdirSync(path.join(fonts, 'lora'));
    writeFileSync(path.join(fonts, 'lora/latin.woff2'), '');
    expect(warnings()).toEqual([
      "forms/cafe/theme/fonts/lora/ isn't used by any stylesheet: delete it.",
      'forms/cafe/theme/fonts/inter/ holds greek.woff2, which no stylesheet points at: delete it.',
    ]);
  });
});

describe('check: forms stand on their own', () => {
  it('flags imports from themes/ and from other forms', () => {
    const dir = makeForm('poll');
    makeForm('other');
    writeFileSync(
      path.join(dir, 'parts.tsx'),
      "import theme from '../../themes/terminal/index.tsx';\nimport { x } from '../other/x.ts';\nimport './theme/index.tsx';\n",
    );
    const warnings = importWarnings(dir, {
      formsRoot: path.join(root, 'forms'),
      themesRoot: path.join(root, 'themes'),
      userCwd: root,
    });
    expect(warnings).toEqual([
      expect.stringContaining('imports themes/terminal'),
      expect.stringContaining('imports from another form'),
    ]);
  });
});
