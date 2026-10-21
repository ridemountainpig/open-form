import appConfig from 'virtual:open-form/config';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Folder, FolderIcon, FoldersManifest } from '../../editing/folders.ts';
import { ApiError, checkSignedIn, type FormSummary, type Resource, useResource } from './api.ts';

export type { Folder, FolderIcon, FoldersManifest };

// Data several Studio surfaces share — the sidebar, the forms grid and the
// command palette — fetched once.

const FOLDERS_API = '/api/studio/folders';

async function call<T>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  checkSignedIn(res);
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ApiError(res.status, data.message ?? res.statusText);
  return data;
}

export type FoldersApi = {
  manifest: FoldersManifest;
  /** Folder edits write `forms/.folders.json`, so they exist only under `open-form dev`. */
  editable: boolean;
  folderOf(formId: string): Folder | undefined;
  create(name: string, icon?: FolderIcon): Promise<Folder>;
  update(id: string, patch: { name?: string; icon?: FolderIcon }): Promise<void>;
  remove(id: string): Promise<void>;
  reorder(ids: string[]): Promise<void>;
  assign(formId: string, folderId: string | null): Promise<void>;
};

const EDITABLE = appConfig.dev;

function useFoldersState(): FoldersApi {
  const editable = EDITABLE;
  const [manifest, setManifest] = useState<FoldersManifest>({ folders: [], assignments: {} });

  const refresh = useCallback(async () => {
    try {
      setManifest(await call<FoldersManifest>('GET', FOLDERS_API));
    } catch {}
  }, []);

  useEffect(() => {
    void refresh();
    if (!import.meta.hot) return;
    const onChange = () => void refresh();
    import.meta.hot.on('open-form:folders-changed', onChange);
    return () => import.meta.hot?.off('open-form:folders-changed', onChange);
  }, [refresh]);

  return useMemo<FoldersApi>(() => {
    const byId = new Map(manifest.folders.map((f) => [f.id, f]));
    return {
      manifest,
      editable,
      folderOf: (formId) => {
        const id = manifest.assignments[formId];
        return id ? byId.get(id) : undefined;
      },
      async create(name, icon) {
        const folder = await call<Folder>('POST', FOLDERS_API, { name, icon });
        await refresh();
        return folder;
      },
      async update(id, patch) {
        await call('PATCH', `${FOLDERS_API}/${id}`, patch);
        await refresh();
      },
      async remove(id) {
        await call('DELETE', `${FOLDERS_API}/${id}`);
        await refresh();
      },
      async reorder(ids) {
        // Optimistic: dragging should feel instant; the refresh corrects any failure.
        setManifest((m) => ({
          ...m,
          folders: ids.map((id) => byId.get(id)).filter((f): f is Folder => Boolean(f)),
        }));
        try {
          await call('PUT', `${FOLDERS_API}/reorder`, { ids });
        } finally {
          await refresh();
        }
      },
      async assign(formId, folderId) {
        setManifest((m) => {
          const assignments = { ...m.assignments };
          if (folderId) assignments[formId] = folderId;
          else delete assignments[formId];
          return { ...m, assignments };
        });
        try {
          await call('PUT', `${FOLDERS_API}/assign`, { formId, folderId });
        } finally {
          await refresh();
        }
      },
    };
  }, [manifest, refresh]);
}

type StudioData = {
  forms: Resource<{ forms: FormSummary[] }>;
  folders: FoldersApi;
};

const StudioDataContext = createContext<StudioData | null>(null);

export function StudioDataProvider({ children }: { children: ReactNode }) {
  const forms = useResource<{ forms: FormSummary[] }>('/api/forms');
  const folders = useFoldersState();
  const value = useMemo(() => ({ forms, folders }), [forms, folders]);
  return <StudioDataContext.Provider value={value}>{children}</StudioDataContext.Provider>;
}

export function useStudioData(): StudioData {
  const data = useContext(StudioDataContext);
  if (!data) throw new Error('useStudioData() must be used inside <StudioDataProvider>.');
  return data;
}

/** Drag payload type for moving a form onto a folder. */
export const FORM_DND_TYPE = 'application/x-open-form-id';
export const FOLDER_DND_TYPE = 'application/x-open-form-folder';
