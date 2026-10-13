import { describe, expect, it } from 'vitest';
import {
  formatDate,
  formatDateTime,
  getMessages,
  LOCALES,
  localeProblem,
  type Messages,
  suggestLocale,
} from './messages.ts';
import { validateField } from './validate.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('message catalogs', () => {
  const en = getMessages('en');

  it.each(LOCALES)('%s has every message, with the same placeholders as English', (locale) => {
    const messages = getMessages(locale);
    expect(messages.locale).toBe(locale);
    for (const key of Object.keys(en) as Array<keyof Messages>) {
      if (key === 'locale') continue;
      expect(messages[key], `${locale}.${key}`).toBeTruthy();
      expect(placeholders(messages[key]), `${locale}.${key}`).toEqual(placeholders(en[key]));
    }
  });

  it('falls back to English for unknown locales', () => {
    expect(getMessages(undefined).next).toBe('Next');
    expect(getMessages('fr' as never).next).toBe('Next');
  });

  it('localizes the built-in chrome', () => {
    expect(getMessages('ja').next).toBe('次へ');
    expect(getMessages('zh-CN').submit).toBe('提交');
    expect(getMessages('zh-TW').submit).toBe('送出');
  });
});

describe('locale helpers', () => {
  it('suggests the supported tag a loose one most likely means', () => {
    expect(suggestLocale('zh-Hant')).toBe('zh-TW');
    expect(suggestLocale('zh_HK')).toBe('zh-TW');
    expect(suggestLocale('zh-Hans-CN')).toBe('zh-CN');
    expect(suggestLocale('zh')).toBe('zh-CN');
    expect(suggestLocale('ja-JP')).toBe('ja');
    expect(suggestLocale('en-GB')).toBe('en');
    expect(suggestLocale('fr')).toBeUndefined();
  });

  it('explains an unsupported locale', () => {
    expect(localeProblem(undefined)).toBeUndefined();
    expect(localeProblem('ja')).toBeUndefined();
    expect(localeProblem('ja-JP')).toBe(
      `locale "ja-JP" isn't supported. Did you mean 'ja'? Use one of: en, zh-TW, zh-CN, ja.`,
    );
    expect(localeProblem('fr')).toBe(
      `locale "fr" isn't supported. Use one of: en, zh-TW, zh-CN, ja.`,
    );
  });

  it('formats dates in the locale, without shifting the day', () => {
    expect(formatDate('2026-11-14', 'en')).toBe('November 14, 2026');
    expect(formatDate('2026-11-14', 'ja')).toBe('2026年11月14日');
    expect(formatDate('2026-11-14', 'zh-CN')).toBe('2026年11月14日');
    expect(formatDate('2026-11-14', 'zh-TW')).toBe('2026年11月14日');
    expect(formatDate('soon', 'ja')).toBe('soon');
    expect(formatDateTime('2026-11-14T09:30:00Z', 'ja')).toMatch(/^2026年11月14日 \d{1,2}:30$/);
  });

  it('uses localized dates in validation messages', () => {
    const field = { name: 'day', type: 'date', min: '2026-11-14' } as const;
    expect(validateField(field as never, '2026-11-01', getMessages('ja'))).toBe(
      '2026年11月14日以降の日付を選択してください。',
    );
    expect(validateField(field as never, '2026-11-01', getMessages('en'))).toBe(
      'Pick a date on or after November 14, 2026.',
    );
  });
});
