import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { FOLDER_COLORS } from './folder-colors.ts';

export { FOLDER_COLORS };

// Studio folders: an organizing layer over the flat `forms/<id>/` layout. A form
// keeps its id, URL and responses wherever it's filed. Stored in the repo as
// `forms/.folders.json` so the team shares the same structure.

export const FOLDERS_FILE = '.folders.json';

export type FolderIcon = { type: 'emoji'; value: string } | { type: 'color'; value: string };
export type Folder = { id: string; name: string; icon: FolderIcon };
export type FoldersManifest = {
  /** Sidebar order. */
  folders: Folder[];
  /** formId → folderId. Forms without an entry are unfiled. */
  assignments: Record<string, string>;
};

export const FOLDER_ID_RE = /^f-[a-f0-9]{8}$/;
const FORM_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

export function foldersPath(formsRoot: string): string {
  return path.join(formsRoot, FOLDERS_FILE);
}

export function emptyManifest(): FoldersManifest {
  return { folders: [], assignments: {} };
}

/** Keep what's valid: a hand-edited or half-merged file shouldn't break Studio. */
export function normalizeManifest(raw: unknown): FoldersManifest {
  const out = emptyManifest();
  if (typeof raw !== 'object' || raw === null) return out;
  const { folders, assignments } = raw as Partial<Record<keyof FoldersManifest, unknown>>;
  const ids = new Set<string>();
  for (const f of Array.isArray(folders) ? folders : []) {
    const folder = f as Partial<Folder>;
    if (typeof folder?.id !== 'string' || !FOLDER_ID_RE.test(folder.id) || ids.has(folder.id)) {
      continue;
    }
    if (typeof folder.name !== 'string' || !folder.name.trim()) continue;
    let icon: FolderIcon = { type: 'color', value: FOLDER_COLORS[out.folders.length % 8] };
    try {
      icon = validateIcon(folder.icon);
    } catch {}
    ids.add(folder.id);
    out.folders.push({ id: folder.id, name: folder.name.trim().slice(0, 40), icon });
  }
  if (typeof assignments === 'object' && assignments !== null) {
    for (const [formId, folderId] of Object.entries(assignments)) {
      if (FORM_ID_RE.test(formId) && typeof folderId === 'string' && ids.has(folderId)) {
        out.assignments[formId] = folderId;
      }
    }
  }
  return out;
}

export async function readManifest(file: string): Promise<FoldersManifest> {
  if (!existsSync(file)) return emptyManifest();
  try {
    return normalizeManifest(JSON.parse(await readFile(file, 'utf8')));
  } catch {
    return emptyManifest();
  }
}

export async function writeManifest(file: string, manifest: FoldersManifest): Promise<void> {
  // Stable key order keeps diffs small when the team commits the file.
  const assignments = Object.fromEntries(
    Object.entries(manifest.assignments).sort(([a], [b]) => a.localeCompare(b)),
  );
  await writeFile(file, `${JSON.stringify({ folders: manifest.folders, assignments }, null, 2)}\n`);
}

const queues = new Map<string, Promise<unknown>>();

/**
 * Read, change and write the manifest, one edit at a time per file: each edit
 * reads the file it's about to replace. Returning the manifest unchanged skips
 * the write, so no file appears where there was none.
 */
export function editManifest<T>(
  file: string,
  fn: (manifest: FoldersManifest) => { manifest: FoldersManifest; result: T },
): Promise<T> {
  const run = (queues.get(file) ?? Promise.resolve()).then(async () => {
    const current = await readManifest(file);
    const { manifest, result } = fn(current);
    if (manifest !== current) await writeManifest(file, manifest);
    return result;
  });
  queues.set(
    file,
    run.catch(() => {}),
  );
  return run;
}

export function validateName(input: unknown): string {
  const name = typeof input === 'string' ? input.trim() : '';
  if (!name || name.length > 40) throw new Error('Folder names are 1–40 characters.');
  return name;
}

export function validateIcon(input: unknown): FolderIcon {
  const icon = input as Partial<FolderIcon> | null;
  if (icon?.type === 'color' && typeof icon.value === 'string' && COLOR_RE.test(icon.value)) {
    return { type: 'color', value: icon.value.toLowerCase() };
  }
  if (
    icon?.type === 'emoji' &&
    typeof icon.value === 'string' &&
    icon.value.trim() &&
    [...icon.value.trim()].length <= 8
  ) {
    return { type: 'emoji', value: icon.value.trim() };
  }
  throw new Error('Icon must be { type: "emoji", value } or { type: "color", value: "#rrggbb" }.');
}

function folderIndex(manifest: FoldersManifest, id: string): number {
  const index = manifest.folders.findIndex((f) => f.id === id);
  if (index === -1) throw new FolderNotFound(id);
  return index;
}

export class FolderNotFound extends Error {
  constructor(id: string) {
    super(`No folder "${id}".`);
  }
}

// Each edit returns a new manifest, so a failed write never leaves a half-applied change.

export function createFolder(
  manifest: FoldersManifest,
  input: { name: unknown; icon?: unknown },
): { manifest: FoldersManifest; folder: Folder } {
  const folder: Folder = {
    id: `f-${randomUUID().replace(/-/g, '').slice(0, 8)}`,
    name: validateName(input.name),
    icon:
      input.icon === undefined
        ? { type: 'color', value: FOLDER_COLORS[manifest.folders.length % FOLDER_COLORS.length] }
        : validateIcon(input.icon),
  };
  return { manifest: { ...manifest, folders: [...manifest.folders, folder] }, folder };
}

export function updateFolder(
  manifest: FoldersManifest,
  id: string,
  input: { name?: unknown; icon?: unknown },
): { manifest: FoldersManifest; folder: Folder } {
  const index = folderIndex(manifest, id);
  const current = manifest.folders[index] as Folder;
  const folder: Folder = {
    ...current,
    ...(input.name !== undefined && { name: validateName(input.name) }),
    ...(input.icon !== undefined && { icon: validateIcon(input.icon) }),
  };
  const folders = manifest.folders.map((f, i) => (i === index ? folder : f));
  return { manifest: { ...manifest, folders }, folder };
}

/** Its forms go back to unfiled; nothing else changes. */
export function deleteFolder(manifest: FoldersManifest, id: string): FoldersManifest {
  folderIndex(manifest, id);
  return {
    folders: manifest.folders.filter((f) => f.id !== id),
    assignments: Object.fromEntries(
      Object.entries(manifest.assignments).filter(([, folderId]) => folderId !== id),
    ),
  };
}

export function reorderFolders(manifest: FoldersManifest, ids: unknown): FoldersManifest {
  const current = manifest.folders.map((f) => f.id);
  if (
    !Array.isArray(ids) ||
    ids.length !== current.length ||
    new Set(ids).size !== ids.length ||
    !ids.every((id) => current.includes(id))
  ) {
    throw new Error('Reorder needs every folder id exactly once.');
  }
  const byId = new Map(manifest.folders.map((f) => [f.id, f]));
  return { ...manifest, folders: ids.map((id) => byId.get(id) as Folder) };
}

export function assignForm(
  manifest: FoldersManifest,
  formId: unknown,
  folderId: unknown,
): FoldersManifest {
  if (typeof formId !== 'string' || !FORM_ID_RE.test(formId)) throw new Error('Invalid form id.');
  const assignments = { ...manifest.assignments };
  if (folderId === null) {
    delete assignments[formId];
  } else {
    if (typeof folderId !== 'string') throw new Error('folderId must be a folder id or null.');
    folderIndex(manifest, folderId);
    assignments[formId] = folderId;
  }
  return { ...manifest, assignments };
}
