const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(data: Uint8Array, previous = 0): number {
  let crc = previous ^ 0xffffffff;
  for (const byte of data) crc = (CRC_TABLE[(crc ^ byte) & 0xff] as number) ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

export type ZipStreamEntry = {
  name: string;
  /** Opened only when the archive reaches the entry; null skips it. */
  open(): Promise<ReadableStream<Uint8Array> | null>;
};

const UTF8_NAMES = 1 << 11;
const DATA_DESCRIPTOR = 1 << 3;
const MAX32 = 0xffffffff;
// Timestamps are fixed (1980-01-01, the DOS epoch) so identical data zips identically.
const DOS_DATE = (0 << 9) | (1 << 5) | 1;

/**
 * A ZIP of stored (uncompressed) entries, written as it streams: each entry's
 * CRC and size follow its bytes, so no file is held in memory. Uploads are
 * mostly photos, PDFs and Office files, which are compressed already.
 * Archives past 4 GB get ZIP64 records; a single entry stays under 4 GB.
 */
export function zipStream(entries: readonly ZipStreamEntry[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const centrals: Uint8Array[] = [];
  const used = new Set<string>();
  let offset = 0;
  let count = 0;
  let index = 0;

  type Open = {
    name: Uint8Array;
    start: number;
    reader: ReadableStreamDefaultReader<Uint8Array>;
    crc: number;
    size: number;
  };
  let current: Open | null = null;

  /** The next entry that still has a file, with its local header; null at the end. */
  async function begin(): Promise<{ entry: Open; header: Uint8Array } | null> {
    for (;;) {
      const next = entries[index++];
      if (!next) return null;
      const body = await next.open();
      if (!body) continue;
      const name = encoder.encode(uniqueName(next.name, used));
      const header = new Uint8Array(30 + name.length);
      const l = new DataView(header.buffer);
      l.setUint32(0, 0x04034b50, true);
      l.setUint16(4, 20, true);
      l.setUint16(6, UTF8_NAMES | DATA_DESCRIPTOR, true);
      l.setUint16(12, DOS_DATE, true);
      l.setUint16(26, name.length, true);
      header.set(name, 30);
      const entry = { name, start: offset, reader: body.getReader(), crc: 0, size: 0 };
      offset += header.length;
      return { entry, header };
    }
  }

  /** The entry's data descriptor, and its central directory record for later. */
  function finish({ name, start, crc, size }: Open): Uint8Array {
    offset += size;
    const descriptor = new Uint8Array(16);
    const d = new DataView(descriptor.buffer);
    d.setUint32(0, 0x08074b50, true);
    d.setUint32(4, crc, true);
    d.setUint32(8, size, true);
    d.setUint32(12, size, true);
    offset += descriptor.length;

    const far = start > MAX32;
    const central = new Uint8Array(46 + name.length + (far ? 12 : 0));
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, far ? 45 : 20, true);
    c.setUint16(6, far ? 45 : 20, true);
    c.setUint16(8, UTF8_NAMES | DATA_DESCRIPTOR, true);
    c.setUint16(14, DOS_DATE, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, size, true);
    c.setUint32(24, size, true);
    c.setUint16(28, name.length, true);
    c.setUint16(30, far ? 12 : 0, true);
    c.setUint32(42, far ? MAX32 : start, true);
    central.set(name, 46);
    if (far) {
      c.setUint16(46 + name.length, 0x0001, true);
      c.setUint16(48 + name.length, 8, true);
      c.setBigUint64(50 + name.length, BigInt(start), true);
    }
    centrals.push(central);
    count++;
    return descriptor;
  }

  function end(): Uint8Array {
    const centralStart = offset;
    const centralSize = centrals.reduce((sum, c) => sum + c.length, 0);
    const zip64 = centralStart + centralSize > MAX32 || count > 0xffff;
    const parts: Uint8Array[] = [...centrals];
    if (zip64) {
      const record = new Uint8Array(56);
      const r = new DataView(record.buffer);
      r.setUint32(0, 0x06064b50, true);
      r.setBigUint64(4, 44n, true);
      r.setUint16(12, 45, true);
      r.setUint16(14, 45, true);
      r.setBigUint64(24, BigInt(count), true);
      r.setBigUint64(32, BigInt(count), true);
      r.setBigUint64(40, BigInt(centralSize), true);
      r.setBigUint64(48, BigInt(centralStart), true);
      const locator = new Uint8Array(20);
      const k = new DataView(locator.buffer);
      k.setUint32(0, 0x07064b50, true);
      k.setBigUint64(8, BigInt(centralStart + centralSize), true);
      k.setUint32(16, 1, true);
      parts.push(record, locator);
    }
    const tail = new Uint8Array(22);
    const e = new DataView(tail.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, zip64 ? 0xffff : count, true);
    e.setUint16(10, zip64 ? 0xffff : count, true);
    e.setUint32(12, zip64 ? MAX32 : centralSize, true);
    e.setUint32(16, zip64 ? MAX32 : centralStart, true);
    parts.push(tail);

    const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
    let at = 0;
    for (const part of parts) {
      out.set(part, at);
      at += part.length;
    }
    return out;
  }

  // One chunk a pull, so a slow download holds back reading the files.
  return new ReadableStream<Uint8Array>(
    {
      async pull(controller) {
        if (!current) {
          const started = await begin();
          if (!started) {
            controller.enqueue(end());
            controller.close();
            return;
          }
          current = started.entry;
          controller.enqueue(started.header);
          return;
        }
        const { done, value } = await current.reader.read();
        if (done) {
          controller.enqueue(finish(current));
          current = null;
          return;
        }
        current.crc = crc32(value, current.crc);
        current.size += value.byteLength;
        if (current.size > MAX32) throw new Error('A file is too large for the archive.');
        controller.enqueue(value);
      },
      async cancel(reason) {
        await current?.reader.cancel(reason);
      },
    },
    { highWaterMark: 0 },
  );
}

/** `a.pdf`, then `a (2).pdf`: two respondents' files can share a name. */
function uniqueName(name: string, used: Set<string>): string {
  let candidate = name;
  const dot = name.lastIndexOf('.');
  const slash = name.lastIndexOf('/');
  const [stem, ext] = dot > slash + 1 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  for (let n = 2; used.has(candidate.toLowerCase()); n++) candidate = `${stem} (${n})${ext}`;
  used.add(candidate.toLowerCase());
  return candidate;
}
