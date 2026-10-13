import { lstat, rm } from 'node:fs/promises';
import path from 'node:path';
import { FORM_ID_RE } from '../server/index.ts';
import type { StorageAdapter } from '../storage/index.ts';
import { assignForm, editManifest, foldersPath } from './folders.ts';

export type DeleteFormResult = {
  /** Responses erased from storage. */
  responses: number;
  /** Whether there was a `forms/<id>/` to remove. */
  removedFolder: boolean;
};

/**
 * Deletes a form for good. Its stored data goes first, so a failure can't
 * leave responses behind with no form to manage them from; then its folder
 * assignment in `.folders.json`, then `forms/<id>/` itself.
 */
export async function deleteForm(opts: {
  formsRoot: string;
  id: string;
  storage?: StorageAdapter;
}): Promise<DeleteFormResult> {
  const { formsRoot, id, storage } = opts;
  if (!FORM_ID_RE.test(id)) throw new Error(`Invalid form id "${id}".`);

  const responses = storage ? await storage.deleteForm(id) : 0;
  await editManifest(foldersPath(formsRoot), (manifest) => ({
    manifest: manifest.assignments[id] ? assignForm(manifest, id, null) : manifest,
    result: null,
  }));

  const dir = path.join(formsRoot, id);
  const entry = await lstat(dir).catch(() => null);
  // A symlinked form folder loses the link, never the files it points to.
  if (entry) await rm(dir, { recursive: entry.isDirectory(), force: true });
  return { responses, removedFolder: Boolean(entry) };
}
