import { createContext, type ReactNode, useContext } from 'react';
import type { Locale } from '../schema/index.ts';

/**
 * Turns source text into the respondent's language; unknown text comes back
 * unchanged. `{name}` placeholders are filled from `vars` after translating,
 * so a translation can move them: `tr('{n} seats left', { n: 3 })`.
 */
export type Translator = ((text: string, vars?: Record<string, string | number>) => string) & {
  /** The language being shown. */
  locale: Locale;
  /** The language the form is written in. */
  source: Locale;
};

export type FormLanguage = {
  locale: Locale;
  source: Locale;
  /** Every language this form can be shown in, source first. */
  available: Locale[];
  setLocale(locale: Locale): void;
};

const identity = Object.assign((text: string) => text, {
  locale: 'en',
  source: 'en',
}) as Translator;

export const TranslateContext = createContext<{ tr: Translator; language: FormLanguage }>({
  tr: identity,
  language: { locale: 'en', source: 'en', available: ['en'], setLocale() {} },
});

/** `tr('姓名')` → the respondent's language, from the form's `translations`. */
export function useTranslate(): Translator {
  return useContext(TranslateContext).tr;
}

/** The language being shown and the ones available, for custom language pickers. */
export function useFormLanguage(): FormLanguage {
  return useContext(TranslateContext).language;
}

/** Translate a string inside custom markup: `<T>Early-bird pricing ends Friday.</T>` */
export function T({ children }: { children: string }) {
  return <>{useTranslate()(children)}</>;
}

/** Translate plain-string children; leave elements to their own `<T>`s. */
export function useTranslatedNode(node: ReactNode): ReactNode {
  const tr = useTranslate();
  return typeof node === 'string' ? tr(node) : node;
}
