import type { ObjectExpression, Program } from '@babel/types';
import {
  THEME_COLOR_KEYS,
  THEME_TOKEN_KEYS,
  type ThemePatch,
  type ThemeTokenKey,
} from '../schema/index.ts';
import { resolveObject, setPath } from './source-object.ts';

// Edits the tokens in a theme file in place: only the touched values change,
// so comments, formatting and components survive. Used by the Studio design panel.

export type { ThemePatch, ThemeTokens } from '../schema/index.ts';
export { pickTokens } from '../schema/index.ts';

export const TOKEN_KEYS = THEME_TOKEN_KEYS;
export const COLOR_KEYS = THEME_COLOR_KEYS;

type TokenKey = ThemeTokenKey;

const ALLOWED_VALUES: Partial<Record<TokenKey, readonly string[]>> = {
  spacing: ['compact', 'comfortable', 'spacious'],
  layout: ['card', 'plain'],
  colorScheme: ['light', 'dark'],
};

/** Reject anything the panel shouldn't be able to write. Returns the cleaned patch. */
export function validatePatch(input: unknown): ThemePatch {
  if (typeof input !== 'object' || input === null) throw new Error('Patch must be an object.');
  const patch = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  const text = (key: string, value: unknown) => {
    if (value === null) return null;
    if (typeof value !== 'string' || value.length > 300 || /[\n\r`]/.test(value)) {
      throw new Error(`${key} must be a single-line string.`);
    }
    return value;
  };
  for (const [key, value] of Object.entries(patch)) {
    if ((TOKEN_KEYS as readonly string[]).includes(key)) {
      const v = text(key, value);
      const allowed = ALLOWED_VALUES[key as TokenKey];
      if (v !== null && allowed && !allowed.includes(v)) {
        throw new Error(`${key} must be one of: ${allowed.join(', ')}.`);
      }
      out[key] = v;
    } else if (key === 'colors' || key === 'dark') {
      if (key === 'dark' && (value === false || value === null)) {
        out.dark = value;
        continue;
      }
      if (typeof value !== 'object' || value === null) throw new Error(`${key} must be an object.`);
      const colors: Record<string, string | null> = {};
      for (const [color, v] of Object.entries(value)) {
        if (!(COLOR_KEYS as readonly string[]).includes(color)) {
          throw new Error(`Unknown color "${color}".`);
        }
        colors[color] = text(`${key}.${color}`, v);
      }
      out[key] = colors;
    } else {
      throw new Error(`Unknown token "${key}".`);
    }
  }
  return out as ThemePatch;
}

function themeObject(program: Program): ObjectExpression {
  const exported = program.body.find((s) => s.type === 'ExportDefaultDeclaration');
  const object =
    exported?.type === 'ExportDefaultDeclaration'
      ? resolveObject(program, exported.declaration)
      : null;
  if (!object) {
    throw new Error('Could not find `export default defineTheme({ … })` in this theme file.');
  }
  return object;
}

const applyOne = (source: string, path: string[], value: string | null | false) =>
  setPath(source, themeObject, path, value);

/** Apply a token patch to theme source text. */
export function writeThemeTokens(source: string, patch: ThemePatch): string {
  let next = source;
  for (const key of TOKEN_KEYS) {
    if (key in patch) next = applyOne(next, [key], patch[key] ?? null);
  }
  for (const group of ['colors', 'dark'] as const) {
    const value = patch[group];
    if (value === undefined) continue;
    if (value === null || value === false) {
      next = applyOne(next, [group], value);
      continue;
    }
    for (const [color, v] of Object.entries(value)) {
      next = applyOne(next, [group, color], v ?? null);
    }
  }
  return next;
}
