import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyThemeToForm, otherScopes, rescope } from '../editing/theme-files.ts';
import { formThemeFile, resolveThemes } from '../vite/project.ts';
import { importWarnings } from './check.ts';
import {
  addStarterTheme,
  importsCopy,
  starterCatalog,
  themeCatalog,
  themeImport,
} from './theme.ts';

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

describe('theme copy', () => {
  it('copies a starter into the form, scoped to the form, without THEME.md', async () => {
    makeForm('meetup');
    const result = await copyThemeToForm(root, 'terminal', 'meetup');
    expect(result.source).toBe('starter');
    expect(result.importPath).toBe('./theme/index.tsx');
    expect(result.files.sort()).toEqual([
      'forms/meetup/theme/index.tsx',
      'forms/meetup/theme/terminal.css',
    ]);
    expect(result.warnings).toEqual([]);
    const css = readFileSync(path.join(root, 'forms/meetup/theme/terminal.css'), 'utf8');
    expect(css).toContain('[data-of-theme="meetup"].of-root');
    expect(css).not.toContain('data-of-theme="terminal"');
    expect(formThemeFile(path.join(root, 'forms'), 'meetup')).toBe(
      path.join(root, 'forms/meetup/theme/index.tsx'),
    );
  });

  it("prefers the project's theme and leaves the form alone when it changes later", async () => {
    makeForm('signup');
    await addStarterTheme(root, 'editorial', { as: 'terminal' });
    const result = await copyThemeToForm(root, 'terminal', 'signup');
    expect(result.source).toBe('project');
    expect(result.files).toContain('forms/signup/theme/editorial.css');

    rmSync(path.join(root, 'themes'), { recursive: true });
    expect(existsSync(path.join(root, 'forms/signup/theme/index.tsx'))).toBe(true);
  });

  it('turns a single-file theme into theme/index and refuses to overwrite without --force', async () => {
    makeForm('survey');
    mkdirSync(path.join(root, 'themes'));
    writeFileSync(path.join(root, 'themes', 'night.ts'), 'export default { radius: "4px" };\n');
    const result = await copyThemeToForm(root, 'night', 'survey');
    expect(result.files).toEqual(['forms/survey/theme/index.ts']);
    expect(result.importPath).toBe('./theme/index.ts');
    await expect(copyThemeToForm(root, 'classic', 'survey')).rejects.toThrow(/already exists/);
    await expect(
      copyThemeToForm(root, 'classic', 'survey', { force: true }),
    ).resolves.toMatchObject({ files: ['forms/survey/theme/index.ts'] });
  });

  it("brings a single-file theme's own fonts along", async () => {
    makeForm('survey');
    mkdirSync(path.join(root, 'themes/fonts/inter'), { recursive: true });
    writeFileSync(
      path.join(root, 'themes', 'night.ts'),
      "import './fonts/inter.css';\nexport default { font: 'Inter' };\n",
    );
    writeFileSync(path.join(root, 'themes/fonts/inter.css'), '@font-face {}\n');
    writeFileSync(path.join(root, 'themes/fonts/inter/latin.woff2'), '');
    writeFileSync(path.join(root, 'themes/fonts/mono.css'), '@font-face {}\n');
    await copyThemeToForm(root, 'night', 'survey');
    expect(existsSync(path.join(root, 'forms/survey/theme/fonts/inter.css'))).toBe(true);
    expect(existsSync(path.join(root, 'forms/survey/theme/fonts/inter/latin.woff2'))).toBe(true);
    expect(existsSync(path.join(root, 'forms/survey/theme/fonts/mono.css'))).toBe(false);
  });

  it("spots a form whose import no longer matches its copy's file", () => {
    expect(themeImport("import theme from './theme/index.ts';")).toBe('./theme/index.ts');
    expect(themeImport('import theme from "./theme";')).toBe('./theme');
    expect(themeImport("import t from '../shared/theme/index.ts';")).toBeUndefined();
    expect(importsCopy('./theme/index.ts', './theme/index.tsx')).toBe(false);
    expect(importsCopy('./theme/index.tsx', './theme/index.tsx')).toBe(true);
    expect(importsCopy('./theme/index', './theme/index.tsx')).toBe(true);
  });

  it('rejects unknown themes and forms', async () => {
    makeForm('contact');
    await expect(copyThemeToForm(root, 'nope', 'contact')).rejects.toThrow(/No theme "nope"/);
    await expect(copyThemeToForm(root, 'classic', 'missing')).rejects.toThrow(/No form "missing"/);
  });

  it('warns about selectors still aimed at another scope', async () => {
    makeForm('rsvp');
    mkdirSync(path.join(root, 'themes', 'brand'), { recursive: true });
    writeFileSync(
      path.join(root, 'themes/brand/index.ts'),
      "import './brand.css';\nexport default {};\n",
    );
    writeFileSync(
      path.join(root, 'themes/brand/brand.css'),
      '[data-of-theme="brand"] .a {}\n[data-of-theme="old-name"] .b {}\n',
    );
    const result = await copyThemeToForm(root, 'brand', 'rsvp');
    expect(result.warnings).toEqual([expect.stringContaining('[data-of-theme="old-name"]')]);
  });

  it('rescopes every quoting style', () => {
    const css = `[data-of-theme="a"] x, [data-of-theme='a'] y, [data-of-theme=a] z, [data-of-theme="ab"] w`;
    expect(rescope(css, 'a', 'form')).toBe(
      `[data-of-theme="form"] x, [data-of-theme='form'] y, [data-of-theme=form] z, [data-of-theme="ab"] w`,
    );
    expect(otherScopes(rescope(css, 'a', 'form'), 'form')).toEqual(['ab']);
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
