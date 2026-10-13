import { describe, expect, it } from 'vitest';
import {
  inlineTranslation,
  jsonTranslation,
  renameInlineKey,
  renameJsonKey,
  setInlineTranslation,
  setJsonTranslation,
  translationTables,
} from './translations.ts';

const SOURCE = [
  "import ja from './locales/ja.json';",
  'const zhTW = {',
  "  'First name': '名字',",
  "  Email: 'Email',",
  '};',
  'export const config = defineForm({',
  "  locale: 'en',",
  "  translations: { 'zh-TW': zhTW, ja },",
  '});',
].join('\n');

const JSON_TABLE = '{\n    "First name": "名",\n    "Email": "メール"\n}\n';

describe('translation tables', () => {
  it('finds imported JSON and inline tables', () => {
    expect(translationTables(SOURCE)).toEqual([
      { locale: 'zh-TW', kind: 'inline' },
      { locale: 'ja', kind: 'json', specifier: './locales/ja.json' },
    ]);
  });

  it('reads and writes inline entries', () => {
    expect(inlineTranslation(SOURCE, 'zh-TW', 'First name')).toBe('名字');
    const out = setInlineTranslation(SOURCE, 'zh-TW', 'First name', '名');
    expect(out).toContain("'First name': '名',");
    expect(() => setInlineTranslation(SOURCE, 'zh-TW', 'Nope', 'x')).toThrow(/Add "Nope"/);
  });

  it('renames or copies inline keys', () => {
    expect(renameInlineKey(SOURCE, 'zh-TW', 'First name', 'Given name', false)).toContain(
      "  'Given name': '名字',",
    );
    const copied = renameInlineKey(SOURCE, 'zh-TW', 'Email', 'E-mail', true);
    expect(copied).toContain("  Email: 'Email',\n  'E-mail': 'Email',");
  });

  it('edits JSON tables keeping order and indent', () => {
    expect(jsonTranslation(JSON_TABLE, 'Email')).toBe('メール');
    expect(renameJsonKey(JSON_TABLE, 'First name', 'Given name', false)).toBe(
      '{\n    "Given name": "名",\n    "Email": "メール"\n}\n',
    );
    expect(renameJsonKey(JSON_TABLE, 'Email', 'E-mail', true)).toContain(
      '"Email": "メール",\n    "E-mail": "メール"',
    );
    expect(setJsonTranslation(JSON_TABLE, 'Phone', '電話')).toContain('"Phone": "電話"\n}');
  });
});
