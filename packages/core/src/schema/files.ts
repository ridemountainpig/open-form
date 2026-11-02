// File uploads: which kinds of file a form can take, how each is recognized by
// its first bytes, and the shapes an answer has on its way in and once stored.
// Shared by the browser (what to offer, early errors) and the server (the
// verdict, from the bytes that actually arrived).

export type FileKind = {
  /** The MIME type stored and served for files of this kind. */
  type: string;
  /** Lowercase, without the dot. The first is the usual one. */
  extensions: readonly string[];
  /** Whether a file's first bytes are this kind. */
  sniff: (head: Uint8Array) => boolean;
  /**
   * The bytes can't tell it from other kinds (text, ZIP-based Office files), so
   * a file is only taken as this kind under one of its own extensions.
   */
  byNameOnly?: boolean;
};

const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));

function startsWith(head: Uint8Array, bytes: readonly number[], offset = 0): boolean {
  if (head.length < offset + bytes.length) return false;
  return bytes.every((byte, i) => head[offset + i] === byte);
}

/** An ISO base media file (`....ftyp<brand>`) whose major or a compatible brand is one of `brands`. */
function ftyp(brands: readonly string[]) {
  return (head: Uint8Array) => {
    if (!startsWith(head, ascii('ftyp'), 4)) return false;
    const size = Math.min(
      head.length,
      ((head[0] ?? 0) << 24) | ((head[1] ?? 0) << 16) | ((head[2] ?? 0) << 8) | (head[3] ?? 0),
    );
    const text = String.fromCharCode(...head.subarray(8, Math.max(8, size)));
    return brands.some((brand) => {
      for (let i = 0; i + 4 <= text.length; i += 4) {
        if (i === 4) continue; // minor version
        if (text.slice(i, i + 4) === brand) return true;
      }
      return false;
    });
  };
}

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const isZip = (head: Uint8Array) => startsWith(head, ZIP);

/** Text a person wrote: no NUL bytes, and UTF-8 (a cut-off last character is fine). */
function isText(head: Uint8Array): boolean {
  if (head.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(head, { stream: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Every kind of file a form can accept. Nothing a browser would run or render
 * as a page (HTML, SVG, scripts, executables) is here, so it can't be uploaded.
 */
export const FILE_KINDS: readonly FileKind[] = [
  {
    type: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    sniff: (h) => startsWith(h, [0xff, 0xd8, 0xff]),
  },
  {
    type: 'image/png',
    extensions: ['png'],
    sniff: (h) => startsWith(h, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  {
    type: 'image/gif',
    extensions: ['gif'],
    sniff: (h) => startsWith(h, ascii('GIF87a')) || startsWith(h, ascii('GIF89a')),
  },
  {
    type: 'image/webp',
    extensions: ['webp'],
    sniff: (h) => startsWith(h, ascii('RIFF')) && startsWith(h, ascii('WEBP'), 8),
  },
  {
    type: 'image/heic',
    extensions: ['heic', 'heif'],
    sniff: ftyp(['heic', 'heix', 'heim', 'heis', 'hevc', 'hevx', 'mif1', 'msf1']),
  },
  { type: 'image/avif', extensions: ['avif'], sniff: ftyp(['avif', 'avis']) },
  { type: 'application/pdf', extensions: ['pdf'], sniff: (h) => startsWith(h, ascii('%PDF-')) },
  {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensions: ['docx'],
    sniff: isZip,
    byNameOnly: true,
  },
  {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    extensions: ['xlsx'],
    sniff: isZip,
    byNameOnly: true,
  },
  {
    type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensions: ['pptx'],
    sniff: isZip,
    byNameOnly: true,
  },
  {
    type: 'application/zip',
    extensions: ['zip'],
    sniff: (h) => isZip(h) || startsWith(h, [0x50, 0x4b, 0x05, 0x06]),
    byNameOnly: true,
  },
  { type: 'text/plain', extensions: ['txt'], sniff: isText, byNameOnly: true },
  { type: 'text/csv', extensions: ['csv'], sniff: isText, byNameOnly: true },
  { type: 'text/markdown', extensions: ['md'], sniff: isText, byNameOnly: true },
  {
    type: 'audio/mpeg',
    extensions: ['mp3'],
    sniff: (h) => startsWith(h, ascii('ID3')) || (h[0] === 0xff && ((h[1] ?? 0) & 0xe0) === 0xe0),
  },
  { type: 'audio/mp4', extensions: ['m4a'], sniff: ftyp(['M4A ', 'M4B ', 'mp42', 'isom']) },
  {
    type: 'audio/wav',
    extensions: ['wav'],
    sniff: (h) => startsWith(h, ascii('RIFF')) && startsWith(h, ascii('WAVE'), 8),
  },
  {
    type: 'video/mp4',
    extensions: ['mp4', 'm4v'],
    sniff: ftyp(['isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash']),
  },
  {
    type: 'video/quicktime',
    extensions: ['mov'],
    sniff: (h) =>
      ftyp(['qt  '])(h) ||
      ['moov', 'mdat', 'wide', 'free', 'skip'].some((b) => startsWith(h, ascii(b), 4)),
  },
];

/** How many bytes the server reads to recognize a file. */
export const SNIFF_BYTES = 4096;
/** A field's `maxSize` when it sets none: 10 MB. */
export const DEFAULT_MAX_FILE_SIZE = 10 * 1024 * 1024;
/** The most any field may allow per file: 100 MB. */
export const MAX_FILE_SIZE = 100 * 1024 * 1024;
/** The most files one field may take. */
export const MAX_FILES = 20;
/** Stored file names are cut to this many characters. */
const FILE_NAME_MAX = 200;

export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot <= 0 ? '' : name.slice(dot + 1).toLowerCase();
}

const byExtension = new Map(
  FILE_KINDS.flatMap((kind) => kind.extensions.map((ext) => [ext, kind])),
);
const byType = new Map(FILE_KINDS.map((kind) => [kind.type, kind]));

/** The kind a file's name says it is (or, failing that, the type the browser reported). */
export function fileKindOf(name: string, type?: string): FileKind | undefined {
  return (
    byExtension.get(fileExtension(name)) ?? (type ? byType.get(type.toLowerCase()) : undefined)
  );
}

/** The kind stored under this MIME type. */
export function fileKindOfType(type: string): FileKind | undefined {
  return byType.get(type.toLowerCase());
}

/** One `accept` entry: an extension (`'pdf'`, `'.pdf'`) or a MIME type (`'application/pdf'`, `'image/*'`). */
function entryMatches(entry: string, kind: FileKind): boolean {
  const value = entry.trim().toLowerCase();
  if (value.includes('/')) {
    if (value.endsWith('/*')) return kind.type.startsWith(value.slice(0, -1));
    return kind.type === value;
  }
  return kind.extensions.includes(value.replace(/^\./, ''));
}

/** The kinds a field takes: those its `accept` names, or every kind when it names none. */
export function acceptedKinds(accept?: readonly string[]): FileKind[] {
  if (!accept?.length) return [...FILE_KINDS];
  return FILE_KINDS.filter((kind) => accept.some((entry) => entryMatches(entry, kind)));
}

/** Why an `accept` list can't be used, or undefined. */
export function acceptProblem(accept: readonly string[] | undefined): string | undefined {
  if (accept === undefined) return undefined;
  if (accept.length === 0) return '`accept` is empty; leave it out to take every supported kind.';
  const unknown = accept.find((entry) => !FILE_KINDS.some((kind) => entryMatches(entry, kind)));
  if (unknown === undefined) return undefined;
  const supported = FILE_KINDS.map((kind) => kind.extensions[0]).join(', ');
  return `\`accept\` names ${JSON.stringify(unknown)}, which isn't a kind of file Open Form takes. Supported: ${supported}, or MIME types such as "image/*".`;
}

/** For `<input accept>`: every extension of every accepted kind. */
export function acceptAttribute(accept?: readonly string[]): string {
  return acceptedKinds(accept)
    .flatMap((kind) => kind.extensions.map((ext) => `.${ext}`))
    .join(',');
}

/** "PDF, DOCX" for a hint; empty when the field takes every kind. */
export function acceptSummary(accept?: readonly string[]): string {
  if (!accept?.length) return '';
  return acceptedKinds(accept)
    .map((kind) => kind.extensions[0]?.toUpperCase())
    .join(', ');
}

/**
 * What the bytes say a file is, among the kinds a field takes: the kind its
 * name claims when the bytes agree, else any accepted kind the bytes prove
 * (a JPEG saved as `.png`). ZIP-based Office files and text are only taken
 * under their own extension, since their first bytes can't tell them apart.
 */
export function sniffFile(
  name: string,
  head: Uint8Array,
  accept?: readonly string[],
): FileKind | undefined {
  const kinds = acceptedKinds(accept);
  const claimed = byExtension.get(fileExtension(name));
  if (claimed && kinds.includes(claimed) && claimed.sniff(head)) return claimed;
  return kinds.find((kind) => !kind.byNameOnly && kind.sniff(head));
}

const SIZE_RE = /^\s*(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?\s*$/i;
const UNITS: Record<string, number> = { b: 1, kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 };

/** `'10MB'`, `'500 KB'` or a number of bytes, as bytes; undefined when it can't be read. */
export function parseFileSize(value: number | string): number | undefined {
  if (typeof value === 'number')
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined;
  const match = SIZE_RE.exec(value);
  if (!match) return undefined;
  const bytes = Math.floor(Number(match[1]) * (UNITS[(match[2] ?? 'b').toLowerCase()] ?? 1));
  return bytes > 0 ? bytes : undefined;
}

/** "10 MB", "512 KB": the same 1024-based units `parseFileSize` reads. */
export function formatFileSize(bytes: number, locale = 'en'): string {
  const number = (n: number) =>
    new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n);
  if (bytes >= 1024 ** 3) return `${number(bytes / 1024 ** 3)} GB`;
  if (bytes >= 1024 ** 2) return `${number(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${number(bytes / 1024)} KB`;
  return `${bytes} B`;
}

/** A respondent's file name, safe to store and show: no folders, control characters or bidi tricks. */
const BIDI = new Set([
  0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2066, 0x2067, 0x2068, 0x2069,
]);

function isHidden(char: string): boolean {
  const code = char.codePointAt(0) ?? 0;
  return code < 0x20 || code === 0x7f || BIDI.has(code);
}

/** A respondent's file name, safe to store and show: no folders, control characters or bidi tricks. */
export function safeFileName(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? '';
  const clean = [...base.normalize('NFC')]
    .filter((c) => !isHidden(c))
    .join('')
    .trim();
  if (!clean || clean === '.' || clean === '..') return 'file';
  if ([...clean].length <= FILE_NAME_MAX) return clean;
  const ext = fileExtension(clean);
  const keep = FILE_NAME_MAX - (ext ? ext.length + 1 : 0);
  return `${[...clean].slice(0, keep).join('')}${ext ? `.${ext}` : ''}`;
}

/** A file as stored with a response. */
export type StoredFile = { id: string; name: string; size: number; type: string };

/**
 * A file in the browser's copy of the answer. Uploaded ones carry the signed
 * `token` the server swaps for a `StoredFile`; the others are still on their way.
 */
export type FileEntry =
  | { token: string; name: string; size: number; type: string; expires?: number }
  | { status: 'uploading' | 'failed'; key: string; name: string; size: number; type: string };

export function isStoredFile(value: unknown): value is StoredFile {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    typeof v.size === 'number' &&
    typeof v.type === 'string'
  );
}

/** The files of a stored answer, ignoring anything that isn't one. */
/** An answer's entries in the shapes a file field takes, other keys dropped; anything else left out. */
export function coerceFileEntries(raw: unknown): Array<FileEntry | StoredFile> {
  const list = Array.isArray(raw) ? raw : [raw];
  const out: Array<FileEntry | StoredFile> = [];
  for (const item of list) {
    if (typeof item !== 'object' || item === null) continue;
    const v = item as Record<string, unknown>;
    const name = typeof v.name === 'string' ? v.name : '';
    const size = typeof v.size === 'number' && Number.isFinite(v.size) ? v.size : -1;
    const type = typeof v.type === 'string' ? v.type : '';
    if (typeof v.id === 'string') out.push({ id: v.id, name, size, type });
    else if (typeof v.token === 'string') {
      const expires = typeof v.expires === 'number' ? v.expires : undefined;
      out.push({ token: v.token, name, size, type, ...(expires ? { expires } : {}) });
    } else if (v.status === 'uploading' || v.status === 'failed') {
      out.push({ status: v.status, key: String(v.key ?? ''), name, size, type });
    }
  }
  return out;
}

export function storedFiles(value: unknown): StoredFile[] {
  return Array.isArray(value) ? value.filter(isStoredFile) : [];
}
