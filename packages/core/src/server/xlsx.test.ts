import { crc32, inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import type { StoredSubmission } from '../storage/index.ts';
import type { ExportColumn } from './export.ts';
import { toXlsx } from './xlsx.ts';

function unzip(bytes: Uint8Array): Record<string, string> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const decoder = new TextDecoder();
  const files: Record<string, string> = {};
  let at = view.getUint32(end + 16, true);
  for (let i = 0; i < view.getUint16(end + 10, true); i++) {
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const local = view.getUint32(at + 42, true);
    const name = decoder.decode(bytes.subarray(at + 46, at + 46 + nameLength));
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const data = inflateRawSync(bytes.subarray(start, start + size));
    expect(crc32(data)).toBe(crc);
    files[name] = decoder.decode(data);
    at += 46 + nameLength;
  }
  return files;
}

const row = (data: Record<string, unknown>, extra: Partial<StoredSubmission> = {}) =>
  ({
    id: 's1',
    formId: 'f',
    number: 1,
    formVersionId: 'v',
    visitorHash: null,
    createdAt: '2026-10-09T03:04:05.000Z',
    data,
    ...extra,
  }) as StoredSubmission;

const cell = (sheet: string, ref: string) =>
  new RegExp(`<c r="${ref}"[^>]*>(?:<v>([^<]*)</v>|<is><t[^>]*>([^<]*)</t></is>)</c>`).exec(sheet);

describe('toXlsx', () => {
  it('writes a workbook with typed cells, dates in the form time zone and a bold header', async () => {
    const columns: ExportColumn[] = [
      { key: 'name', header: 'Name', type: 'text' },
      { key: 'age', header: 'Age', type: 'number' },
      { key: 'day', header: 'Day', type: 'date' },
      { key: 'agree', header: 'Agree', type: 'checkbox' },
      { key: 'tags', header: 'Tags', type: 'checkbox-group' },
      { key: 'note', header: 'Note', type: 'textarea' },
    ];
    const bytes = await toXlsx(
      columns,
      [row({ name: '台大 <A&B>', age: 30, day: '2026-10-30', agree: true, tags: ['a', 'b'] })],
      { timeZone: 'Asia/Taipei', language: true },
    );
    const files = unzip(bytes);
    expect(Object.keys(files).sort()).toEqual([
      '[Content_Types].xml',
      '_rels/.rels',
      'xl/_rels/workbook.xml.rels',
      'xl/styles.xml',
      'xl/workbook.xml',
      'xl/worksheets/sheet1.xml',
    ]);
    const sheet = files['xl/worksheets/sheet1.xml'] as string;

    expect(cell(sheet, 'B1')?.[2]).toBe('Submitted at (Asia/Taipei)');
    expect(sheet).toContain('<c r="A1" s="1" t="inlineStr">');
    expect(cell(sheet, 'C1')?.[2]).toBe('Language');
    expect(sheet).toContain(
      '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    );

    expect(cell(sheet, 'A2')?.[1]).toBe('1');
    // 03:04:05 UTC is 11:04:05 in Taipei, on Excel day 46304 (2026-10-09).
    expect(sheet).toContain('<c r="B2" s="2">');
    expect(Number(cell(sheet, 'B2')?.[1])).toBeCloseTo(46304 + (11 * 3600 + 4 * 60 + 5) / 86400, 9);
    expect(cell(sheet, 'C2')).toBeNull();
    expect(cell(sheet, 'D2')?.[2]).toBe('台大 &lt;A&amp;B&gt;');
    expect(sheet).toContain('<c r="E2"><v>30</v></c>');
    expect(sheet).toContain('<c r="F2" s="3"><v>46325</v></c>');
    expect(cell(sheet, 'G2')?.[2]).toBe('Yes');
    expect(cell(sheet, 'H2')?.[2]).toBe('a; b');
    expect(cell(sheet, 'I2')).toBeNull();
    expect(sheet).toContain('<autoFilter ref="A1:I2"/>');
  });

  it('keeps formulas as text and drops characters XML cannot carry', async () => {
    const sheet = unzip(
      await toXlsx([{ key: 'q', header: 'Q' }], [row({ q: '=HYPERLINK("x")\u0000\uD800' })]),
    )['xl/worksheets/sheet1.xml'] as string;
    expect(cell(sheet, 'C2')?.[2]).toBe('=HYPERLINK(&quot;x&quot;)');
    expect(sheet).not.toContain('<f>');
    expect(cell(sheet, 'B1')?.[2]).toBe('Submitted at (UTC)');
  });

  it('names columns past Z', async () => {
    const columns = Array.from({ length: 27 }, (_, i) => ({ key: `f${i}`, header: `F${i}` }));
    const files = unzip(await toXlsx(columns, [row({ f26: 'last' })]));
    expect(cell(files['xl/worksheets/sheet1.xml'] as string, 'AC2')?.[2]).toBe('last');
    expect(files['xl/workbook.xml']).toContain("'Responses'!$A$1:$AC$2");
  });
});
