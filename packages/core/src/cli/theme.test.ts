import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findReferenceTheme, rescope, writeFormTheme } from '../editing/theme-files.ts';
import { formThemeFile, resolveThemes } from '../vite/project.ts';
import { importWarnings } from './check.ts';
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

  it('brings only the web fonts its tokens name, however they quote them', async () => {
    makeForm('survey');
    mkdirSync(path.join(root, 'themes/night/fonts/inter'), { recursive: true });
    const themeFile = path.join(root, 'themes/night/index.ts');
    writeFileSync(
      themeFile,
      "import './fonts/inter.css';\nimport './fonts/mono.css';\nexport default {};\n",
    );
    writeFileSync(path.join(root, 'themes/night/fonts/inter.css'), fontCss('Inter'));
    writeFileSync(path.join(root, 'themes/night/fonts/inter/latin.woff2'), '');
    writeFileSync(path.join(root, 'themes/night/fonts/mono.css'), fontCss('Mono'));
    const result = await writeFormTheme(root, 'survey', {
      tokens: { font: "'inter', sans-serif" },
      themeFile,
    });
    expect(result.fonts).toEqual(['Inter']);
    const dir = path.join(root, 'forms/survey/theme');
    expect(existsSync(path.join(dir, 'fonts/inter.css'))).toBe(true);
    expect(existsSync(path.join(dir, 'fonts/inter/latin.woff2'))).toBe(true);
    expect(existsSync(path.join(dir, 'fonts/mono.css'))).toBe(false);
    const source = readFileSync(result.file, 'utf8');
    expect(source).toContain("import './fonts/inter.css';");
    expect(source).not.toContain('mono.css');
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
