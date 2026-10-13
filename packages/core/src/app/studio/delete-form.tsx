import appConfig from 'virtual:open-form/config';
import { Download, FolderX, Inbox, Trash2 } from 'lucide-react';
import { type FormEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';
import { deleteForm, EXPORT_FORMATS, exportPath } from './api.ts';
import { useStudioData } from './data.tsx';
import { useT } from './i18n.tsx';
import { flashSuccess } from './toast.tsx';
import { Button, Kbd } from './ui.tsx';

/** Deleting removes the form's files, so Studio offers it only under `open-form dev`. */
export const canDeleteForms = appConfig.dev;

export type DeletableForm = { id: string; title: string; responses: number };

/**
 * Asks for the form id before deleting the form's folder and its responses.
 * Mount it to open it; it calls `onClose` when cancelled or done.
 */
export function DeleteFormDialog({ form, onClose }: { form: DeletableForm; onClose(): void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const t = useT();
  const titleId = useId();
  const promptId = useId();
  const navigate = useNavigate();
  const location = useLocation();
  const { forms } = useStudioData();

  useEffect(() => {
    ref.current?.showModal();
    // showModal() focuses the first control (an export link); the id is what to type.
    input.current?.focus();
  }, []);

  const confirmed = typed.trim() === form.id;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!confirmed || busy) return;
    setBusy(true);
    setError(undefined);
    try {
      const { responses } = await deleteForm(form.id);
      flashSuccess(
        responses > 0
          ? t.n('deleteForm.doneWith', responses, { title: form.title })
          : t('deleteForm.done', { title: form.title }),
      );
      const here = `/studio/${form.id}`;
      if (location.pathname === here || location.pathname.startsWith(`${here}/`)) {
        navigate('/studio', { replace: true });
      }
      forms.reload();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  };

  return createPortal(
    // biome-ignore lint/a11y/useKeyWithClickEvents: the backdrop click is a shortcut; Escape closes it too
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => busy && event.preventDefault()}
      // The form fills the dialog, so a click that lands on the dialog itself is the backdrop.
      onClick={(event) => event.target === event.currentTarget && !busy && onClose()}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl border border-zinc-200 bg-white p-0 text-zinc-900 shadow-2xl transition-[opacity,scale] duration-200 ease-out backdrop:bg-zinc-950/40 starting:scale-[0.96] starting:opacity-0 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <form onSubmit={submit} className="grid gap-4 p-5">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <Trash2 className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 pt-0.5">
            <h2 id={titleId} className="text-[15px] font-semibold break-words">
              {t('deleteForm.title', { title: form.title })}
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
              {t('deleteForm.undone')}
            </p>
          </div>
        </div>

        <ul className="grid gap-2.5 rounded-lg border border-zinc-200 p-3 text-[13px] dark:border-zinc-800">
          <li className="flex min-w-0 items-center gap-2">
            <FolderX className="size-4 shrink-0 text-zinc-400" aria-hidden />
            <Kbd>forms/{form.id}/</Kbd>
            <span className="truncate text-zinc-500 dark:text-zinc-400">
              {t('deleteForm.files')}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <Inbox className="size-4 shrink-0 text-zinc-400" aria-hidden />
            {form.responses > 0 ? (
              <span className="font-medium">{t.n('deleteForm.responses', form.responses)}</span>
            ) : (
              <span className="text-zinc-500 dark:text-zinc-400">
                {t('deleteForm.noResponses')}
              </span>
            )}
          </li>
        </ul>

        {form.responses > 0 && (
          <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="flex items-center gap-1.5 text-zinc-700 dark:text-zinc-300">
              <Download className="size-3.5" aria-hidden />
              {t('deleteForm.export')}
            </span>
            {EXPORT_FORMATS.map(({ format, label }) => (
              <a
                key={format}
                href={exportPath(form.id, format)}
                download
                className="focus-ring rounded font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:decoration-zinc-500 dark:text-zinc-300 dark:decoration-zinc-600"
              >
                {label}
              </a>
            ))}
          </div>
        )}

        <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('deleteForm.git')}
        </p>

        <div className="grid gap-1.5 text-[13px]">
          <p id={promptId}>
            {t('deleteForm.type.before')}
            <button
              type="button"
              onClick={() => {
                setTyped(form.id);
                input.current?.focus();
              }}
              disabled={busy}
              title={t('deleteForm.type.fill')}
              className="focus-ring cursor-pointer rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 font-mono text-[12px] text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 disabled:cursor-default dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
            >
              {form.id}
            </button>
            {t('deleteForm.type.after')}
          </p>
          <input
            ref={input}
            aria-labelledby={promptId}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            disabled={busy}
            className="focus-ring h-9 rounded-md border border-zinc-300 bg-white px-3 font-mono text-[13px] dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {error && (
          <p role="alert" className="text-[13px] text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={busy}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="danger" disabled={!confirmed || busy}>
            {busy ? t('deleteForm.deleting') : t('deleteForm.submit')}
          </Button>
        </div>
      </form>
    </dialog>,
    document.body,
  );
}

/** A trash button that opens the dialog. */
export function DeleteFormButton({
  form,
  className,
  children,
}: {
  form: DeletableForm;
  className?: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const t = useT();
  return (
    <>
      {children ? (
        <Button variant="danger" className={className} onClick={() => setOpen(true)}>
          <Trash2 aria-hidden />
          {children}
        </Button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={
            className ??
            'focus-ring grid size-7 place-items-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400'
          }
          aria-label={`${t('deleteForm.action')}: ${form.title}`}
          title={t('deleteForm.action')}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      )}
      {open && <DeleteFormDialog form={form} onClose={() => setOpen(false)} />}
    </>
  );
}
