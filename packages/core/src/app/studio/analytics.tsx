import { ChartNoAxesColumn, GitBranch, ShieldCheck } from 'lucide-react';
import { useState } from 'react';
import { type AnalyticsInfo, formPath, useResource } from './api.ts';
import { useFormDetail } from './form-detail.tsx';
import { type Translate, useT } from './i18n.tsx';
import { Card, Dropdown, EmptyState, ErrorNotice, Segmented, Skeleton } from './ui.tsx';

type Range = '7' | '30' | '90' | 'all';

const REFRESH_MS = 15_000;

function percent(part: number, whole: number, locale: string): string {
  if (whole === 0) return '—';
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    part / whole,
  );
}

function duration(seconds: number | null, t: Translate): string {
  if (seconds === null) return '—';
  if (seconds < 60) return t('analytics.seconds', { n: seconds });
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return t('analytics.minutes', { m: minutes, s: seconds % 60 });
  return t('analytics.hours', { h: Math.floor(minutes / 60), m: minutes % 60 });
}

export function Analytics() {
  const { formId } = useFormDetail();
  const t = useT();
  const [range, setRange] = useState<Range>('30');
  const [version, setVersion] = useState('current');
  const params = new URLSearchParams();
  if (range !== 'all') params.set('days', range);
  if (version !== 'current') params.set('version', version);
  const { data, error } = useResource<AnalyticsInfo>(`${formPath(formId)}/analytics?${params}`, {
    refresh: REFRESH_MS,
  });

  if (error) return <ErrorNotice error={error} />;
  if (!data) return <Skeleton className="h-80 w-full" />;
  if (!data.supported) {
    return (
      <Card>
        <EmptyState icon={<ChartNoAxesColumn />} title={t('analytics.unsupported')}>
          {t('analytics.unsupportedHint')}
        </EmptyState>
      </Card>
    );
  }

  const number = (n: number) => n.toLocaleString(t.locale);
  const versionOptions = [
    ...data.versions.map((v) => ({
      value: v.current ? 'current' : v.id,
      label: v.current ? t('analytics.versionCurrent') : `v${v.version}`,
      detail: t.n('analytics.visitCount', v.visits),
    })),
    { value: 'all', label: t('analytics.versionAll') },
  ];
  const widest = Math.max(1, ...data.steps.map((step) => step.reached));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented<Range>
          label={t('analytics.range')}
          value={range}
          onChange={setRange}
          options={[
            { value: '7', label: t('analytics.days', { n: 7 }) },
            { value: '30', label: t('analytics.days', { n: 30 }) },
            { value: '90', label: t('analytics.days', { n: 90 }) },
            { value: 'all', label: t('analytics.allTime') },
          ]}
        />
        {data.versions.length > 1 && (
          <Dropdown
            label={t('analytics.version')}
            showLabel
            value={version}
            onChange={setVersion}
            options={versionOptions}
          />
        )}
      </div>

      {!data.enabled && (
        <p className="rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-[13px] text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300">
          {t('analytics.off.before')}
          <code className="font-mono text-[12px]">analytics: false</code>
          {t('analytics.off.after')}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t('analytics.views')} value={number(data.views)} />
        <Stat
          label={t('analytics.started')}
          value={number(data.started)}
          detail={t('analytics.ofViews', { p: percent(data.started, data.views, t.locale) })}
        />
        <Stat
          label={t('analytics.completionRate')}
          value={percent(data.completed, data.views, t.locale)}
          detail={t('analytics.completedOf', {
            n: number(data.completed),
            p: percent(data.completed, data.started, t.locale),
          })}
        />
        <Stat
          label={t('analytics.medianTime')}
          value={duration(data.medianSeconds, t)}
          detail={t('analytics.medianHint')}
        />
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">{t('analytics.funnel')}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('analytics.funnelHint')}</p>
        </div>
        {data.stepsDiffer ? (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('analytics.stepsDiffer')}
          </p>
        ) : data.views === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('analytics.empty')}
          </p>
        ) : (
          <ol className="mt-3">
            {data.steps.map((step, i) => (
              <li
                key={step.index}
                className="border-t border-zinc-100 py-3 first:border-t-0 dark:border-zinc-800/70"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[13px]">
                  <p className="min-w-0">
                    <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{i + 1}</span>
                    <span className="ml-2 text-zinc-800 dark:text-zinc-200">
                      {step.title ?? t('analytics.stepN', { n: i + 1 })}
                    </span>
                  </p>
                  <p className="flex shrink-0 gap-4 tabular-nums">
                    <span className="text-zinc-700 dark:text-zinc-300">
                      {t('analytics.reachedCount', { n: number(step.reached) })}
                      <span className="ml-1.5 text-zinc-400 dark:text-zinc-500">
                        {percent(step.reached, data.views, t.locale)}
                      </span>
                    </span>
                    <span
                      className={
                        step.left > 0
                          ? 'text-zinc-700 dark:text-zinc-300'
                          : 'text-zinc-400 dark:text-zinc-600'
                      }
                    >
                      {t.n('analytics.leftCount', step.left, { n: number(step.left) })}
                    </span>
                  </p>
                </div>
                <div
                  className="mt-2 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800"
                  title={t('analytics.reachedTip', {
                    n: number(step.reached),
                    p: percent(step.reached, data.views, t.locale),
                  })}
                >
                  <div
                    className="h-2 rounded-full bg-zinc-800 dark:bg-zinc-200"
                    style={{
                      width: `${Math.max((step.reached / widest) * 100, step.reached ? 1 : 0)}%`,
                    }}
                  />
                </div>
                {step.conditional && (
                  <p className="mt-1.5 flex items-center gap-1 text-[12px] text-zinc-500 dark:text-zinc-400">
                    <GitBranch className="size-3.5 shrink-0" aria-hidden />
                    {t('analytics.conditional')}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <p className="flex gap-1.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        <ShieldCheck className="mt-px size-3.5 shrink-0" aria-hidden />
        {t('analytics.privacy')}
      </p>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="px-4 py-3.5">
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
      {detail && <p className="mt-0.5 text-[12px] text-zinc-500 dark:text-zinc-400">{detail}</p>}
    </Card>
  );
}
