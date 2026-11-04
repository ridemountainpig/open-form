/**
 * Where uploaded files' bytes live. Responses keep only each file's metadata
 * (`StoredFile` in the answer); the bytes sit under a key the server chose:
 * `tmp/<fileId>` until a response claims them, then `<formId>/<fileId>`.
 */
export type FileStore = {
  /** `'local'` for a disk the server writes itself, `'s3'` for a bucket the browser uploads to. */
  readonly kind: 'local' | 's3' | 'memory';
  /** For logs and `open-form db status`, without credentials. */
  describe(): string;
  /**
   * Where the browser PUTs a new file's bytes. `null`: to the handler's own
   * upload route, which hands them to `write`.
   */
  uploadTarget(
    key: string,
    file: { size: number; type: string },
    expiresInSeconds: number,
  ): Promise<{ url: string; headers: Record<string, string> } | null>;
  /** Stores a body the handler received, refusing more than `maxBytes`. Resolves the bytes written. */
  write?(key: string, body: ReadableStream<Uint8Array>, maxBytes: number): Promise<number>;
  /** The file's size, or null when nothing is stored under `key`. */
  stat(key: string): Promise<{ size: number } | null>;
  /** Up to `bytes` from the start of the file, for recognizing what it is. */
  readHead(key: string, bytes: number): Promise<Uint8Array | null>;
  /** Moves a file to a new key. Resolves false when there was nothing at `from`. */
  move(from: string, to: string): Promise<boolean>;
  /**
   * How Studio downloads a file: its bytes, or a short-lived URL to send the
   * browser to (a presigned bucket URL). Null when it's gone.
   */
  download(
    key: string,
    file: { name: string; type: string },
  ): Promise<{ body: ReadableStream<Uint8Array>; size: number } | { redirect: string } | null>;
  /** The file's bytes, for the server itself (a ZIP of a form's files). Null when it's gone. */
  read(key: string): Promise<ReadableStream<Uint8Array> | null>;
  delete(keys: readonly string[]): Promise<void>;
  /** Removes every file whose key starts with `prefix` (a form's files: `<formId>/`). */
  deletePrefix(prefix: string): Promise<void>;
  /** Removes uploads no response claimed, older than `olderThanMs`. Buckets may leave this to lifecycle rules. */
  sweep?(olderThanMs: number, now?: number): Promise<void>;
};

export const PENDING_PREFIX = 'tmp/';

/** In memory, for tests and the in-memory storage. */
export function createMemoryFileStore(): FileStore & { files: Map<string, Uint8Array> } {
  const files = new Map<string, Uint8Array>();
  const created = new Map<string, number>();
  const stream = (bytes: Uint8Array) =>
    new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
  return {
    kind: 'memory',
    files,
    describe: () => 'memory',
    uploadTarget: async () => null,
    async write(key, body, maxBytes) {
      const chunks: Uint8Array[] = [];
      let size = 0;
      const reader = body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) {
          await reader.cancel();
          throw new FileTooLargeError();
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
      }
      files.set(key, bytes);
      created.set(key, Date.now());
      return size;
    },
    async stat(key) {
      const bytes = files.get(key);
      return bytes ? { size: bytes.byteLength } : null;
    },
    async readHead(key, n) {
      return files.get(key)?.slice(0, n) ?? null;
    },
    async move(from, to) {
      const bytes = files.get(from);
      if (!bytes) return false;
      files.delete(from);
      files.set(to, bytes);
      created.set(to, created.get(from) ?? Date.now());
      created.delete(from);
      return true;
    },
    async download(key) {
      const bytes = files.get(key);
      return bytes ? { body: stream(bytes), size: bytes.byteLength } : null;
    },
    async read(key) {
      const bytes = files.get(key);
      return bytes ? stream(bytes) : null;
    },
    async delete(keys) {
      for (const key of keys) files.delete(key);
    },
    async deletePrefix(prefix) {
      for (const key of [...files.keys()]) if (key.startsWith(prefix)) files.delete(key);
    },
    async sweep(olderThanMs, now = Date.now()) {
      for (const key of [...files.keys()]) {
        if (key.startsWith(PENDING_PREFIX) && now - (created.get(key) ?? now) > olderThanMs) {
          files.delete(key);
        }
      }
    },
  };
}

/** A body ran past the size it was signed for. */
export class FileTooLargeError extends Error {
  constructor() {
    super('The file is larger than the upload allows.');
  }
}
