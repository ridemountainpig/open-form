import { describe, expect, it } from 'vitest';
import {
  acceptAttribute,
  acceptProblem,
  acceptSummary,
  formatFileSize,
  parseFileSize,
  safeFileName,
  sniffFile,
} from './files.ts';
import { getMessages } from './messages.ts';
import type { FieldSchema } from './types.ts';
import { validateField, validateSubmission } from './validate.ts';

const bytes = (...values: Array<number | string>) =>
  new Uint8Array(
    values.flatMap((v) => (typeof v === 'string' ? Array.from(v, (c) => c.charCodeAt(0)) : [v])),
  );

describe('sniffFile', () => {
  it('recognizes files by their first bytes', () => {
    expect(sniffFile('a.png', bytes(0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a))?.type).toBe('image/png');
    expect(sniffFile('a.pdf', bytes('%PDF-1.4'))?.type).toBe('application/pdf');
    expect(
      sniffFile('IMG.HEIC', bytes(0, 0, 0, 24, 'ftypheic', 0, 0, 0, 0, 'mif1heic'))?.type,
    ).toBe('image/heic');
    expect(sniffFile('clip.mov', bytes(0, 0, 0, 20, 'ftypqt  ', 0, 0, 0, 0))?.type).toBe(
      'video/quicktime',
    );
  });

  it('takes Office files and text only under their own extension', () => {
    const zip = bytes(0x50, 0x4b, 0x03, 0x04, 0, 0);
    expect(sniffFile('cv.docx', zip)?.extensions).toEqual(['docx']);
    expect(sniffFile('cv.pdf', zip)).toBeUndefined();
    expect(sniffFile('notes.txt', bytes('hello 你好'))?.type).toBe('text/plain');
    expect(sniffFile('notes.txt', bytes('MZ', 0, 0))).toBeUndefined();
  });

  it('refuses what the field does not accept, and HTML or SVG under any name', () => {
    expect(sniffFile('a.png', bytes(0xff, 0xd8, 0xff), ['pdf'])).toBeUndefined();
    expect(sniffFile('a.svg', bytes('<svg xmlns="http://www.w3.org/2000/svg">'))).toBeUndefined();
    expect(sniffFile('a.html', bytes('<!doctype html>'))).toBeUndefined();
  });
});

describe('accept', () => {
  it('reads extensions and MIME patterns', () => {
    expect(acceptProblem(['pdf', '.docx', 'image/*'])).toBeUndefined();
    expect(acceptProblem(['svg'])).toMatch(/isn't a kind of file/);
    expect(acceptProblem([])).toMatch(/empty/);
    expect(acceptAttribute(['image/png', 'pdf'])).toBe('.png,.pdf');
    expect(acceptSummary(['pdf', 'docx'])).toBe('PDF, DOCX');
  });
});

describe('sizes and names', () => {
  it('parses and formats sizes', () => {
    expect(parseFileSize('10MB')).toBe(10 * 1024 * 1024);
    expect(parseFileSize('500 kb')).toBe(500 * 1024);
    expect(parseFileSize(2048)).toBe(2048);
    expect(parseFileSize('big')).toBeUndefined();
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('keeps a file name to its name', () => {
    expect(safeFileName('../../etc/passwd')).toBe('passwd');
    expect(safeFileName('C:\\Users\\me\\cv.pdf')).toBe('cv.pdf');
    expect(safeFileName('evil\u202Efdp.exe')).toBe('evilfdp.exe');
    expect(safeFileName('..')).toBe('file');
    expect([...safeFileName(`${'a'.repeat(300)}.pdf`)]).toHaveLength(200);
    expect(safeFileName(`${'a'.repeat(300)}.pdf`).endsWith('.pdf')).toBe(true);
  });
});

describe('validating file answers', () => {
  const field: FieldSchema = {
    name: 'cv',
    type: 'file',
    accept: ['pdf'],
    maxSize: 1000,
    maxFiles: 1,
    required: true,
    page: 0,
    when: [],
  };
  const en = getMessages('en');
  const upload = { token: 't', name: 'cv.pdf', size: 10, type: 'application/pdf' };

  it('checks count, size, kind and unfinished uploads the same in the browser and the server', () => {
    expect(validateField(field, [upload], en)).toBeUndefined();
    expect(validateField(field, [], en)).toBe(en.required);
    expect(validateField(field, [upload, upload], en)).toMatch(/limit is 1/);
    expect(validateField(field, [{ ...upload, size: 2000 }], en)).toMatch(/1000 B or smaller/);
    expect(validateField(field, [{ ...upload, name: 'cv.png' }], en)).toBe(en.fileType);
    expect(
      validateField(
        field,
        [{ status: 'uploading', key: 'k', name: 'cv.pdf', size: 1, type: '' }],
        en,
      ),
    ).toBe(en.fileUploading);
    expect(
      validateField(field, [{ id: 'f', name: 'cv.pdf', size: 10, type: 'application/pdf' }], en),
    ).toBeUndefined();
  });

  it('keeps only the parts of an entry a file field has', async () => {
    const schema = { id: 'f', pages: [{ index: 0, when: [] }], fields: [field] };
    const result = await validateSubmission(schema, { cv: [{ ...upload, extra: 'x' }] });
    expect(result).toEqual({ ok: true, values: { cv: [upload] } });
  });
});
