import { createReadStream, createWriteStream } from 'node:fs';
import { chmod, mkdir, open, readdir, rename, rm, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { type FileStore, FileTooLargeError, PENDING_PREFIX } from '../storage/files.ts';

const KEY_RE = /^(?:tmp|[A-Za-z0-9][A-Za-z0-9_-]*)\/[A-Za-z0-9_-]+$/;

/**
 * Files on this machine's disk, under `.open-form/uploads/` by default: the
 * folder is `0700` and each file `0600`, like the database. Needs a disk that
 * outlives the process (a VPS, a Railway or Fly volume), never a serverless one.
 */
export function createLocalFileStore(opts: { dir: string }): FileStore {
  const root = path.resolve(opts.dir);
  const fileOf = (key: string) => {
    // Keys are always the server's own, but a path is never built from anything else.
    if (!KEY_RE.test(key)) throw new Error(`Invalid file key: ${key}`);
    return path.join(root, ...key.split('/'));
  };
  const ensureDir = async (dir: string) => {
    await mkdir(dir, { recursive: true, mode: 0o700 });
    await chmod(root, 0o700).catch(() => {});
  };

  return {
    kind: 'local',
    describe: () => `disk ${root}`,
    uploadTarget: async () => null,
    async write(key, body, maxBytes) {
      const file = fileOf(key);
      await ensureDir(path.dirname(file));
      let size = 0;
      const limit = new Transform({
        transform(chunk: Buffer, _enc, done) {
          size += chunk.byteLength;
          if (size > maxBytes) done(new FileTooLargeError());
          else done(null, chunk);
        },
      });
      try {
        await pipeline(
          Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
          limit,
          createWriteStream(file, { mode: 0o600 }),
        );
      } catch (err) {
        await unlink(file).catch(() => {});
        throw err;
      }
      return size;
    },
    async stat(key) {
      try {
        const info = await stat(fileOf(key));
        return info.isFile() ? { size: info.size } : null;
      } catch {
        return null;
      }
    },
    async readHead(key, bytes) {
      let handle: Awaited<ReturnType<typeof open>> | undefined;
      try {
        handle = await open(fileOf(key), 'r');
        const buffer = Buffer.alloc(bytes);
        const { bytesRead } = await handle.read(buffer, 0, bytes, 0);
        return new Uint8Array(buffer.subarray(0, bytesRead));
      } catch {
        return null;
      } finally {
        await handle?.close();
      }
    },
    async move(from, to) {
      const target = fileOf(to);
      await ensureDir(path.dirname(target));
      try {
        await rename(fileOf(from), target);
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw err;
      }
    },
    async download(key) {
      const file = fileOf(key);
      try {
        const info = await stat(file);
        if (!info.isFile()) return null;
        const body = Readable.toWeb(
          createReadStream(file),
        ) as unknown as ReadableStream<Uint8Array>;
        return { body, size: info.size };
      } catch {
        return null;
      }
    },
    async read(key) {
      const found = await this.download(key, { name: '', type: '' });
      return found && 'body' in found ? found.body : null;
    },
    async delete(keys) {
      for (const key of keys) await rm(fileOf(key), { force: true });
    },
    async deletePrefix(prefix) {
      const folder = prefix.replace(/\/+$/, '');
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(folder)) throw new Error(`Invalid prefix: ${prefix}`);
      await rm(path.join(root, folder), { recursive: true, force: true });
    },
    async sweep(olderThanMs, now = Date.now()) {
      const dir = path.join(root, PENDING_PREFIX);
      let names: string[];
      try {
        names = await readdir(dir);
      } catch {
        return;
      }
      for (const name of names) {
        const file = path.join(dir, name);
        const info = await stat(file).catch(() => null);
        if (info && now - info.mtimeMs > olderThanMs) await rm(file, { force: true });
      }
    },
  };
}
