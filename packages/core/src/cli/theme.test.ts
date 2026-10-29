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
import { findReferenceTheme, rescope, writeFormTheme } from '../editing/theme-files.ts';
import { formThemeFile, resolveThemes } from '../vite/project.ts';
import { deadFontWarnings, importWarnings } from './check.ts';
import { addStarterTheme, starterCatalog, themeCatalog } from './theme.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-theme-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('themes', () => {
  it('ships starters with descriptions, but a new project has no themes', async () => {
    const starters = await starterCatalog();
    expect(starters.map((s) => s.id)).toEqual([
      'brutalist',
      'classic',
      'conversational',
      'editorial',
      'terminal',
    ]);
    expect(starters.every((s) => s.description.length > 10)).toBe(true);
    expect(await themeCatalog(root)).toEqual([]);
  });

  it("uses only the project's own themes", () => {
    mkdirSync(path.join(root, 'themes'), { recursive: true });
    writeFileSync(path.join(root, 'themes', 'terminal.ts'), 'export default {};\n');
    writeFileSync(path.join(root, 'themes', 'brand.ts'), 'export default {};\n');
    expect(resolveThemes(path.join(root, 'themes')).map((t) => t.id)).toEqual([
      'brand',
      'terminal',
    ]);
  });

  it('adds a starter under a new name and rewrites its scoped selectors', async () => {
    const result = await addStarterTheme(root, 'editorial', { as: 'brand' });
    expect(result.files.sort()).toEqual([
      'themes/brand/THEME.md',
      'themes/brand/editorial.css',
      'themes/brand/index.tsx',
    ]);
    const css = readFileSync(path.join(root, 'themes/brand/editorial.css'), 'utf8');
    expect(css).toContain('[data-of-theme="brand"] .of-form');
    expect(css).not.toContain('data-of-theme="editorial"');
    const doc = readFileSync(path.join(root, 'themes/brand/THEME.md'), 'utf8');
    expect(doc).toMatch(/^name: Brand$/m);
    expect(doc).toMatch(/^description: Started from the editorial starter\. \S/m);
    expect(doc).toContain('# Brand\n\n> Started from the `editorial` starter theme');

    const rows = await themeCatalog(root);
    expect(rows).toEqual([expect.objectContaining({ id: 'brand' })]);
  });

  it('refuses to overwrite without --force and rejects unknown starters', async () => {
    await addStarterTheme(root, 'terminal');
    await expect(addStarterTheme(root, 'terminal')).rejects.toThrow(/already exists/);
    await expect(addStarterTheme(root, 'terminal', { force: true })).resolves.toMatchObject({
      name: 'terminal',
    });
    await expect(addStarterTheme(root, 'nope')).rejects.toThrow(/No starter theme "nope"/);
    await expect(addStarterTheme(root, 'classic', { as: 'Bad Name' })).rejects.toThrow(
      /kebab-case/,
    );
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
    const result = await writeFormTheme(root, 'meetup');
    expect(result.fonts).toEqual([]);
    expect(readFileSync(result.file, 'utf8')).toBe(
      "import { defineTheme } from '@open-form-build/core';\n\nexport default defineTheme({});\n",
    );
    expect(formThemeFile(path.join(root, 'forms'), 'meetup')).toBe(
      path.join(root, 'forms/meetup/theme/index.ts'),
    );
  });

  it("takes a reference's tokens and nothing else", async () => {
    makeForm('signup');
    const ref = await addStarterTheme(root, 'terminal');
    const themeFile = path.join(root, 'themes/terminal/index.tsx');
    expect(ref.files).toContain('themes/terminal/terminal.css');
    const result = await writeFormTheme(root, 'signup', {
      tokens: { radius: '4px', colors: { primary: '#3fb950' }, dark: false },
      themeFile,
    });
    const source = readFileSync(result.file, 'utf8');
    expect(source).toContain("radius: '4px'");
    expect(source).toContain("primary: '#3fb950'");
    expect(source).toContain('dark: false');
    expect(source).not.toContain('.css');
    expect(existsSync(path.join(root, 'forms/signup/theme/terminal.css'))).toBe(false);
  });

  it('brings in the web fonts its tokens name and says where the rest are', async () => {
    makeForm('survey');
    mkdirSync(path.join(root, 'themes/night/fonts/inter'), { recursive: true });
    mkdirSync(path.join(root, 'themes/night/fonts/mono'), { recursive: true });
    const themeFile = path.join(root, 'themes/night/index.ts');
    writeFileSync(
      themeFile,
      "import './fonts/inter.css';\nimport './fonts/mono.css';\nimport './fonts/kai.css';\nexport default {};\n",
    );
    writeFileSync(path.join(root, 'themes/night/fonts/inter.css'), fontCss('Inter'));
    writeFileSync(path.join(root, 'themes/night/fonts/inter/latin.woff2'), '');
    writeFileSync(path.join(root, 'themes/night/fonts/mono.css'), fontCss('Mono'));
    writeFileSync(path.join(root, 'themes/night/fonts/mono/latin.woff2'), '');
    writeFileSync(path.join(root, 'themes/night/fonts/kai.css'), fontCss('Kai'));
    const result = await writeFormTheme(root, 'survey', {
      tokens: { font: "'inter', sans-serif" },
      themeFile,
    });
    expect(result.fonts).toEqual(['Inter']);
    expect(result.spareFonts).toEqual([
      {
        family: 'Mono',
        css: 'themes/night/fonts/mono.css',
        folder: 'themes/night/fonts/mono',
      },
      { family: 'Kai', css: 'themes/night/fonts/kai.css' },
    ]);
    const dir = path.join(root, 'forms/survey/theme');
    expect(readdirSync(path.join(dir, 'fonts'))).toEqual(['inter', 'inter.css']);
    expect(existsSync(path.join(dir, 'fonts/inter/latin.woff2'))).toBe(true);
    const source = readFileSync(result.file, 'utf8');
    expect(source).toContain("import './fonts/inter.css';");
    expect(source).not.toContain('mono.css');
  });

  it('copies no fonts folder when the tokens name none', async () => {
    makeForm('quiz');
    mkdirSync(path.join(root, 'themes/night/fonts'), { recursive: true });
    const themeFile = path.join(root, 'themes/night/index.ts');
    writeFileSync(themeFile, "import './fonts/mono.css';\nexport default {};\n");
    writeFileSync(path.join(root, 'themes/night/fonts/mono.css'), fontCss('Mono'));
    const result = await writeFormTheme(root, 'quiz', { tokens: {}, themeFile });
    expect(result.spareFonts).toHaveLength(1);
    expect(existsSync(path.join(root, 'forms/quiz/theme/fonts'))).toBe(false);
  });

  it('never replaces a look the form already has, and needs the form', async () => {
    makeForm('contact');
    await writeFormTheme(root, 'contact');
    await expect(writeFormTheme(root, 'contact')).rejects.toThrow(/already exists/);
    await expect(writeFormTheme(root, 'missing')).rejects.toThrow(/No form "missing"/);
  });

  it("finds a reference in the project's themes first, then the starters", async () => {
    await expect(findReferenceTheme(root, 'terminal')).resolves.toMatchObject({
      source: 'starter',
    });
    await addStarterTheme(root, 'editorial', { as: 'terminal' });
    await expect(findReferenceTheme(root, 'terminal')).resolves.toMatchObject({
      source: 'project',
      file: path.join(root, 'themes/terminal/index.tsx'),
    });
    await expect(findReferenceTheme(root, 'nope')).rejects.toThrow(/No theme "nope"/);
  });

  it('rescopes every quoting style', () => {
    const css = `[data-of-theme="a"] x, [data-of-theme='a'] y, [data-of-theme=a] z, [data-of-theme="ab"] w`;
    expect(rescope(css, 'a', 'form')).toBe(
      `[data-of-theme="form"] x, [data-of-theme='form'] y, [data-of-theme=form] z, [data-of-theme="ab"] w`,
    );
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
    writeFileSync(path.join(dir, 'index.tsx'), "import './theme/fonts/inter.css';\n");
    mkdirSync(path.join(fonts, 'brand'));
    writeFileSync(path.join(fonts, 'brand/regular.woff2'), '');
    writeFileSync(
      path.join(dir, 'theme/cafe.css'),
      "@font-face { font-family: 'Brand'; src: url('./fonts/brand/regular.woff2'); }\n",
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
