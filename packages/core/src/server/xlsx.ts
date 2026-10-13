import { DEFAULT_TIME_ZONE, wallClock } from '../schema/index.ts';
import type { StoredSubmission } from '../storage/index.ts';
import { type ExportColumn, formatCell } from './export.ts';

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const SHEET_NAME = 'Responses';
const MAX_CELL_LENGTH = 32_767;
const DAY_MS = 86_400_000;
const EXCEL_EPOCH_OFFSET = 25_569;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

// Indexes into <cellXfs> in STYLES.
const HEADER = 1;
const DATE_TIME = 2;
const DATE = 3;

type Cell = { value: string | number; style?: number; width?: number };

export type XlsxOptions = {
  language?: boolean;
  /** IANA time zone the "Submitted at" column is shown in. Default UTC. */
  timeZone?: string;
};

/** Responses as an Excel workbook: typed numbers and dates, bold frozen header, filters. */
export async function toXlsx(
  columns: readonly ExportColumn[],
  rows: readonly StoredSubmission[],
  opts: XlsxOptions = {},
): Promise<Uint8Array<ArrayBuffer>> {
  const timeZone = opts.timeZone ?? DEFAULT_TIME_ZONE;
  const meta = ['#', `Submitted at (${timeZone})`, ...(opts.language ? ['Language'] : [])];
  const header = [...meta, ...columns.map((c) => c.header)].map(
    (value): Cell => ({ value, style: HEADER }),
  );
  const table: Array<Array<Cell | null>> = [header];
  for (const row of rows) {
    table.push([
      { value: row.number },
      submittedAt(row.createdAt, timeZone),
      ...(opts.language ? [row.locale ? { value: row.locale } : null] : []),
      ...columns.map((c) => valueCell(row.data[c.key], c)),
    ]);
  }

  const files = {
    '[Content_Types].xml': CONTENT_TYPES,
    '_rels/.rels': ROOT_RELS,
    'xl/workbook.xml': workbook(header.length, table.length),
    'xl/_rels/workbook.xml.rels': WORKBOOK_RELS,
    'xl/styles.xml': STYLES,
    'xl/worksheets/sheet1.xml': worksheet(table),
  };
  const encoder = new TextEncoder();
  return zip(
    Object.entries(files).map(([name, xml]) => ({
      name,
      data: encoder.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n${xml}`),
    })),
  );
}

function submittedAt(createdAt: string, timeZone: string): Cell {
  const instant = Date.parse(createdAt);
  if (Number.isNaN(instant)) return { value: createdAt };
  const c = wallClock(instant, timeZone);
  const wall = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  return { value: excelSerial(wall), style: DATE_TIME, width: 19 };
}

function valueCell(value: unknown, column: ExportColumn): Cell | null {
  if (typeof value === 'number' && Number.isFinite(value)) return { value };
  if (column.type === 'date' && typeof value === 'string') {
    const m = DATE_RE.exec(value);
    if (m) {
      const time = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return { value: excelSerial(time), style: DATE, width: 10 };
    }
  }
  const text = formatCell(value);
  return text === '' ? null : { value: text };
}

/** Days since 1899-12-30, the epoch Excel's 1900 date system effectively uses. */
function excelSerial(utcWall: number): number {
  return utcWall / DAY_MS + EXCEL_EPOCH_OFFSET;
}

function columnName(index: number): string {
  let name = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  }
  return name;
}

// XML 1.0 can't carry control characters, lone surrogates or U+FFFE/U+FFFF;
// one of those in a cell makes Excel reject the whole file.
function isXmlChar(code: number): boolean {
  return (
    code === 0x9 ||
    code === 0xa ||
    code === 0xd ||
    (code >= 0x20 && code < 0xd800) ||
    (code > 0xdfff && code < 0xfffe) ||
    code > 0xffff
  );
}

function escapeXml(text: string): string {
  let clean = '';
  for (const char of text) if (isXmlChar(char.codePointAt(0) as number)) clean += char;
  return clean
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const WIDE =
  /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/;

function displayWidth(text: string): number {
  let widest = 0;
  for (const line of text.split('\n')) {
    let width = 0;
    for (const char of line) width += WIDE.test(char) ? 2 : 1;
    widest = Math.max(widest, width);
  }
  return widest;
}

function cellWidth({ value, width }: Cell): number {
  if (width) return width;
  return typeof value === 'string' ? displayWidth(value) : String(value).length;
}

function cellXml({ value, style }: Cell, ref: string): string {
  const s = style ? ` s="${style}"` : '';
  if (typeof value === 'number') return `<c r="${ref}"${s}><v>${value}</v></c>`;
  // Inline strings are never evaluated, so answers like "=1+1" need no escaping here.
  const text = escapeXml(value.slice(0, MAX_CELL_LENGTH));
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${text}</t></is></c>`;
}

function worksheet(table: readonly (readonly (Cell | null)[])[]): string {
  const columnCount = table[0]?.length ?? 0;
  const widths = new Array<number>(columnCount).fill(0);
  const rows: string[] = [];
  table.forEach((cells, r) => {
    const xml: string[] = [];
    cells.forEach((cell, c) => {
      if (!cell) return;
      // Header cells also hold the filter button.
      const width = cellWidth(cell) + (r === 0 ? 3 : 0);
      widths[c] = Math.max(widths[c] ?? 0, width);
      xml.push(cellXml(cell, `${columnName(c)}${r + 1}`));
    });
    rows.push(`<row r="${r + 1}">${xml.join('')}</row>`);
  });
  const cols = widths
    .map((w, i) => {
      const width = Math.min(Math.max(w + 2, 6), 60);
      return `<col min="${i + 1}" max="${i + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');
  return [
    `<worksheet xmlns="${MAIN_NS}">`,
    '<sheetViews><sheetView workbookViewId="0">',
    '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>',
    '</sheetView></sheetViews>',
    `<cols>${cols}</cols>`,
    `<sheetData>${rows.join('')}</sheetData>`,
    `<autoFilter ref="${filterRange(columnCount, table.length)}"/>`,
    '</worksheet>',
  ].join('');
}

function filterRange(columnCount: number, rowCount: number, absolute = false): string {
  const $ = absolute ? '$' : '';
  return `${$}A${$}1:${$}${columnName(columnCount - 1)}${$}${rowCount}`;
}

function workbook(columnCount: number, rowCount: number): string {
  return [
    `<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}">`,
    `<sheets><sheet name="${SHEET_NAME}" sheetId="1" r:id="rId1"/></sheets>`,
    '<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">',
    `'${SHEET_NAME}'!${filterRange(columnCount, rowCount, true)}`,
    '</definedName></definedNames>',
    '</workbook>',
  ].join('');
}

const MAIN_NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const PKG_REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

const CONTENT_TYPES = [
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">',
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
  '<Default Extension="xml" ContentType="application/xml"/>',
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
  '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
  '</Types>',
].join('');

const ROOT_RELS = [
  `<Relationships xmlns="${PKG_REL_NS}">`,
  `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/>`,
  '</Relationships>',
].join('');

const WORKBOOK_RELS = [
  `<Relationships xmlns="${PKG_REL_NS}">`,
  `<Relationship Id="rId1" Type="${REL_NS}/worksheet" Target="worksheets/sheet1.xml"/>`,
  `<Relationship Id="rId2" Type="${REL_NS}/styles" Target="styles.xml"/>`,
  '</Relationships>',
].join('');

// Order of <cellXfs> matches `Style`.
const STYLES = [
  `<styleSheet xmlns="${MAIN_NS}">`,
  '<numFmts count="2">',
  '<numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm:ss"/>',
  '<numFmt numFmtId="165" formatCode="yyyy-mm-dd"/>',
  '</numFmts>',
  '<fonts count="2">',
  '<font><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
  '<font><b/><sz val="11"/><name val="Calibri"/><family val="2"/></font>',
  '</fonts>',
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>',
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>',
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>',
  '<cellXfs count="4">',
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>',
  '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>',
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>',
  '</cellXfs>',
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>',
  '</styleSheet>',
].join('');

type ZipEntry = { name: string; data: Uint8Array<ArrayBuffer> };

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

async function deflateRaw(data: Uint8Array<ArrayBuffer>): Promise<Uint8Array<ArrayBuffer>> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

// Timestamps are fixed (1980-01-01, the DOS epoch) so identical data zips identically.
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

async function zip(entries: readonly ZipEntry[]): Promise<Uint8Array<ArrayBuffer>> {
  const encoder = new TextEncoder();
  const locals: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const compressed = await deflateRaw(entry.data);
    const crc = crc32(entry.data);

    const local = new Uint8Array(30 + name.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true);
    l.setUint16(8, 8, true);
    l.setUint16(12, DOS_DATE, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, compressed.length, true);
    l.setUint32(22, entry.data.length, true);
    l.setUint16(26, name.length, true);
    local.set(name, 30);

    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(10, 8, true);
    c.setUint16(14, DOS_DATE, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, compressed.length, true);
    c.setUint32(24, entry.data.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);

    locals.push(local, compressed);
    centrals.push(central);
    offset += local.length + compressed.length;
  }

  const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, entries.length, true);
  e.setUint16(10, entries.length, true);
  e.setUint32(12, centralSize, true);
  e.setUint32(16, offset, true);

  const out = new Uint8Array(offset + centralSize + end.length);
  let at = 0;
  for (const part of [...locals, ...centrals, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
