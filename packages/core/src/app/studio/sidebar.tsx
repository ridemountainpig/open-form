import appConfig from 'virtual:open-form/config';
import {
  Languages,
  LayoutGrid,
  LogIn,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Palette,
  Plus,
  Search,
  Sun,
  X,
} from 'lucide-react';
import { type ReactNode, useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { FOLDER_COLORS } from '../../editing/folder-colors.ts';
import type { Locale } from '../../schema/index.ts';
import { useThemeCatalog } from '../lib/themes.ts';
import { useStudioData } from './data.tsx';
import {
  Count,
  FolderIconChip,
  FolderRow,
  NewFolderRow,
  rowClass,
  UnfiledIcon,
  useFormDragActive,
  useMoveForm,
} from './folders.tsx';
import { STUDIO_LANGUAGES, useSetLocale, useT } from './i18n.tsx';
import { type SchemePreference, setStudioScheme, useStudioScheme } from './scheme.ts';
import { useReadOnly, useSession } from './session.tsx';
import { ChoiceMenu } from './ui.tsx';

export const UNFILED = 'unfiled';
export const IS_APPLE =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export function Logo({ className }: { className?: string }) {
  const id = useId().replace(/[^\w-]/g, '');
  const silver = `url(#${id}s)`;
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}t`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2e2e33" />
          <stop offset="1" stopColor="#050506" />
        </linearGradient>
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="7" y1="6" x2="25" y2="26">
          <stop offset="0" stopColor="#fff" />
          <stop offset=".55" stopColor="#dadadf" />
          <stop offset="1" stopColor="#8e8e97" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".32" />
          <stop offset=".4" stopColor="#fff" stopOpacity=".06" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id}t)`} />
      <rect x=".5" y=".5" width="31" height="31" rx="7.5" fill="none" stroke={`url(#${id}h)`} />
      <g fill={silver}>
        <path
          d="M10.4 10.9v1.8m0 4.2V18"
          fill="none"
          stroke={silver}
          strokeOpacity=".22"
          strokeWidth="1.5"
        />
        <circle cx="10.4" cy="8.8" r="2.1" fillOpacity=".45" />
        <rect x="15" y="7.7" width="9" height="2.2" rx="1.1" fillOpacity=".28" />
        <circle cx="10.4" cy="14.8" r="2.1" fillOpacity=".45" />
        <rect x="15" y="13.7" width="6.5" height="2.2" rx="1.1" fillOpacity=".28" />
        <circle cx="10.4" cy="21.6" r="3.6" />
        <rect x="15" y="20.5" width="10" height="2.2" rx="1.1" />
      </g>
      <path
        d="M8.9 21.7l1.05 1.05 2-2.2"
        fill="none"
        stroke="#0a0a0a"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export const SCHEME_ICON: Record<SchemePreference, ReactNode> = {
  system: <Monitor />,
  light: <Sun />,
  dark: <Moon />,
};

function SchemeMenu() {
  const t = useT();
  const scheme = useStudioScheme();
  return (
    <ChoiceMenu<SchemePreference>
      label={t('appearance.label')}
      trigger={SCHEME_ICON[scheme]}
      value={scheme}
      onSelect={setStudioScheme}
      options={(['system', 'light', 'dark'] as const).map((value) => ({
        value,
        label: t(`appearance.${value}`),
        icon: SCHEME_ICON[value],
      }))}
    />
  );
}

function LanguageMenu() {
  const t = useT();
  const setLocale = useSetLocale();
  return (
    <ChoiceMenu<Locale>
      label={t('language.label')}
      trigger={<Languages />}
      value={t.locale}
      onSelect={setLocale}
      options={STUDIO_LANGUAGES}
    />
  );
}

const SESSION_BUTTON =
  'focus-ring grid size-7 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-3.5';

function SessionButton() {
  const t = useT();
  const session = useSession();
  if (session?.info.readOnly && session.info.signIn) {
    return (
      <button
        type="button"
        onClick={session.openSignIn}
        aria-label={t('session.signInToEdit')}
        title={t('session.signInToEdit')}
        className={SESSION_BUTTON}
      >
        <LogIn aria-hidden />
      </button>
    );
  }
  if (!session?.info.canSignOut) return null;
  return (
    <button
      type="button"
      onClick={() => void session.signOut()}
      aria-label={t('session.signOut')}
      title={t('session.signOut')}
      className={SESSION_BUTTON}
    >
      <LogOut aria-hidden />
    </button>
  );
}

function SearchButton({ onSearch }: { onSearch(): void }) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onSearch}
      className="focus-ring flex h-8 w-full items-center gap-2 rounded-md border border-zinc-200 bg-white px-2 text-[13px] text-zinc-500 shadow-[0_1px_1px_rgb(0_0_0/0.03)] hover:text-zinc-800 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
    >
      <Search className="size-3.5" aria-hidden />
      {t('search.button')}
      <kbd className="ml-auto rounded border border-zinc-200 px-1 font-mono text-[10.5px] text-zinc-400 dark:border-zinc-700">
        {IS_APPLE ? '⌘K' : 'Ctrl K'}
      </kbd>
    </button>
  );
}

function SidebarContent({ onSearch }: { onSearch(): void }) {
  const t = useT();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const { forms, folders } = useStudioData();
  const themes = useThemeCatalog();
  const moveForm = useMoveForm();
  const dragHint = useFormDragActive();
  const readOnly = useReadOnly();
  const [creating, setCreating] = useState(false);

  const list = forms.data?.forms ?? [];
  const onHome = location.pathname.replace(/\/$/, '') === '/studio';
  const selected = onHome ? params.get('f') : null;
  const inThemes = location.pathname.startsWith('/studio/themes');
  const countIn = (folderId: string | null) =>
    list.filter((f) => (folders.folderOf(f.id)?.id ?? null) === folderId).length;

  const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err));

  const reorder = (draggedId: string, targetId: string, place: 'before' | 'after') => {
    if (draggedId === targetId) return;
    const ids = folders.manifest.folders.map((f) => f.id).filter((id) => id !== draggedId);
    ids.splice(ids.indexOf(targetId) + (place === 'after' ? 1 : 0), 0, draggedId);
    folders.reorder(ids).catch(fail);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <Link to="/studio" className="focus-ring flex items-center gap-2 rounded-md px-2 py-1">
        <Logo className="size-6" />
        <span className="text-[14.5px] font-semibold tracking-tight whitespace-nowrap">
          Open Form
        </span>
      </Link>

      <div className="mt-4">
        <SearchButton onSearch={onSearch} />
      </div>

      <nav aria-label={t('nav.label')} className="mt-3 space-y-0.5">
        <Link
          to="/studio"
          aria-current={onHome && !selected ? 'page' : undefined}
          className={rowClass(onHome && !selected)}
        >
          <LayoutGrid className="size-4 shrink-0 opacity-80" aria-hidden />
          {t('nav.forms')}
          <Count value={forms.data && list.length} />
        </Link>
        <Link
          to="/studio/themes"
          aria-current={inThemes ? 'page' : undefined}
          className={rowClass(inThemes)}
        >
          <Palette className="size-4 shrink-0 opacity-80" aria-hidden />
          {t('nav.themes')}
          <Count value={themes.length} />
        </Link>
      </nav>

      <div className="group/side mt-6 flex min-h-0 flex-1 flex-col">
        <div className="mb-1.5 flex items-center px-2">
          <p className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase">
            {t('folders.heading')}
          </p>
          {folders.editable && (
            <button
              type="button"
              aria-label={t('folders.new')}
              title={t('folders.new')}
              onClick={() => setCreating(true)}
              className="focus-ring -my-1 ml-auto grid size-6 place-items-center rounded text-zinc-400 opacity-0 group-hover/side:opacity-100 hover:bg-zinc-200/60 hover:text-zinc-700 focus-visible:opacity-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            >
              <Plus className="size-3.5" aria-hidden />
            </button>
          )}
        </div>
        <ul className="-mx-1 min-h-0 space-y-0.5 overflow-y-auto px-1 pb-1">
          <FolderRow
            to={`/studio?f=${UNFILED}`}
            active={selected === UNFILED}
            icon={<UnfiledIcon />}
            label={t('folders.unfiled')}
            count={countIn(null)}
            dragHint={dragHint}
            editable={folders.editable}
            onDropForm={(formId) => moveForm(formId, null)}
          />
          {folders.manifest.folders.map((folder) => (
            <FolderRow
              key={folder.id}
              to={`/studio?f=${folder.id}`}
              active={selected === folder.id}
              icon={<FolderIconChip icon={folder.icon} />}
              label={folder.name}
              count={countIn(folder.id)}
              dragHint={dragHint}
              folder={folder}
              editable={folders.editable}
              onDropForm={(formId) => moveForm(formId, folder.id)}
              onDropFolder={(id, place) => reorder(id, folder.id, place)}
              onRename={(name) => folders.update(folder.id, { name }).catch(fail)}
              onIcon={(icon) => folders.update(folder.id, { icon }).catch(fail)}
              onDelete={() => {
                folders
                  .remove(folder.id)
                  .then(() => {
                    toast.success(t('folders.deleted', { name: folder.name }));
                    if (selected === folder.id) navigate('/studio', { replace: true });
                  })
                  .catch(fail);
              }}
            />
          ))}
          {creating && (
            <NewFolderRow
              defaultIcon={{
                type: 'color',
                value:
                  FOLDER_COLORS[folders.manifest.folders.length % FOLDER_COLORS.length] ??
                  FOLDER_COLORS[0],
              }}
              onCancel={() => setCreating(false)}
              onCreate={(name, icon) => {
                setCreating(false);
                folders
                  .create(name, icon)
                  .then((folder) => navigate(`/studio?f=${folder.id}`))
                  .catch(fail);
              }}
            />
          )}
        </ul>
        {folders.editable && folders.manifest.folders.length === 0 && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="focus-ring mx-1 mt-1 flex h-8 items-center gap-2 rounded-md px-2 text-[13px] text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <Plus className="size-3.5" aria-hidden />
            {t('folders.new')}
          </button>
        )}
      </div>

      <div className="flex items-center gap-0.5 pt-3 pl-2">
        <p className="mr-auto font-mono text-[11px] text-zinc-400">
          v{appConfig.version}
          {appConfig.dev ? ' · dev' : ''}
          {readOnly ? ` · ${t('session.readOnly')}` : ''}
        </p>
        <LanguageMenu />
        <SchemeMenu />
        <SessionButton />
      </div>
    </div>
  );
}

/** Fixed on large screens; a top bar with a drawer below `lg`. */
export function Sidebar({ onSearch }: { onSearch(): void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // biome-ignore lint/correctness/useExhaustiveDependencies: close the drawer after navigating
  useEffect(() => setOpen(false), [location.pathname, location.search]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 px-3 py-4 lg:block">
        <SidebarContent onSearch={onSearch} />
      </aside>

      <div className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b border-zinc-200 bg-white/85 px-4 backdrop-blur-md lg:hidden dark:border-zinc-800 dark:bg-zinc-950/85">
        <Link to="/studio" className="focus-ring mr-auto flex items-center gap-2 rounded-md">
          <Logo className="size-6" />
          <span className="text-[14.5px] font-semibold tracking-tight">Open Form</span>
        </Link>
        <button
          type="button"
          className="focus-ring grid size-9 place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label={t('search.button')}
          onClick={onSearch}
        >
          <Search className="size-[18px]" aria-hidden />
        </button>
        <button
          type="button"
          className="focus-ring -mr-1.5 grid size-9 place-items-center rounded-md text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          aria-label={t('nav.open')}
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Menu className="size-5" aria-hidden />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label={t('nav.close')}
            className="studio-backdrop absolute inset-0 bg-zinc-950/30"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.label')}
            className="studio-sheet absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-zinc-200 bg-zinc-50 px-3 py-4 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <button
              type="button"
              aria-label={t('nav.close')}
              className="focus-ring absolute top-3.5 right-3 grid size-8 place-items-center rounded-md text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
              onClick={() => setOpen(false)}
            >
              <X className="size-4" aria-hidden />
            </button>
            <SidebarContent
              onSearch={() => {
                setOpen(false);
                onSearch();
              }}
            />
          </div>
        </div>
      )}
    </>
  );
}
