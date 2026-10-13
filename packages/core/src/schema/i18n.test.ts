import { describe, expect, it } from 'vitest';
import {
  configTexts,
  formLocales,
  pickLocale,
  translate,
  translationCoverage,
  translationProblems,
} from './i18n.ts';

describe('form languages', () => {
  const config = { locale: 'zh-TW' as const, translations: { en: { 姓名: 'Name' }, ja: {} } };

  it('lists the source language first, then each translation', () => {
    expect(formLocales(config)).toEqual(['zh-TW', 'en', 'ja']);
    expect(formLocales({})).toEqual(['en']);
    expect(formLocales({}, 'ja')).toEqual(['ja']);
  });

  it('picks an explicit request, then the browser, then the source', () => {
    const available = formLocales(config);
    expect(pickLocale(available, ['ja'], ['en-US'])).toBe('ja');
    expect(pickLocale(available, [null, 'fr'], ['en-GB', 'zh-TW'])).toBe('en');
    expect(pickLocale(available, [], ['zh-Hant-HK'])).toBe('zh-TW');
    expect(pickLocale(available, [], ['ko'])).toBe('zh-TW');
    expect(pickLocale(['zh-TW'], ['en'], ['en'])).toBe('zh-TW');
  });

  it('translates by source text and falls back to it', () => {
    expect(translate(config.translations.en, '姓名')).toBe('Name');
    expect(translate(config.translations.en, '電話')).toBe('電話');
    expect(translate(undefined, '姓名')).toBe('姓名');
  });

  it('explains translations that would silently do nothing', () => {
    expect(translationProblems(config)).toEqual([]);
    expect(translationProblems({ translations: { en: {} } })[0]).toMatch(/must set `locale`/);
    const problems = translationProblems({
      locale: 'en',
      translations: { 'ja-JP': {}, en: {}, ja: { a: 1 } } as never,
    });
    expect(problems).toEqual([
      "translations.ja-JP isn't a supported locale. Did you mean 'ja'? Use one of: en, zh-TW, zh-CN, ja.",
      "translations.en is the form's own language (locale: 'en'); write that text in the form itself.",
      'translations.ja["a"] must be a string.',
    ]);
  });

  it('reports what each translation is missing and what it no longer needs', () => {
    const coverage = translationCoverage(['姓名', '電話', '姓名'], {
      en: { 姓名: 'Name', 地址: 'Address' },
    });
    expect(coverage).toEqual([{ locale: 'en', total: 2, missing: ['電話'], unused: ['地址'] }]);
  });

  it('counts the config strings respondents see', () => {
    expect(
      configTexts({
        title: '回饋',
        success: { title: '謝謝', redirect: 'https://x' },
        submissions: { fullMessage: '額滿了' },
      }),
    ).toEqual(['回饋', '謝謝', '額滿了']);
  });
});
