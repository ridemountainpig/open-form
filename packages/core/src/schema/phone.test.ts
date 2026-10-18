import { describe, expect, it } from 'vitest';
import {
  coerceValue,
  composePhone,
  type FieldSchema,
  getMessages,
  hasCountryCode,
  PHONE_COUNTRIES,
  splitPhone,
  validateField,
  validateSubmission,
} from './index.ts';

function field(partial: Partial<FieldSchema> & Pick<FieldSchema, 'name' | 'type'>): FieldSchema {
  return { page: 0, when: [], ...partial };
}

describe('composePhone', () => {
  it('adds the country code and drops the trunk prefix', () => {
    expect(composePhone('TW', '0912-345-678')).toBe('+886912345678');
    expect(composePhone('TW', '912 345 678')).toBe('+886912345678');
    expect(composePhone('GB', '(020) 7946 0958')).toBe('+442079460958');
    expect(composePhone('JP', '０９０－１２３４－５６７８')).toBe('+819012345678');
    expect(composePhone('JP', '090ー1234−5678')).toBe('+819012345678');
  });

  it("keeps a leading 0 where it's part of the number", () => {
    expect(composePhone('IT', '06 6982 1234')).toBe('+390669821234');
  });

  it('drops 1 and 8 trunk prefixes only from a full national number', () => {
    expect(composePhone('US', '1 (415) 555-0132')).toBe('+14155550132');
    expect(composePhone('US', '(415) 555-0132')).toBe('+14155550132');
    expect(composePhone('RU', '8 912 345-67-89')).toBe('+79123456789');
    expect(composePhone('RU', '812 345 67 89')).toBe('+78123456789');
  });

  it('keeps a typed + code and leaves blanks empty', () => {
    expect(composePhone('TW', '+44 20 7946 0958')).toBe('+442079460958');
    expect(composePhone('TW', '   ')).toBe('');
  });

  it('reads the 00 international prefix as +', () => {
    expect(composePhone('TW', '00886 912 345 678')).toBe('+886912345678');
    expect(composePhone('TW', '0044 20 7946 0958')).toBe('+442079460958');
    expect(hasCountryCode('0044 20 7946 0958')).toBe(true);
    expect(hasCountryCode(' +44 20')).toBe(true);
    expect(hasCountryCode('0912-345-678')).toBe(false);
  });
});

describe('splitPhone', () => {
  it('finds the country and the number after its code', () => {
    expect(splitPhone('+886912345678', 'US')).toEqual({ country: 'TW', national: '912345678' });
    expect(splitPhone('', 'TW')).toEqual({ country: 'TW', national: '' });
  });

  it('reads shared codes as the preferred country, else the main one', () => {
    expect(splitPhone('+14165550132', 'CA')).toEqual({ country: 'CA', national: '4165550132' });
    expect(splitPhone('+14155550132', 'TW')).toEqual({ country: 'US', national: '4155550132' });
    expect(splitPhone('+447700900123', 'TW').country).toBe('GB');
  });

  it('only picks offered countries', () => {
    expect(splitPhone('+14165550132', 'TW', ['TW', 'CA'])).toEqual({
      country: 'CA',
      national: '4165550132',
    });
    expect(splitPhone('+442079460958', 'TW', ['TW'])).toEqual({
      country: 'TW',
      national: '+442079460958',
    });
  });

  it('round-trips with composePhone for every country', () => {
    for (const country of PHONE_COUNTRIES) {
      const value = composePhone(country, '23456789');
      expect(splitPhone(value, country)).toEqual({ country, national: '23456789' });
    }
  });
});

describe('international tel fields', () => {
  const m = getMessages('en');
  const intl = field({ name: 'phone', type: 'tel', international: true });

  it('stores the number without separators', () => {
    expect(coerceValue(intl, ' +886 912-345-678 ')).toBe('+886912345678');
    expect(coerceValue(intl, '  ')).toBeUndefined();
    expect(coerceValue(field({ name: 'p', type: 'tel' }), '0912-345-678')).toBe('0912-345-678');
  });

  it('requires + and a country code', () => {
    expect(validateField(intl, '+886912345678', m)).toBeUndefined();
    expect(validateField(intl, '0912345678', m)).toBe(m.invalidPhone);
    expect(validateField(intl, '+886abc', m)).toBe(m.invalidPhone);
    expect(validateField(intl, '+0912345678', m)).toBe(m.invalidPhone);
    expect(validateField(intl, '+8869123456789012', m)).toBe(m.invalidPhone);
  });

  it('accepts only the listed countries', () => {
    const tw = field({ name: 'phone', type: 'tel', international: true, countries: ['TW', 'HK'] });
    expect(validateField(tw, '+85291234567', m)).toBeUndefined();
    expect(validateField(tw, '+14155550132', m)).toBe(m.phoneCountry);
  });

  it('cleans and checks submissions on the server the same way', async () => {
    const schema = { id: 'f', pages: [], fields: [intl] };
    await expect(validateSubmission(schema, { phone: '+886 912 345 678' })).resolves.toEqual({
      ok: true,
      values: { phone: '+886912345678' },
    });
    const bad = await validateSubmission(schema, { phone: '0912 345 678' });
    expect(bad.ok).toBe(false);
  });
});
