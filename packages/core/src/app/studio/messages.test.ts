import { describe, expect, it } from 'vitest';
import { LOCALES } from '../../schema/index.ts';
import { dictionaries, type MessageKey } from './messages.ts';

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('Studio dictionaries', () => {
  const en = dictionaries.en;

  it.each(LOCALES)('%s keeps every placeholder of the English string', (locale) => {
    const dict = dictionaries[locale];
    for (const key of Object.keys(en) as MessageKey[]) {
      expect(typeof dict[key], `${locale} ${key}`).toBe('string');
      expect(placeholders(dict[key]), `${locale} ${key}`).toEqual(placeholders(en[key]));
    }
  });

  it('defines both forms of every plural', () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith('.other')) expect(en).toHaveProperty(key.replace(/\.other$/, '.one'));
    }
  });
});
