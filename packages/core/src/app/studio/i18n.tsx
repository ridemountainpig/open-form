import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { format, isLocale, type Locale, suggestLocale } from '../../schema/index.ts';
import { type Dictionary, dictionaries, type MessageKey } from './messages.ts';

// Studio's own UI language — separate from a form's `locale`, which is the
// language respondents see. Remembered per browser.

const KEY = 'open-form:studio-locale';

export const STUDIO_LANGUAGES: Array<{ value: Locale; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'zh-TW', label: '繁體中文' },
  { value: 'zh-CN', label: '简体中文' },
  { value: 'ja', label: '日本語' },
];

function initialLocale(): Locale {
  try {
    const stored = localStorage.getItem(KEY);
    if (isLocale(stored)) return stored;
  } catch {}
  for (const tag of navigator.languages ?? [navigator.language]) {
    const match = suggestLocale(tag);
    if (match) return match;
  }
  return 'en';
}

type Vars = Record<string, string | number>;

export type Translate = {
  (key: MessageKey, vars?: Vars): string;
  /** Picks `<key>.one` for 1 and `<key>.other` otherwise; `{n}` is the count. */
  n(key: PluralKey, count: number, vars?: Vars): string;
  locale: Locale;
};

type PluralKey = MessageKey extends infer K
  ? K extends `${infer Base}.other`
    ? Base
    : never
  : never;

function makeTranslate(locale: Locale): Translate {
  const dict: Dictionary = dictionaries[locale];
  const fallback = dictionaries.en;
  const t = ((key: MessageKey, vars?: Vars) =>
    format(dict[key] ?? fallback[key], vars ?? {})) as Translate;
  t.n = (key, count, vars) => {
    const one = `${key}.one` as MessageKey;
    const other = `${key}.other` as MessageKey;
    const pick = count === 1 && (dict[one] ?? fallback[one]) ? one : other;
    return t(pick, { n: count, ...vars });
  };
  t.locale = locale;
  return t;
}

const I18nContext = createContext<{ t: Translate; setLocale(locale: Locale): void }>({
  t: makeTranslate('en'),
  setLocale() {},
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState(initialLocale);
  const t = useMemo(() => makeTranslate(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {}
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ t, setLocale }), [t, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): Translate {
  return useContext(I18nContext).t;
}

export function useSetLocale(): (locale: Locale) => void {
  return useContext(I18nContext).setLocale;
}
