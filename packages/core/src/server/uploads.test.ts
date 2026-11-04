import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type FormSchema, schemaVersion } from '../schema/index.ts';
import { createSqliteStorage } from '../sqlite/index.ts';
import { createMemoryFileStore } from '../storage/files.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { createOpenFormHandler, type OpenFormHandler } from './handler.ts';
import { crc32 } from './zip.ts';

const ORIGIN = 'http://localhost:3000';
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF = new TextEncoder().encode('%PDF-1.7\n...');

const schema: FormSchema = {
  id: 'apply',
  title: 'Apply',
  pages: [{ index: 0, when: [] }],
  fields: [
    { name: 'name', type: 'text', required: true, page: 0, when: [] },
    {
      name: 'resume',
      type: 'file',
      label: 'Resume',
      required: true,
      accept: ['pdf'],
      maxSize: 1024,
      page: 0,
      when: [],
    },
    {
      name: 'photos',
      type: 'file',
      accept: ['image/*'],
      maxFiles: 2,
      page: 0,
      when: [{ field: 'name', notEquals: 'skip' }],
    },
  ],
};

let now = Date.UTC(2026, 10, 2, 12);
let storage: StorageAdapter;
let files: ReturnType<typeof createMemoryFileStore>;
let handler: OpenFormHandler;

function make(opts: { publicStudio?: boolean; noFiles?: boolean } = {}) {
  return createOpenFormHandler({
    registry: {
      list: async () => ['apply'],
      load: async (id) =>
        id === 'apply'
          ? { id, schema, version: schemaVersion(schema), config: {}, validators: new Map() }
          : null,
    },
    storage,
    files: opts.noFiles ? undefined : files,
    secret: 'test-secret-0123456789abcdef',
    config: { protection: { minimumCompletionTime: false, rateLimit: false } },
    now: () => now,
    adminAuth: { authorize: (request) => request.headers.get('x-admin') === '1' },
    publicStudio: opts.publicStudio ? 'read-only' : undefined,
  });
}

const json = (path: string, body: unknown, method = 'POST') =>
  new Request(`${ORIGIN}/api${path}`, {
    method,
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(body),
  });

async function upload(field: string, name: string, bytes: Uint8Array, type = '') {
  const res = await handler(
    json('/forms/apply/uploads', { field, name, size: bytes.length, type }),
  );
  expect(res.status).toBe(201);
  const body = (await res.json()) as { token: string; upload: { url: string }; type: string };
  const put = await handler(
    new Request(`${ORIGIN}${body.upload.url}`, {
      method: 'PUT',
      headers: { origin: ORIGIN },
      body: bytes as Uint8Array<ArrayBuffer>,
    }),
  );
  expect(put.status).toBe(204);
  return { token: body.token, name, size: bytes.length, type: body.type };
}

const submit = (data: unknown) => handler(json('/forms/apply/submissions', { data }));

beforeEach(async () => {
  storage = await createSqliteStorage({ path: ':memory:' });
  files = createMemoryFileStore();
  handler = make();
  now = Date.UTC(2026, 10, 2, 12);
});

afterEach(async () => {
  await storage.close();
});

describe('uploads', () => {
  it('stores a response with its file, moved out of the pending area', async () => {
    const resume = await upload('resume', 'cv.pdf', PDF);
    const res = await submit({ name: 'Alex', resume: [resume] });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const stored = await storage.getSubmission('apply', id);
    const [file] = (stored?.data.resume ?? []) as Array<{
      id: string;
      name: string;
      type: string;
      size: number;
    }>;
    expect(file).toMatchObject({ name: 'cv.pdf', type: 'application/pdf', size: PDF.length });
    expect([...files.files.keys()]).toEqual([`apply/${file?.id}`]);
  });

  it('refuses a declared size or kind the field does not take', async () => {
    const big = await handler(
      json('/forms/apply/uploads', { field: 'resume', name: 'cv.pdf', size: 4096 }),
    );
    expect(big.status).toBe(413);
    const kind = await handler(
      json('/forms/apply/uploads', { field: 'resume', name: 'page.html', size: 10 }),
    );
    expect(kind.status).toBe(415);
    const field = await handler(
      json('/forms/apply/uploads', { field: 'name', name: 'a.pdf', size: 1 }),
    );
    expect(field.status).toBe(400);
  });

  it('judges the bytes, not the name', async () => {
    const fake = await upload('resume', 'cv.pdf', PNG);
    const res = await submit({ name: 'Alex', resume: [fake] });
    expect(res.status).toBe(422);
    expect(((await res.json()) as { errors: Record<string, string> }).errors.resume).toMatch(
      /kind of file/,
    );
  });

  it('stores a JPEG named .png as the JPEG it is', async () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
    const photo = await upload('photos', 'photo.png', jpeg);
    const resume = await upload('resume', 'cv.pdf', PDF);
    const res = await submit({ name: 'Alex', resume: [resume], photos: [photo] });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    const stored = await storage.getSubmission('apply', id);
    expect(((stored?.data.photos ?? []) as Array<{ type: string }>)[0]?.type).toBe('image/jpeg');
  });

  it('stops a body larger than it was signed for', async () => {
    const res = await handler(
      json('/forms/apply/uploads', { field: 'resume', name: 'cv.pdf', size: 4 }),
    );
    const { upload: target } = (await res.json()) as { upload: { url: string } };
    const put = await handler(
      new Request(`${ORIGIN}${target.url}`, {
        method: 'PUT',
        headers: { origin: ORIGIN },
        body: PDF as Uint8Array<ArrayBuffer>,
      }),
    );
    expect(put.status).toBe(413);
    expect(files.files.size).toBe(0);
  });

  it('never takes a stored file id from the browser, nor a token twice', async () => {
    const forged = await submit({
      name: 'Alex',
      resume: [{ id: 'x', name: 'a.pdf', size: 1, type: 'application/pdf' }],
    });
    expect(forged.status).toBe(422);

    const resume = await upload('resume', 'cv.pdf', PDF);
    expect((await submit({ name: 'Alex', resume: [resume] })).status).toBe(201);
    expect((await submit({ name: 'Sam', resume: [resume] })).status).toBe(422);
    expect(await storage.countSubmissions('apply')).toBe(1);
  });

  it('refuses a token for another field, or one that expired', async () => {
    const pdf = await upload('resume', 'cv.pdf', PDF);
    const wrong = await submit({ name: 'Alex', resume: [{ ...pdf }], photos: [{ ...pdf }] });
    expect(wrong.status).toBe(422);
    now += 25 * 60 * 60_000;
    const late = await submit({ name: 'Alex', resume: [pdf] });
    expect(((await late.json()) as { errors: Record<string, string> }).errors.resume).toMatch(
      /expired/,
    );
  });

  it('drops files from a field the answers hide', async () => {
    const photo = await upload('photos', 'a.png', PNG);
    const resume = await upload('resume', 'cv.pdf', PDF);
    const res = await submit({ name: 'skip', resume: [resume], photos: [photo] });
    expect(res.status).toBe(201);
    const { id } = (await res.json()) as { id: string };
    expect((await storage.getSubmission('apply', id))?.data.photos).toBeUndefined();
  });

  it('answers 503 without file storage', async () => {
    handler = make({ noFiles: true });
    const res = await handler(
      json('/forms/apply/uploads', { field: 'resume', name: 'cv.pdf', size: 4 }),
    );
    expect(res.status).toBe(503);
  });

  it('lets only signed-in Studio download, as an attachment, and deletes files with the response', async () => {
    handler = make({ publicStudio: true });
    const resume = await upload('resume', 'résumé.pdf', PDF);
    const { id } = (await (await submit({ name: 'Alex', resume: [resume] })).json()) as {
      id: string;
    };
    const stored = await storage.getSubmission('apply', id);
    const fileId = ((stored?.data.resume ?? []) as Array<{ id: string }>)[0]?.id;
    const url = `${ORIGIN}/api/forms/apply/submissions/${id}/files/${fileId}`;

    expect((await handler(new Request(url))).status).toBe(401);
    const res = await handler(new Request(url, { headers: { 'x-admin': '1' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-disposition')).toBe(
      `attachment; filename="r_sum_.pdf"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`,
    );
    expect(res.headers.get('content-security-policy')).toContain('sandbox');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF);

    const del = await handler(
      new Request(`${ORIGIN}/api/forms/apply/submissions/${id}`, {
        method: 'DELETE',
        headers: { origin: ORIGIN, 'x-admin': '1' },
      }),
    );
    expect(del.status).toBe(200);
    expect(files.files.size).toBe(0);
  });

  it('clears uploads no response claimed', async () => {
    await upload('resume', 'cv.pdf', PDF);
    await files.sweep?.(24 * 60 * 60_000, Date.now() + 25 * 60 * 60_000);
    expect(files.files.size).toBe(0);
  });

  it('zips every file of the matching responses, named by response number', async () => {
    const first = await upload('resume', 'cv.pdf', PDF);
    await submit({ name: 'Alex', resume: [first] });
    const second = await upload('resume', 'cv.pdf', PDF);
    const photo = await upload('photos', 'a.png', PNG);
    await submit({ name: 'Sam', resume: [second], photos: [photo] });

    const url = `${ORIGIN}/api/forms/apply/files`;
    handler = make({ publicStudio: true });
    expect((await handler(new Request(url))).status).toBe(401);
    const res = await handler(new Request(url, { headers: { 'x-admin': '1' } }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/zip');
    const entries = unzip(new Uint8Array(await res.arrayBuffer()));
    expect(entries.map((e) => e.name)).toEqual([
      'resume/1-cv.pdf',
      'resume/2-cv.pdf',
      'photos/2-a.png',
    ]);
    expect(entries[2]?.data).toEqual(PNG);

    const narrowed = await handler(new Request(`${url}?q=Alex`, { headers: { 'x-admin': '1' } }));
    expect(unzip(new Uint8Array(await narrowed.arrayBuffer())).map((e) => e.name)).toEqual([
      '1-cv.pdf',
    ]);
  });
});

/** Reads a stored-only ZIP through its central directory, checking each CRC. */
function unzip(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.length - 22;
  expect(view.getUint32(end, true)).toBe(0x06054b50);
  const count = view.getUint16(end + 10, true);
  let at = view.getUint32(end + 16, true);
  const entries: Array<{ name: string; data: Uint8Array }> = [];
  for (let i = 0; i < count; i++) {
    expect(view.getUint32(at, true)).toBe(0x02014b50);
    const crc = view.getUint32(at + 16, true);
    const size = view.getUint32(at + 20, true);
    const nameLength = view.getUint16(at + 28, true);
    const offset = view.getUint32(at + 42, true);
    const name = new TextDecoder().decode(bytes.slice(at + 46, at + 46 + nameLength));
    const localName = view.getUint16(offset + 26, true);
    const start = offset + 30 + localName + view.getUint16(offset + 28, true);
    const data = bytes.slice(start, start + size);
    expect(crc32(data)).toBe(crc);
    entries.push({ name, data });
    at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
  }
  return entries;
}
