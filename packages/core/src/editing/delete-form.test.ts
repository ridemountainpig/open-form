import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMemoryStorage } from '../storage/index.ts';
import { deleteForm } from './delete-form.ts';
import { FOLDERS_FILE } from './folders.ts';

let root: string;
let formsRoot: string;

const addForm = (id: string) => {
  mkdirSync(path.join(formsRoot, id, 'locales'), { recursive: true });
  writeFileSync(path.join(formsRoot, id, 'index.tsx'), 'export default () => null;\n');
  writeFileSync(path.join(formsRoot, id, 'locales', 'en.json'), '{}\n');
};

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-delete-'));
  formsRoot = path.join(root, 'forms');
  addForm('rsvp');
  addForm('contact');
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('deleteForm', () => {
  it('erases the stored data, then removes the folder and its folder assignment', async () => {
    const storage = createMemoryStorage();
    const version = await storage.ensureFormVersion('rsvp', 'v1', {
      id: 'rsvp',
      pages: [],
      fields: [],
    });
    await storage.createSubmission({ formId: 'rsvp', formVersionId: version.id, data: {} });
    writeFileSync(
      path.join(formsRoot, FOLDERS_FILE),
      JSON.stringify({
        folders: [{ id: 'f-0000000a', name: 'Events', icon: { type: 'color', value: '#e5484d' } }],
        assignments: { rsvp: 'f-0000000a', contact: 'f-0000000a' },
      }),
    );

    expect(await deleteForm({ formsRoot, id: 'rsvp', storage })).toEqual({
      responses: 1,
      removedFolder: true,
    });
    expect(existsSync(path.join(formsRoot, 'rsvp'))).toBe(false);
    expect(existsSync(path.join(formsRoot, 'contact', 'index.tsx'))).toBe(true);
    expect(await storage.countSubmissions('rsvp')).toBe(0);
    const manifest = JSON.parse(readFileSync(path.join(formsRoot, FOLDERS_FILE), 'utf8'));
    expect(manifest.assignments).toEqual({ contact: 'f-0000000a' });
  });

  it('leaves a missing folders file missing', async () => {
    await deleteForm({ formsRoot, id: 'rsvp' });
    expect(existsSync(path.join(formsRoot, FOLDERS_FILE))).toBe(false);
  });

  it('removes a symlinked form folder without touching what it points to', async () => {
    const elsewhere = path.join(root, 'shared-form');
    mkdirSync(elsewhere);
    writeFileSync(path.join(elsewhere, 'index.tsx'), 'export default () => null;\n');
    symlinkSync(elsewhere, path.join(formsRoot, 'linked'), 'dir');

    expect((await deleteForm({ formsRoot, id: 'linked' })).removedFolder).toBe(true);
    expect(existsSync(path.join(formsRoot, 'linked'))).toBe(false);
    expect(existsSync(path.join(elsewhere, 'index.tsx'))).toBe(true);
  });

  it('refuses ids that could leave forms/', async () => {
    for (const id of ['..', '../forms', 'a/b', '.hidden', '']) {
      await expect(deleteForm({ formsRoot, id })).rejects.toThrow(/Invalid form id/);
    }
    expect(existsSync(path.join(formsRoot, 'rsvp'))).toBe(true);
  });
});
