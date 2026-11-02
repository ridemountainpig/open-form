import { mkdtemp, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileTooLargeError } from '../storage/files.ts';
import { createLocalFileStore } from './files.ts';

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'of-files-'));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const body = (text: string) => new Blob([text]).stream();

describe('local file store', () => {
  it('writes privately, moves, reads and deletes', async () => {
    const store = createLocalFileStore({ dir: path.join(dir, 'uploads') });
    expect(await store.write?.('tmp/a1', body('%PDF-1.7'), 100)).toBe(8);
    expect(((await stat(path.join(dir, 'uploads', 'tmp', 'a1'))).mode & 0o777).toString(8)).toBe(
      '600',
    );
    expect(((await stat(path.join(dir, 'uploads'))).mode & 0o777).toString(8)).toBe('700');
    expect(await store.move('tmp/a1', 'apply/a1')).toBe(true);
    expect(await store.stat('tmp/a1')).toBeNull();
    expect(new TextDecoder().decode((await store.readHead('apply/a1', 4)) ?? undefined)).toBe(
      '%PDF',
    );
    const download = await store.download('apply/a1', { name: 'a.pdf', type: 'application/pdf' });
    expect(download && 'body' in download && (await new Response(download.body).text())).toBe(
      '%PDF-1.7',
    );
    await store.deletePrefix('apply/');
    expect(await store.stat('apply/a1')).toBeNull();
  });

  it('stops at the size it allows and leaves nothing behind', async () => {
    const store = createLocalFileStore({ dir });
    await expect(store.write?.('tmp/big', body('0123456789'), 4)).rejects.toBeInstanceOf(
      FileTooLargeError,
    );
    expect(await store.stat('tmp/big')).toBeNull();
  });

  it('never builds a path from anything but its own keys', async () => {
    const store = createLocalFileStore({ dir });
    await expect(store.stat('../etc/passwd')).resolves.toBeNull();
    await expect(store.write?.('tmp/../../x', body('x'), 10)).rejects.toThrow(/Invalid file key/);
    await expect(store.deletePrefix('../')).rejects.toThrow(/Invalid prefix/);
  });

  it('sweeps old unclaimed uploads', async () => {
    const store = createLocalFileStore({ dir });
    await store.write?.('tmp/old', body('x'), 10);
    await store.sweep?.(60_000, Date.now() + 120_000);
    expect(await store.stat('tmp/old')).toBeNull();
  });
});
