import { X } from 'lucide-react';
import { type RefObject, useCallback, useEffect, useState } from 'react';
import type { ThemeTokens } from '../../schema/index.ts';
import { DRAFT_MESSAGE, forceScheme, formDraftKey, READY_MESSAGE } from '../lib/theme-preview.ts';
import {
  ApiError,
  createFormTheme,
  type DesignTarget,
  type FormThemeDetail,
  formThemeUrl,
  useResource,
} from './api.ts';
import { DesignPanel } from './design-panel.tsx';
import { useT } from './i18n.tsx';
import { Button, ErrorNotice, Skeleton } from './ui.tsx';

/** Adjust mode: the design panel on the form's own theme, shown live in the preview beside it. */
export function FormDesign({
  formId,
  frame,
  onClose,
}: {
  formId: string;
  frame: RefObject<HTMLIFrameElement | null>;
  onClose(): void;
}) {
  const t = useT();
  const detail = useResource<FormThemeDetail>(formThemeUrl(formId));
  const [draft, setDraft] = useState<ThemeTokens | null>(null);
  const [palette, setPalette] = useState<'light' | 'dark'>('light');
  const [creating, setCreating] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const data = detail.data;
  const own = data && !('missing' in data) ? data : null;
  const tokens = draft ?? own?.tokens ?? null;
  const key = formDraftKey(formId);

  // biome-ignore lint/correctness/useExhaustiveDependencies: another form starts from its saved tokens
  useEffect(() => setDraft(null), [formId]);

  // The preview shows the palette being edited, saved or not.
  const post = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { type: DRAFT_MESSAGE, themeId: key, tokens: tokens && forceScheme(tokens, palette) },
      window.location.origin,
    );
  }, [frame, key, tokens, palette]);

  useEffect(post, [post]);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; themeId?: string };
      if (data?.type === READY_MESSAGE && data.themeId === key) post();
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [post, key]);
  // Leaving Adjust shows the form as saved.
  useEffect(
    () => () =>
      frame.current?.contentWindow?.postMessage(
        { type: DRAFT_MESSAGE, themeId: key, tokens: null },
        window.location.origin,
      ),
    [frame, key],
  );

  const create = async () => {
    setCreating(true);
    setFailure(null);
    try {
      await createFormTheme(formId);
      detail.reload();
    } catch (err) {
      setFailure(err instanceof ApiError || err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const target: DesignTarget = { kind: 'form', id: formId };

  return (
    <>
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="truncate text-[13.5px] font-semibold">{t('adjust.panel')}</h2>
        <button
          type="button"
          aria-label={t('common.close')}
          onClick={onClose}
          className="focus-ring ml-auto grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-4">
        {detail.error ? (
          <ErrorNotice error={detail.error} />
        ) : !data ? (
          <Skeleton className="h-72 w-full" />
        ) : own ? (
          <DesignPanel
            target={target}
            detail={own}
            draft={draft}
            onDraft={setDraft}
            onFontsChanged={detail.reload}
            onPalette={setPalette}
          />
        ) : (
          <div className="pb-4">
            <p className="text-[13px] font-medium text-zinc-900 dark:text-zinc-100">
              {t('adjust.missingTitle')}
            </p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('adjust.missingBody', { file: data.file })}
            </p>
            <Button variant="primary" className="mt-3" onClick={create} disabled={creating}>
              {t('adjust.create')}
            </Button>
            {failure && (
              <p className="mt-2 text-[12px] text-red-600 dark:text-red-400" role="alert">
                {failure}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
