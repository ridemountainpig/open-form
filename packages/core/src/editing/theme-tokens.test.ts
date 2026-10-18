import { describe, expect, it } from 'vitest';
import { validatePatch, writeThemeTokens } from './theme-tokens.ts';

const THEME = `import { defineTheme, SplitLayout } from '@open-form-build/core';
import './brand.css';

// Our brand.
export default defineTheme({
  font: 'Inter, sans-serif',
  radius: '8px', // matches the product
  colors: {
    primary: '#008150',
    surface: '#ffffff',
  },
  components: { Layout: SplitLayout },
});
`;

describe('writeThemeTokens', () => {
  it('replaces values in place and keeps comments and components', () => {
    const out = writeThemeTokens(THEME, { radius: '12px', colors: { primary: '#0f766e' } });
    expect(out).toContain("radius: '12px', // matches the product");
    expect(out).toContain("primary: '#0f766e',");
    expect(out).toContain("import './brand.css';");
    expect(out).toContain('components: { Layout: SplitLayout },');
    expect(out).toContain('// Our brand.');
  });

  it('inserts missing tokens and groups with matching indentation', () => {
    const out = writeThemeTokens(THEME, {
      buttonRadius: '999px',
      colors: { control: '#8a8f99' },
      dark: { primary: '#00bc7d' },
    });
    expect(out).toContain("  components: { Layout: SplitLayout },\n  buttonRadius: '999px',");
    expect(out).toContain("    surface: '#ffffff',\n    control: '#8a8f99',");
    expect(out).toContain("dark: { primary: '#00bc7d' }");
    expect(
      () => new Function(out.replace(/^import.*$/gm, '').replace('export default', 'return')),
    ).not.toThrow(SyntaxError);
  });

  it('removes tokens with null', () => {
    const out = writeThemeTokens(THEME, { font: null, colors: { surface: null } });
    expect(out).not.toContain('font:');
    expect(out).not.toContain('surface:');
    expect(out).toContain("primary: '#008150',");
  });

  it('turns `dark: false` into a palette when a dark color is set, and back', () => {
    const lightOnly = THEME.replace('  components:', '  dark: false,\n  components:');
    const withDark = writeThemeTokens(lightOnly, { dark: { surface: '#101828' } });
    expect(withDark).toMatch(/dark: \{\n {4}surface: '#101828',\n {2}\},/);
    expect(writeThemeTokens(withDark, { dark: false })).toContain('dark: false,');
  });

  it('keeps the quote style of the value it replaces', () => {
    const doubled = THEME.replace("radius: '8px'", 'radius: "8px"');
    expect(writeThemeTokens(doubled, { radius: '4px' })).toContain('radius: "4px"');
  });

  it('follows `const theme = defineTheme(…); export default theme`', () => {
    const source =
      "import { defineTheme } from '@open-form-build/core';\nconst theme = defineTheme({ radius: '2px' });\nexport default theme;\n";
    expect(writeThemeTokens(source, { radius: '6px' })).toContain("defineTheme({ radius: '6px' })");
  });

  it('replaces a value that was a constant, but refuses to edit inside a computed palette', () => {
    const source =
      "import { defineTheme } from '@open-form-build/core';\nconst MONO = 'monospace';\nconst palette = { primary: '#000' };\nexport default defineTheme({ font: MONO, colors: palette });\n";
    expect(writeThemeTokens(source, { font: 'serif' })).toContain("font: 'serif'");
    expect(() => writeThemeTokens(source, { colors: { primary: '#fff' } })).toThrow(
      /`colors` isn't a plain object/,
    );
  });

  it('fails clearly without a default export', () => {
    expect(() => writeThemeTokens('export const x = 1;', { radius: '1px' })).toThrow(
      /export default defineTheme/,
    );
  });
});

describe('writeThemeTokens on one-line groups', () => {
  it('adds to a one-line group on its line, and escapes what a string literal must', () => {
    const source = "export default defineTheme({\n  dark: { primary: '#111' },\n});\n";
    const out = writeThemeTokens(source, {
      dark: { background: '#000' },
      font: 'Odd\\Name\n"Inter"',
    });
    expect(out).toContain("dark: { primary: '#111', background: '#000' },");
    expect(out).toContain(`font: '${'Odd\\\\Name\\n"Inter"'}',`);
  });
});

describe('validatePatch', () => {
  it('accepts known tokens and rejects the rest', () => {
    expect(validatePatch({ radius: '8px', colors: { primary: 'oklch(0.6 0.1 160)' } })).toEqual({
      radius: '8px',
      colors: { primary: 'oklch(0.6 0.1 160)' },
    });
    expect(() => validatePatch({ components: {} })).toThrow(/Unknown token "components"/);
    expect(() => validatePatch({ colors: { brand: '#fff' } })).toThrow(/Unknown color "brand"/);
    expect(() => validatePatch({ spacing: 'huge' })).toThrow(/compact, comfortable, spacious/);
    expect(() => validatePatch({ font: 'x`;alert(1)//' })).toThrow(/single-line string/);
  });
});

describe('starter themes', () => {
  it('can be edited once added to a project', async () => {
    const { readFileSync } = await import('node:fs');
    const { findStarterThemes } = await import('../vite/project.ts');
    const { parse } = await import('@babel/parser');
    for (const theme of findStarterThemes()) {
      const source = readFileSync(theme.file, 'utf8');
      const out = writeThemeTokens(source, {
        radius: '3px',
        buttonRadius: '999px',
        colors: { primary: '#123456' },
        dark: { surface: '#010203' },
      });
      expect(() =>
        parse(out, { sourceType: 'module', plugins: ['typescript', 'jsx'] }),
      ).not.toThrow();
      expect(out, theme.id).toContain("'#123456'");
      expect(out, theme.id).toContain("'#010203'");
      expect(out, theme.id).toContain("radius: '3px'");
    }
  });
});
