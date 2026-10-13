import { MoreHorizontal, PenLine } from 'lucide-react';
import {
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { FOLDER_COLORS } from '../../editing/folder-colors.ts';
import {
  FOLDER_DND_TYPE,
  FORM_DND_TYPE,
  type Folder,
  type FolderIcon,
  useStudioData,
} from './data.tsx';
import { useT } from './i18n.tsx';
import { Button, cx, Popover } from './ui.tsx';

const EMOJI = [
  '📁',
  '📌',
  '⭐',
  '🔥',
  '⚡',
  '🎯',
  '🎉',
  '📅',
  '🧪',
  '🔬',
  '💼',
  '🛒',
  '💬',
  '📝',
  '📣',
  '🎓',
  '🏷️',
  '🧭',
  '🚀',
  '💡',
  '❤️',
  '✅',
  '🌱',
  '🗳️',
];

export function FolderIconChip({ icon, className }: { icon: FolderIcon; className?: string }) {
  if (icon.type === 'emoji') {
    return (
      <span
        className={cx(
          'grid size-4 shrink-0 place-items-center text-[14px] leading-none',
          className,
        )}
      >
        {icon.value}
      </span>
    );
  }
  return (
    <span className={cx('grid size-4 shrink-0 place-items-center', className)}>
      <span
        className="size-2.5 rounded-[3px] ring-1 ring-black/10 dark:ring-white/15"
        style={{ background: icon.value }}
      />
    </span>
  );
}

// Picking an icon while naming a new folder mustn't blur (and so commit) the name input.
const keepFocus = (e: { preventDefault(): void }) => e.preventDefault();

export function IconPicker({
  value,
  onPick,
}: {
  value?: FolderIcon;
  onPick(icon: FolderIcon): void;
}) {
  const t = useT();
  const same = (icon: FolderIcon) => value?.type === icon.type && value.value === icon.value;
  const cell =
    'focus-ring grid size-7 place-items-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800';
  return (
    <fieldset
      aria-label={t('folders.changeIcon')}
      className="w-[15.5rem] min-w-0 p-2"
      onMouseDown={keepFocus}
    >
      <p className="mb-1.5 px-1 text-[11px] font-medium text-zinc-400">{t('folders.color')}</p>
      <div className="grid grid-cols-8 gap-0.5">
        {FOLDER_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={same({ type: 'color', value: color })}
            className={cx(
              cell,
              same({ type: 'color', value: color }) && 'bg-zinc-100 dark:bg-zinc-800',
            )}
            onClick={() => onPick({ type: 'color', value: color })}
          >
            <span
              className="size-3.5 rounded-[4px] ring-1 ring-black/10"
              style={{ background: color }}
            />
          </button>
        ))}
      </div>
      <p className="mt-2.5 mb-1.5 px-1 text-[11px] font-medium text-zinc-400">
        {t('folders.emoji')}
      </p>
      <div className="grid grid-cols-8 gap-0.5">
        {EMOJI.map((emoji) => (
          <button
            key={emoji}
            type="button"
            aria-label={emoji}
            aria-pressed={same({ type: 'emoji', value: emoji })}
            className={cx(
              cell,
              'text-[15px]',
              same({ type: 'emoji', value: emoji }) && 'bg-zinc-100 dark:bg-zinc-800',
            )}
            onClick={() => onPick({ type: 'emoji', value: emoji })}
          >
            {emoji}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

/** A text input that commits on Enter or blur and cancels on Escape (IME-safe). */
export function InlineName({
  initial = '',
  placeholder,
  onCommit,
  onCancel,
}: {
  initial?: string;
  placeholder?: string;
  onCommit(name: string): void;
  onCancel(): void;
}) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    const name = value.trim();
    if (commit && name && name !== initial) onCommit(name);
    else onCancel();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === 'Enter') finish(true);
    if (event.key === 'Escape') finish(false);
  };
  return (
    <input
      // biome-ignore lint/a11y/noAutofocus: the user just asked to type a name
      autoFocus
      value={value}
      maxLength={40}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={onKeyDown}
      onBlur={() => finish(true)}
      className="h-6 min-w-0 flex-1 rounded-sm bg-transparent text-[13.5px] text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100"
    />
  );
}

/** True while a form is being dragged anywhere on the page, to hint at drop targets. */
export function useFormDragActive(): boolean {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const start = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes(FORM_DND_TYPE)) setActive(true);
    };
    const end = () => setActive(false);
    document.addEventListener('dragstart', start);
    document.addEventListener('dragend', end);
    document.addEventListener('drop', end);
    return () => {
      document.removeEventListener('dragstart', start);
      document.removeEventListener('dragend', end);
      document.removeEventListener('drop', end);
    };
  }, []);
  return active;
}

type DropHandlers = {
  /** A form was dropped here. */
  onDropForm?(formId: string): void;
  /** Another folder row was dropped before / after this one. */
  onDropFolder?(folderId: string, place: 'before' | 'after'): void;
};

/** Drop handling for a sidebar row: forms move into it, folders reorder around it. */
function useDropTarget({ onDropForm, onDropFolder }: DropHandlers) {
  const depth = useRef(0);
  const [over, setOver] = useState<null | 'form' | 'before' | 'after'>(null);

  const kind = (e: DragEvent) =>
    onDropForm && e.dataTransfer.types.includes(FORM_DND_TYPE)
      ? 'form'
      : onDropFolder && e.dataTransfer.types.includes(FOLDER_DND_TYPE)
        ? 'folder'
        : null;
  const place = (e: DragEvent): 'before' | 'after' => {
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    return e.clientY < box.top + box.height / 2 ? 'before' : 'after';
  };

  return {
    over,
    handlers: {
      onDragEnter(e: DragEvent) {
        if (!kind(e)) return;
        depth.current += 1;
      },
      onDragOver(e: DragEvent) {
        const k = kind(e);
        if (!k) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        setOver(k === 'form' ? 'form' : place(e));
      },
      onDragLeave(e: DragEvent) {
        if (!kind(e)) return;
        depth.current -= 1;
        if (depth.current <= 0) {
          depth.current = 0;
          setOver(null);
        }
      },
      onDrop(e: DragEvent) {
        const k = kind(e);
        depth.current = 0;
        setOver(null);
        if (!k) return;
        e.preventDefault();
        if (k === 'form') onDropForm?.(e.dataTransfer.getData(FORM_DND_TYPE));
        else onDropFolder?.(e.dataTransfer.getData(FOLDER_DND_TYPE), place(e));
      },
    },
  };
}

const ITEM =
  'focus-ring flex h-8 items-center gap-2.5 rounded-md px-2 text-[13.5px] transition-[background-color,box-shadow,transform]';
const IDLE =
  'text-zinc-600 hover:bg-zinc-200/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-100';
const ACTIVE =
  'bg-white font-medium text-zinc-900 shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:ring-zinc-700';

export function rowClass(active: boolean): string {
  return cx(ITEM, active ? ACTIVE : IDLE);
}

export function Count({ value }: { value: number | undefined }) {
  if (value === undefined) return null;
  return (
    <span className="ml-auto font-mono text-[11px] text-zinc-400 tabular-nums">
      {String(value).padStart(2, '0')}
    </span>
  );
}

export function FolderRow({
  to,
  active,
  icon,
  label,
  count,
  dragHint,
  folder,
  editable,
  onDropForm,
  onDropFolder,
  onRename,
  onIcon,
  onDelete,
}: {
  to: string;
  active: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  dragHint: boolean;
  /** Set for real folders; the Unfiled row has none. */
  folder?: Folder;
  editable: boolean;
  onDropForm?(formId: string): void;
  onDropFolder?(folderId: string, place: 'before' | 'after'): void;
  onRename?(name: string): void;
  onIcon?(icon: FolderIcon): void;
  onDelete?(): void;
}) {
  const t = useT();
  const [renaming, setRenaming] = useState(false);
  const [menu, setMenu] = useState<null | 'actions' | 'icon' | 'delete'>(null);
  const [dragging, setDragging] = useState(false);
  const drop = useDropTarget(editable ? { onDropForm, onDropFolder } : {});
  const confirmId = useId();

  return (
    <li
      className={cx(
        'group/row relative',
        drop.over === 'before' &&
          'before:absolute before:inset-x-1 before:-top-px before:h-0.5 before:rounded-full before:bg-zinc-900 dark:before:bg-zinc-100',
        drop.over === 'after' &&
          'after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-zinc-900 dark:after:bg-zinc-100',
      )}
    >
      {renaming ? (
        <div className={cx(ITEM, ACTIVE)}>
          <FolderIconChip icon={(folder as Folder).icon} />
          <InlineName
            initial={label}
            placeholder={t('folders.name')}
            onCommit={(name) => {
              setRenaming(false);
              onRename?.(name);
            }}
            onCancel={() => setRenaming(false)}
          />
        </div>
      ) : (
        <Link
          to={to}
          draggable={Boolean(folder && editable)}
          onDragStart={(e) => {
            if (!folder) return;
            e.dataTransfer.setData(FOLDER_DND_TYPE, folder.id);
            e.dataTransfer.effectAllowed = 'move';
            setDragging(true);
          }}
          onDragEnd={() => setDragging(false)}
          {...drop.handlers}
          aria-current={active ? 'page' : undefined}
          className={cx(
            rowClass(active),
            dragging && 'opacity-50',
            dragHint &&
              editable &&
              drop.over !== 'form' &&
              'ring-1 ring-zinc-900/10 dark:ring-white/10',
            drop.over === 'form' &&
              'scale-[1.01] bg-zinc-900/5 ring-1 ring-zinc-900/50 dark:bg-white/10 dark:ring-white/50',
          )}
        >
          {icon}
          <span className="truncate">{label}</span>
          <span
            className={cx(
              'ml-auto',
              folder && editable && 'group-hover/row:opacity-0 [@media(hover:none)]:opacity-0',
            )}
          >
            <Count value={count} />
          </span>
        </Link>
      )}

      {folder && editable && !renaming && (
        <div className="absolute top-1 right-1">
          <button
            type="button"
            aria-label={t('folders.actions', { name: label })}
            aria-haspopup="menu"
            aria-expanded={menu !== null}
            onClick={() => setMenu(menu ? null : 'actions')}
            className={cx(
              'focus-ring grid size-6 place-items-center rounded text-zinc-500 opacity-0 hover:bg-zinc-200 group-hover/row:opacity-100 focus-visible:opacity-100 dark:hover:bg-zinc-700 [@media(hover:none)]:opacity-100',
              menu && 'opacity-100',
            )}
          >
            <MoreHorizontal className="size-3.5" aria-hidden />
          </button>
          <Popover
            open={menu === 'actions'}
            onClose={() => setMenu(null)}
            role="menu"
            className="w-40 p-1"
          >
            <MenuItem
              onClick={() => {
                setMenu(null);
                setRenaming(true);
              }}
            >
              {t('folders.rename')}
            </MenuItem>
            <MenuItem onClick={() => setMenu('icon')}>{t('folders.changeIcon')}</MenuItem>
            <MenuItem danger onClick={() => setMenu('delete')}>
              {t('folders.delete')}
            </MenuItem>
          </Popover>
          <Popover open={menu === 'delete'} onClose={() => setMenu(null)} className="w-64 p-3">
            <div
              role="alertdialog"
              aria-labelledby={`${confirmId}-title`}
              aria-describedby={`${confirmId}-hint`}
            >
              <p id={`${confirmId}-title`} className="text-[13px] font-semibold break-words">
                {t('folders.confirmDelete', { name: label })}
              </p>
              <p
                id={`${confirmId}-hint`}
                className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400"
              >
                {count > 0
                  ? t.n('folders.confirmDeleteHint', count)
                  : t('folders.confirmDeleteEmpty')}
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <Button onClick={() => setMenu(null)}>{t('common.cancel')}</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setMenu(null);
                    onDelete?.();
                  }}
                >
                  {t('folders.delete')}
                </Button>
              </div>
            </div>
          </Popover>
          <Popover open={menu === 'icon'} onClose={() => setMenu(null)}>
            <IconPicker
              value={folder.icon}
              onPick={(next) => {
                setMenu(null);
                onIcon?.(next);
              }}
            />
          </Popover>
        </div>
      )}
    </li>
  );
}

function MenuItem({
  children,
  danger,
  onClick,
}: {
  children: ReactNode;
  danger?: boolean;
  onClick(): void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cx(
        'flex h-8 w-full items-center rounded-md px-2 text-left text-[13px] outline-none hover:bg-zinc-100 focus-visible:bg-zinc-100 dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800',
        danger ? 'text-red-600 dark:text-red-400' : 'text-zinc-700 dark:text-zinc-300',
      )}
    >
      {children}
    </button>
  );
}

export function UnfiledIcon() {
  return <PenLine className="size-4 shrink-0 opacity-80" aria-hidden />;
}

/** The dashed "new folder" row: pick an icon, type a name, Enter. */
export function NewFolderRow({
  defaultIcon,
  onCreate,
  onCancel,
}: {
  defaultIcon: FolderIcon;
  onCreate(name: string, icon: FolderIcon): void;
  onCancel(): void;
}) {
  const t = useT();
  const [icon, setIcon] = useState(defaultIcon);
  const [picking, setPicking] = useState(false);
  return (
    <li className="relative">
      <div className="flex h-8 items-center gap-2.5 rounded-md border border-dashed border-zinc-300 px-2 dark:border-zinc-700">
        <button
          type="button"
          aria-label={t('folders.changeIcon')}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => setPicking((p) => !p)}
          className="focus-ring -m-1 rounded p-1 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
        >
          <FolderIconChip icon={icon} />
        </button>
        <InlineName
          placeholder={t('folders.name')}
          onCommit={(name) => onCreate(name, icon)}
          onCancel={() => !picking && onCancel()}
        />
      </div>
      <Popover open={picking} onClose={() => setPicking(false)} takeFocus={false} align="start">
        <IconPicker
          value={icon}
          onPick={(next) => {
            setIcon(next);
            setPicking(false);
          }}
        />
      </Popover>
    </li>
  );
}

/** Move a form into a folder (or back to unfiled), with a confirmation toast. */
export function useMoveForm() {
  const { folders, forms } = useStudioData();
  const t = useT();
  return async (formId: string, folderId: string | null) => {
    if ((folders.manifest.assignments[formId] ?? null) === folderId) return;
    const title = forms.data?.forms.find((f) => f.id === formId)?.title ?? formId;
    const folder = folderId ? folders.manifest.folders.find((f) => f.id === folderId) : undefined;
    try {
      await folders.assign(formId, folderId);
      toast.success(
        t('folders.moved', { form: title, folder: folder?.name ?? t('folders.unfiled') }),
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    }
  };
}
