import type { FormConfig } from './config.ts';
import { isLocale, LOCALES, type Locale, suggestLocale } from './messages.ts';

// Multilingual forms. A form is written in one source language (`locale`);
// each translation maps source strings to that language:
//
//   forms/feedback/locales/en.json   { "產品回饋": "Product feedback", … }
//
// Keys are the exact text written in the form, so the form stays readable in
// its own language and a missing entry falls back to the source text.

/** Source text → translated text. */
export type Translation = Record<string, string>;
export type Translations = Partial<Record<Locale, Translation>>;

/** Each language's own name, for language pickers. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  ja: '日本語',
};

/** The language the form is written in. */
export function sourceLocale(config: FormConfig | undefined, fallback?: Locale): Locale {
  return config?.locale ?? fallback ?? 'en';
}

/** Every language a respondent can pick: the source first, then each translation. */
export function formLocales(config: FormConfig | undefined, fallback?: Locale): Locale[] {
  const source = sourceLocale(config, fallback);
  const out: Locale[] = [source];
  for (const key of Object.keys(config?.translations ?? {})) {
    if (isLocale(key) && !out.includes(key)) out.push(key);
  }
  return out;
}

/**
 * The language to show: an explicit request (`?lang=`, a saved choice) wins,
 * then the browser's preferences, then the source language.
 */
export function pickLocale(
  available: readonly Locale[],
  requested: ReadonlyArray<string | null | undefined>,
  browser: readonly string[] = [],
): Locale {
  const match = (tag: string | null | undefined): Locale | undefined => {
    if (!tag) return undefined;
    if (isLocale(tag) && available.includes(tag)) return tag;
    const near = suggestLocale(tag);
    return near && available.includes(near) ? near : undefined;
  };
  for (const tag of requested) {
    const hit = match(tag);
    if (hit) return hit;
  }
  for (const tag of browser) {
    const hit = match(tag);
    if (hit) return hit;
  }
  return available[0] ?? 'en';
}

export function translate(translation: Translation | undefined, text: string): string {
  return translation && Object.hasOwn(translation, text) ? (translation[text] ?? text) : text;
}

/** Problems with a form's `translations` that would silently do nothing. */
export function translationProblems(config: FormConfig, fallback?: Locale): string[] {
  const problems: string[] = [];
  const translations = config.translations;
  if (translations === undefined) return problems;
  if (typeof translations !== 'object' || translations === null || Array.isArray(translations)) {
    return ['translations must be an object of { <locale>: { <source text>: <translation> } }.'];
  }
  if (Object.keys(translations).length > 0 && !config.locale) {
    problems.push(
      "a form with translations must set `locale` — the language it's written in, which the translations translate from.",
    );
  }
  const source = sourceLocale(config, fallback);
  for (const [key, value] of Object.entries(translations)) {
    if (!isLocale(key)) {
      const hint = suggestLocale(key);
      problems.push(
        `translations.${key} isn't a supported locale.${hint ? ` Did you mean '${hint}'?` : ''} Use one of: ${LOCALES.join(', ')}.`,
      );
      continue;
    }
    if (key === source) {
      problems.push(
        `translations.${key} is the form's own language (locale: '${source}'); write that text in the form itself.`,
      );
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      problems.push(`translations.${key} must map source text to translated text.`);
      continue;
    }
    const bad = Object.entries(value).find(([, v]) => typeof v !== 'string');
    if (bad) problems.push(`translations.${key}["${bad[0]}"] must be a string.`);
  }
  return problems;
}

/** Strings set in config that respondents see, besides what the form renders. */
export function configTexts(config: FormConfig | undefined): string[] {
  const policy = config?.submissions;
  return [
    config?.title,
    config?.description,
    config?.success?.title,
    config?.success?.message,
    policy?.closedMessage,
    policy?.fullMessage,
    policy?.duplicateMessage,
  ].filter((t): t is string => typeof t === 'string' && t.trim() !== '');
}

export type TranslationCoverage = {
  locale: Locale;
  total: number;
  /** Source strings with no entry in this translation. */
  missing: string[];
  /**
   * Entries the check didn't see rendered: stale keys from edited text, or text
   * that only appears for certain answers / comes from `validate` (those are fine).
   */
  unused: string[];
};

export function translationCoverage(
  texts: readonly string[],
  translations: Translations | undefined,
): TranslationCoverage[] {
  const unique = [...new Set(texts)];
  return Object.entries(translations ?? {})
    .filter(([locale]) => isLocale(locale))
    .map(([locale, translation]) => {
      const entries = translation ?? {};
      return {
        locale: locale as Locale,
        total: unique.length,
        missing: unique.filter((text) => !Object.hasOwn(entries, text)),
        unused: Object.keys(entries).filter((key) => !unique.includes(key)),
      };
    });
}
