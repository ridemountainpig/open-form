import { ArrowUpRight, Check, Link2 } from 'lucide-react';
import { useState } from 'react';
import { NavLink, Outlet, useOutletContext, useParams } from 'react-router-dom';
import { formPath, type SchemaInfo, useResource } from './api.ts';
import { useT } from './i18n.tsx';
import { Button, ButtonLink, cx, ErrorNotice, Skeleton, StatusBadge } from './ui.tsx';

export type FormDetailContext = {
  formId: string;
  info: SchemaInfo | undefined;
  reloadInfo(): void;
};

export function useFormDetail(): FormDetailContext {
  return useOutletContext<FormDetailContext>();
}

export function FormDetail() {
  const { formId = '' } = useParams();
  const { data, error, reload } = useResource<SchemaInfo>(`${formPath(formId)}/schema`);
  const info = error ? undefined : data;
  const [copied, setCopied] = useState(false);
  const t = useT();
  const publicUrl = `${window.location.origin}/f/${formId}`;

  const copy = async () => {
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const tabs = [
    { to: '', label: t('detail.preview'), end: true },
    {
      to: 'responses',
      label: t('detail.responses'),
      count: info?.responses,
    },
    { to: 'schema', label: t('detail.schema') },
    { to: 'settings', label: t('detail.settings') },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          {error ? (
            <h1 className="text-xl font-semibold tracking-tight">{formId}</h1>
          ) : info ? (
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="truncate text-xl font-semibold tracking-tight">
                {info.schema.title ?? formId}
              </h1>
              <StatusBadge status={info.status} />
            </div>
          ) : (
            <Skeleton className="h-7 w-64" />
          )}
          <p className="mt-1 font-mono text-xs text-zinc-500">
            forms/{formId}/index.tsx
            {info && <span className="text-zinc-400 dark:text-zinc-600"> · v{info.version}</span>}
          </p>
        </div>
        {info?.published !== false && (
          <div className="flex items-center gap-2">
            <Button onClick={copy} aria-live="polite">
              {copied ? <Check /> : <Link2 />}
              {copied ? t('detail.copied') : t('detail.copyLink')}
            </Button>
            <ButtonLink href={`/f/${formId}`} target="_blank" rel="noreferrer" variant="primary">
              {t('detail.openForm')}
              <ArrowUpRight />
            </ButtonLink>
          </div>
        )}
      </div>

      {/* The line is an inset shadow, not a border, so the active tab's underline covers it inside the scroller. */}
      <nav
        className="mt-6 flex gap-1 overflow-x-auto shadow-[inset_0_-1px_0_var(--color-zinc-200)] [scrollbar-width:none] dark:shadow-[inset_0_-1px_0_var(--color-zinc-800)]"
        aria-label={t('detail.sections')}
      >
        {tabs.map((tab) => (
          <NavLink
            key={tab.label}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              cx(
                'focus-ring relative flex shrink-0 items-center gap-2 rounded-t-md border-b-2 px-2.5 pt-1 pb-2.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3',
                isActive
                  ? 'border-zinc-900 text-zinc-900 dark:border-white dark:text-white'
                  : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200',
              )
            }
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="rounded-full bg-zinc-100 px-1.5 py-px text-[11px] tabular-nums text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {tab.count}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="pt-6">
        {error ? (
          <ErrorNotice error={error} />
        ) : (
          // Keyed: a tab's state (a selection, a search, Edit mode) belongs to one form.
          <Outlet
            key={formId}
            context={{ formId, info, reloadInfo: reload } satisfies FormDetailContext}
          />
        )}
      </div>
    </div>
  );
}
