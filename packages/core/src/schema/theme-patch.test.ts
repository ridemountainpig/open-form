import { describe, expect, it } from 'vitest';
import { diffTokens, isEmptyPatch, pickTokens } from './theme-patch.ts';

describe('diffTokens', () => {
  const base = {
    radius: '8px',
    colors: { primary: '#008150', surface: '#ffffff' },
    dark: { primary: '#00bc7d' },
  };

  it('is empty for equal tokens, treating empty strings as unset', () => {
    expect(isEmptyPatch(diffTokens(base, structuredClone(base)))).toBe(true);
    expect(isEmptyPatch(diffTokens(base, { ...base, font: '' }))).toBe(true);
  });

  it('reports changed, added and removed tokens', () => {
    const next = {
      font: 'serif',
      colors: { primary: '#0f766e' },
      dark: { primary: '#00bc7d', surface: '#101828' },
    };
    expect(diffTokens(base, next)).toEqual({
      font: 'serif',
      radius: null,
      colors: { primary: '#0f766e', surface: null },
      dark: { surface: '#101828' },
    });
  });

  it('switches the dark palette between object, false and unset', () => {
    expect(diffTokens(base, { ...base, dark: false })).toEqual({ dark: false });
    expect(diffTokens(base, { ...base, dark: undefined })).toEqual({ dark: null });
    expect(diffTokens({ dark: false }, { dark: { surface: '#000' } })).toEqual({
      dark: { surface: '#000' },
    });
    expect(diffTokens({ dark: false }, { dark: {} })).toEqual({ dark: null });
  });

  it('pickTokens drops components and copies palettes', () => {
    const theme = { radius: '2px', colors: { primary: '#000' }, components: {} };
    const tokens = pickTokens(theme);
    expect(tokens).toEqual({ radius: '2px', colors: { primary: '#000' } });
    expect(tokens.colors).not.toBe(theme.colors);
  });
});
