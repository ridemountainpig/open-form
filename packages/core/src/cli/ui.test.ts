import { stripVTControlCharacters } from 'node:util';
import { describe, expect, it } from 'vitest';
import { displayWidth, table } from './ui.ts';

describe('table', () => {
  it('counts CJK characters as two columns', () => {
    expect(displayWidth('ab')).toBe(2);
    expect(displayWidth('問卷')).toBe(4);
    expect(displayWidth('Ｆｕｌｌ')).toBe(8);
    expect(displayWidth('Launch 🚀')).toBe(9);
    expect(displayWidth('Cafe\u0301')).toBe(4);
    expect(displayWidth('Dev 👩\u200d💻')).toBe(6);
  });

  it('lines up columns after wide titles', () => {
    const out = stripVTControlCharacters(
      table(
        ['ID', 'TITLE', 'N'],
        [
          ['a', '咖啡店回饋', '1'],
          ['b', 'Feedback', '2'],
        ],
      ),
    );
    const [, first, second] = out.split('\n');
    expect(displayWidth(first?.slice(0, first.lastIndexOf('1')) ?? '')).toBe(
      displayWidth(second?.slice(0, second.lastIndexOf('2')) ?? ''),
    );
  });
});
