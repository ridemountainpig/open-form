import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assignForm,
  createFolder,
  deleteFolder,
  emptyManifest,
  normalizeManifest,
  readManifest,
  reorderFolders,
  updateFolder,
  writeManifest,
} from './folders.ts';

describe('folders manifest', () => {
  it('creates folders with ids and cycling default colors', () => {
    const a = createFolder(emptyManifest(), { name: '  Events ' });
    const b = createFolder(a.manifest, { name: 'Research', icon: { type: 'emoji', value: '🔬' } });
    expect(a.folder.id).toMatch(/^f-[a-f0-9]{8}$/);
    expect(a.folder).toMatchObject({ name: 'Events', icon: { type: 'color', value: '#e5484d' } });
    expect(b.manifest.folders.map((f) => f.name)).toEqual(['Events', 'Research']);
    expect(() => createFolder(emptyManifest(), { name: ' ' })).toThrow(/1–40 characters/);
    expect(() =>
      createFolder(emptyManifest(), { name: 'x', icon: { type: 'color', value: 'red' } }),
    ).toThrow(/Icon must be/);
  });

  it('assigns, moves and unfiles forms; deleting a folder unfiles its forms', () => {
    let { manifest, folder } = createFolder(emptyManifest(), { name: 'Events' });
    manifest = assignForm(manifest, 'meetup', folder.id);
    manifest = assignForm(manifest, 'conf', folder.id);
    manifest = assignForm(manifest, 'conf', null);
    expect(manifest.assignments).toEqual({ meetup: folder.id });
    expect(() => assignForm(manifest, 'meetup', 'f-00000000')).toThrow(/No folder/);
    expect(() => assignForm(manifest, '../x', folder.id)).toThrow(/Invalid form id/);
    expect(deleteFolder(manifest, folder.id)).toEqual(emptyManifest());
  });

  it('renames, recolors and reorders', () => {
    const one = createFolder(emptyManifest(), { name: 'A' });
    const two = createFolder(one.manifest, { name: 'B' });
    const renamed = updateFolder(two.manifest, one.folder.id, {
      name: 'Alpha',
      icon: { type: 'color', value: '#0091FF' },
    });
    expect(renamed.folder).toMatchObject({ name: 'Alpha', icon: { value: '#0091ff' } });
    const ids = [two.folder.id, one.folder.id];
    expect(reorderFolders(renamed.manifest, ids).folders.map((f) => f.id)).toEqual(ids);
    expect(() => reorderFolders(renamed.manifest, [one.folder.id])).toThrow(/exactly once/);
  });

  it('tolerates a missing, broken or hand-edited file', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'of-folders-'));
    const file = path.join(dir, '.folders.json');
    expect(await readManifest(file)).toEqual(emptyManifest());
    await writeFile(file, '{ not json');
    expect(await readManifest(file)).toEqual(emptyManifest());
    expect(
      normalizeManifest({
        folders: [
          { id: 'f-0000000a', name: 'Kept', icon: { type: 'emoji', value: '📁' } },
          { id: 'bad', name: 'Dropped' },
          { id: 'f-0000000b', name: 'No icon' },
        ],
        assignments: { meetup: 'f-0000000a', ghost: 'f-ffffffff', '../x': 'f-0000000a' },
      }),
    ).toEqual({
      folders: [
        { id: 'f-0000000a', name: 'Kept', icon: { type: 'emoji', value: '📁' } },
        { id: 'f-0000000b', name: 'No icon', icon: { type: 'color', value: '#f76b15' } },
      ],
      assignments: { meetup: 'f-0000000a' },
    });
  });

  it('writes stable, readable JSON', async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), 'of-folders-'));
    const file = path.join(dir, '.folders.json');
    let { manifest, folder } = createFolder(emptyManifest(), { name: 'Events' });
    manifest = assignForm(assignForm(manifest, 'zeta', folder.id), 'alpha', folder.id);
    await writeManifest(file, manifest);
    const text = await readFile(file, 'utf8');
    expect(text.endsWith('}\n')).toBe(true);
    expect(Object.keys(JSON.parse(text).assignments)).toEqual(['alpha', 'zeta']);
    expect(await readManifest(file)).toEqual(manifest);
  });
});
