import { Check, ChevronRight, Copy, CornerLeftUp, MousePointer2, X } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, type ReactNode, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { LOCALE_NAMES, type Locale } from '../../schema/index.ts';
import { onFormChanged } from '../lib/forms.ts';
import type { ElementNames, InspectPick } from '../lib/preview-channel.ts';
import { ApiError, checkSignedIn } from './api.ts';
import { type Translate, useT } from './i18n.tsx';
import { Button, cx, Kbd } from './ui.tsx';

// The preview's Edit mode panel (dev only): what is selected, its text written
// straight back to the source, a note for the agent, and the notes left so far.

export type Comment = { file: string; line: number; text: string };

type Slot = {
  at: string;
  anchor: string;
  key: string;
  owner: string;
  value: string;
  translation?: { locale: string; value: string | null; editable: boolean };
};

async function send<T>(method: string, url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  checkSignedIn(res);
  const data = (await res.json().catch(() => ({}))) as T & { message?: string };
  if (!res.ok) throw new ApiError(res.status, data.message ?? res.statusText);
  return data;
}

// Keeps the form's folder: the selection says which form it is in.
const shortFile = (file: string) => file.replace(/^forms\//, '');
const shortLoc = (loc: string) => {
  const match = /^(.+):(\d+):\d+$/.exec(loc);
  return match ? `${shortFile(match[1] as string)}:${match[2]}` : loc;
};

export function elementLabel(names: ElementNames, loc: string): string {
  const info = names[loc];
  if (!info) return shortLoc(loc);
  return info.name ? `${info.tag} · ${info.name}` : info.tag;
}

/** One step up: from a part to its element, from an element to the one around it. */
export function parentOf(selection: InspectPick, names: ElementNames): InspectPick | null {
  if (selection.part) {
    const { part: _part, text: _text, path: _path, ...owner } = selection;
    return owner;
  }
  const loc = selection.ancestors.at(-1);
  const match = loc && /^(.+):(\d+):(\d+)$/.exec(loc);
  if (!loc || !match) return null;
  const name = names[loc]?.name;
  return {
    loc,
    file: match[1] as string,
    line: Number(match[2]),
    column: Number(match[3]),
    ...(name ? { field: name } : {}),
    ancestors: selection.ancestors.slice(0, -1),
    ...(selection.locale ? { locale: selection.locale } : {}),
  };
}

const KEYS = new Set([
  'label',
  'description',
  'title',
  'placeholder',
  'unit',
  'lowLabel',
  'highLabel',
  'message',
  'children',
  'patternMessage',
  'closedMessage',
  'fullMessage',
  'duplicateMessage',
]);

function keyLabel(t: Translate, key: string): string {
  const last = key.split('.').at(-1) ?? key;
  return KEYS.has(last) ? t(`edit.key.${last}` as Parameters<Translate>[0]) : last;
}

export function EditPanel({
  selection,
  names,
  sourceLocale,
  comments,
  onSelect,
  onTextChanged,
  onCommented,
  onClose,
}: {
  selection: InspectPick | null;
  names: ElementNames;
  sourceLocale: Locale;
  comments: { list: Comment[]; reload(): void };
  onSelect(selection: InspectPick): void;
  /** Text at `at`, the selection it was edited in, changed from `from` to `to` in the source. */
  onTextChanged(at: InspectPick, from: string, to: string): void;
  /** A note took a line of its own at `file:line`, moving what follows down. */
  onCommented(file: string, line: number, shifted: boolean): void;
  onClose(): void;
}) {
  const t = useT();
  const fail = (err: unknown) => toast.error(err instanceof Error ? err.message : String(err));

  const [version, setVersion] = useState(0);
  useEffect(() => onFormChanged(() => setVersion((v) => v + 1)), []);

  const locale =
    selection?.locale && selection.locale !== sourceLocale ? selection.locale : undefined;
  // The text shown belongs to one selection; another one starts from a skeleton.
  const query = selection
    ? JSON.stringify({
        loc: selection.loc,
        // A part without text has none to edit.
        ...(selection.part ? { text: selection.text ?? null, path: selection.path } : {}),
        locale,
      })
    : null;
  const [loaded, setLoaded] = useState<{ query: string; slots: Slot[] } | null>(null);
  const slots = loaded && loaded.query === query ? loaded.slots : null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` refetches after a source change
  useEffect(() => {
    if (!query) return;
    const { path: _path, ...body } = JSON.parse(query) as {
      loc: string;
      text?: string | null;
      path?: number[];
      locale?: string;
    };
    if (body.text === null) {
      setLoaded({ query, slots: [] });
      return;
    }
    let cancelled = false;
    send<{ slots: Slot[] }>('POST', '/api/studio/source/slots', body).then(
      (data) => !cancelled && setLoaded({ query, slots: data.slots }),
      (err) => {
        if (cancelled) return;
        setLoaded({ query, slots: [] });
        fail(err);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [query, version]);

  const saveText = async (slot: Slot, to: string, inLocale?: string) => {
    const at = selection;
    await send('PUT', '/api/studio/source/text', {
      at: slot.at,
      from: slot.value,
      to,
      ...(inLocale ? { locale: inLocale } : {}),
    });
    if (!inLocale && at) onTextChanged(at, slot.value, to);
    setVersion((v) => v + 1);
  };

  const parent = selection && parentOf(selection, names);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-[13.5px] font-semibold">{t('edit.panel')}</h2>
        <button
          type="button"
          aria-label={t('edit.close')}
          title={t('edit.close')}
          onClick={onClose}
          className="focus-ring ml-auto grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {selection ? (
          <>
            <div className="flex items-start gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <Breadcrumb selection={selection} names={names} onSelect={onSelect} />
              <button
                type="button"
                disabled={!parent}
                onClick={() => parent && onSelect(parent)}
                aria-label={t('edit.selectParent')}
                title={t('edit.selectParent')}
                className="focus-ring -my-0.5 grid size-7 shrink-0 place-items-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 disabled:hover:bg-transparent dark:hover:bg-zinc-800 dark:hover:text-zinc-100 [&_svg]:size-4"
              >
                <CornerLeftUp aria-hidden />
              </button>
            </div>

            <Section title={t('edit.text')}>
              {slots === null ? (
                <div className="h-16 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-800/60" />
              ) : slots.length === 0 ? (
                <p className="text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {t('edit.textNone')}
                </p>
              ) : (
                <div className="space-y-4">
                  {slots.map((slot) => (
                    <SlotEditor
                      key={slot.at}
                      slot={slot}
                      sourceLocale={sourceLocale}
                      onSave={saveText}
                      onError={fail}
                    />
                  ))}
                  <p className="text-[11.5px] text-zinc-400">{t('edit.textHint')}</p>
                </div>
              )}
            </Section>

            <NoteForm
              key={`${selection.loc}|${selection.text ?? ''}|${selection.path?.join() ?? ''}`}
              selection={selection}
              slots={slots}
              onAdded={(file, line, shifted) => {
                comments.reload();
                onCommented(file, line, shifted);
              }}
              onError={fail}
            />

            <Section title={t('edit.source')}>
              <SourceRow selection={selection} />
              <p className="mt-2 text-[11.5px] leading-relaxed text-zinc-400">
                {t('edit.agentSees')}
              </p>
            </Section>
          </>
        ) : (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-3 grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
              <MousePointer2 className="size-4.5" aria-hidden />
            </div>
            <p className="text-[13.5px] font-medium">{t('edit.emptyTitle')}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('edit.emptyBody')}
            </p>
          </div>
        )}

        {comments.list.length > 0 && (
          <Notes list={comments.list} onRemoved={comments.reload} onError={fail} />
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-b border-zinc-200 px-4 py-4 last:border-0 dark:border-zinc-800">
      <h3 className="mb-2.5 text-[11px] font-semibold tracking-wider text-zinc-500 uppercase">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Breadcrumb({
  selection,
  names,
  onSelect,
}: {
  selection: InspectPick;
  names: ElementNames;
  onSelect(selection: InspectPick): void;
}) {
  // Each crumb selects that level: walk up from the selection to it.
  const levels: Array<{ key: string; label: string; target: InspectPick | null }> = [];
  let level: InspectPick | null = selection;
  while (level) {
    levels.unshift({
      key: `${level.loc}|${level.part ? 'part' : ''}`,
      label: level.part ? level.part.tag : elementLabel(names, level.loc),
      target: level === selection ? null : level,
    });
    level = parentOf(level, names);
  }
  return (
    <ol className="flex min-w-0 flex-1 flex-wrap items-center gap-x-0.5 gap-y-1 font-mono text-[11.5px]">
      {levels.map((crumb, i) => (
        <li key={crumb.key} className="flex min-w-0 items-center gap-0.5">
          {i > 0 && <ChevronRight className="size-3 shrink-0 text-zinc-300 dark:text-zinc-600" />}
          {crumb.target ? (
            <button
              type="button"
              onClick={() => crumb.target && onSelect(crumb.target)}
              className="focus-ring truncate rounded px-1 py-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            >
              {crumb.label}
            </button>
          ) : (
            <span
              aria-current="true"
              className="truncate rounded bg-zinc-900 px-1.5 py-0.5 text-white dark:bg-white dark:text-zinc-900"
            >
              {crumb.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

function SlotEditor({
  slot,
  sourceLocale,
  onSave,
  onError,
}: {
  slot: Slot;
  sourceLocale: Locale;
  onSave(slot: Slot, to: string, locale?: string): Promise<void>;
  onError(err: unknown): void;
}) {
  const t = useT();
  const translation = slot.translation;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium">{keyLabel(t, slot.key)}</span>
        <span className="truncate font-mono text-[11px] text-zinc-400">
          {slot.owner === 'config' ? `config.${slot.key}` : slot.owner}
        </span>
      </div>
      <TextInput
        value={slot.value}
        label={
          translation
            ? t('edit.sourceLanguage', { language: LOCALE_NAMES[sourceLocale] })
            : undefined
        }
        onSave={(to) => onSave(slot, to)}
        onError={onError}
      />
      {translation && (
        <div className="mt-2">
          <TextInput
            value={translation.value ?? ''}
            placeholder={t('edit.untranslated')}
            label={LOCALE_NAMES[translation.locale as Locale] ?? translation.locale}
            disabled={!translation.editable}
            onSave={(to) => onSave(slot, to, translation.locale)}
            onError={onError}
          />
        </div>
      )}
    </div>
  );
}

function TextInput({
  value,
  label,
  placeholder,
  disabled,
  onSave,
  onError,
}: {
  value: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  onSave(to: string): Promise<void>;
  onError(err: unknown): void;
}) {
  const t = useT();
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    if (state !== 'saved') return;
    const timer = setTimeout(() => setState('idle'), 1500);
    return () => clearTimeout(timer);
  }, [state]);

  const commit = async () => {
    const next = draft.replace(/\s+/g, ' ').trim();
    if (!next || next === value) {
      setDraft(value);
      return;
    }
    setState('saving');
    try {
      await onSave(next);
      setState('saved');
    } catch (err) {
      setDraft(value);
      setState('idle');
      onError(err);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
    } else if (event.key === 'Escape') {
      event.stopPropagation();
      setDraft(value);
      requestAnimationFrame(() => (event.target as HTMLTextAreaElement).blur());
    }
  };

  return (
    <label className="block">
      {label && (
        <span className="mb-1 flex items-center justify-between text-[11.5px] text-zinc-500 dark:text-zinc-400">
          {label}
          {state === 'saved' && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="size-3" aria-hidden />
              {t('edit.saved')}
            </span>
          )}
        </span>
      )}
      <textarea
        value={draft}
        rows={Math.min(4, Math.max(1, Math.ceil(draft.length / 34)))}
        placeholder={placeholder}
        disabled={disabled || state === 'saving'}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
        className={cx(
          'focus-ring block w-full resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[13px] leading-snug disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950',
          state === 'saved' && !label && 'border-emerald-400 dark:border-emerald-700',
        )}
      />
    </label>
  );
}

function NoteForm({
  selection,
  slots,
  onAdded,
  onError,
}: {
  selection: InspectPick;
  slots: Slot[] | null;
  onAdded(file: string, line: number, shifted: boolean): void;
  onError(err: unknown): void;
}) {
  const t = useT();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const mac = /Mac|iPhone|iPad/.test(navigator.platform);

  const add = async (event?: FormEvent) => {
    event?.preventDefault();
    const note = text.trim();
    if (!note || busy) return;
    // A part is noted on the element its text comes from; otherwise on the
    // element around it, saying which part the note is about.
    const only = slots?.length === 1 ? slots[0] : undefined;
    const loc = selection.part && only ? only.anchor : selection.loc;
    const about = selection.part && !only ? (selection.part.shown ?? selection.part.tag) : null;
    setBusy(true);
    try {
      const added = await send<{ file: string; line: number; shifted: boolean }>(
        'POST',
        '/api/studio/comments',
        { loc, text: about ? `(on “${about.slice(0, 60)}”) ${note}` : note },
      );
      setText('');
      toast.success(t('edit.noteAdded'));
      onAdded(added.file, added.line, added.shifted);
    } catch (err) {
      onError(err);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t('edit.note')}>
      <form onSubmit={add}>
        <textarea
          value={text}
          rows={3}
          maxLength={500}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) void add(event);
            if (event.key === 'Escape') event.stopPropagation();
          }}
          placeholder={t('edit.notePlaceholder')}
          aria-label={t('edit.note')}
          className="focus-ring block w-full resize-none rounded-md border border-zinc-200 bg-white px-2.5 py-2 text-[13px] leading-snug dark:border-zinc-800 dark:bg-zinc-950"
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11.5px] text-zinc-400">
            {t('edit.noteShortcut', { key: mac ? '⌘↵' : 'Ctrl+↵' })}
          </span>
          <Button type="submit" variant="primary" disabled={busy || !text.trim()}>
            {t('edit.addNote')}
          </Button>
        </div>
      </form>
    </Section>
  );
}

function SourceRow({ selection }: { selection: InspectPick }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const location = `${selection.file}:${selection.line}`;
  const reference = [
    location,
    selection.field && `field "${selection.field}"`,
    selection.part?.shown && `“${selection.part.shown.slice(0, 80)}”`,
  ]
    .filter(Boolean)
    .join(' · ');

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-zinc-600 dark:text-zinc-300">
        {shortFile(selection.file)}:{selection.line}
      </code>
      <Button
        variant="ghost"
        onClick={() =>
          navigator.clipboard.writeText(reference).then(
            () => setCopied(true),
            (err) => toast.error(err instanceof Error ? err.message : String(err)),
          )
        }
      >
        {copied ? <Check /> : <Copy />}
        {copied ? t('edit.copied') : t('edit.copyRef')}
      </Button>
    </div>
  );
}

function Notes({
  list,
  onRemoved,
  onError,
}: {
  list: Comment[];
  onRemoved(): void;
  onError(err: unknown): void;
}) {
  const t = useT();
  const remove = (comment: Comment) =>
    send('DELETE', '/api/studio/comments', { file: comment.file, line: comment.line }).then(
      onRemoved,
      onError,
    );
  return (
    <Section title={`${t('edit.notes')} · ${list.length}`}>
      <ul className="space-y-1.5">
        {list.map((comment) => (
          <li
            key={`${comment.file}:${comment.line}`}
            className="group flex items-start gap-2 rounded-md bg-zinc-50 px-2.5 py-2 text-[12.5px] dark:bg-zinc-800/50"
          >
            <span className="min-w-0 flex-1">
              <code className="mb-0.5 block font-mono text-[11px] text-zinc-400">
                {shortFile(comment.file)}:{comment.line}
              </code>
              {comment.text}
            </span>
            <button
              type="button"
              onClick={() => void remove(comment)}
              aria-label={t('edit.removeNote')}
              title={t('edit.removeNote')}
              className="focus-ring grid size-6 shrink-0 place-items-center rounded text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-200 [&_svg]:size-3.5"
            >
              <X aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-2.5 text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t('edit.notesHint.before')}
        <Kbd>/apply-comments</Kbd>
        {t('edit.notesHint.after')}
      </p>
    </Section>
  );
}
