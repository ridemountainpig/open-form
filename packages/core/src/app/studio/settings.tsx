import { Check, Code2, Copy } from 'lucide-react';
import { type ReactNode, useState } from 'react';
import { LOCALE_NAMES, parseDuration } from '../../schema/index.ts';
import type { SchemaInfo } from './api.ts';
import { canDeleteForms, DeleteFormButton } from './delete-form.tsx';
import { useFormDetail } from './form-detail.tsx';
import { formatDuration } from './format.ts';
import { useT } from './i18n.tsx';
import { ScheduleSection } from './schedule.tsx';
import { Badge, Button, Card, Kbd, Skeleton } from './ui.tsx';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 py-2.5 text-sm">
      <dt className="text-zinc-500 dark:text-zinc-400">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid grid-cols-[minmax(0,1fr)] gap-x-6 px-5 py-2.5 sm:grid-cols-[9rem_minmax(0,1fr)]">
      <h3 className="pt-2.5 text-sm font-medium">{title}</h3>
      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">{children}</dl>
    </section>
  );
}

export function Settings() {
  const { formId, info, reloadInfo } = useFormDetail();
  const t = useT();
  if (!info) return <Skeleton className="h-64 w-full" />;

  const off = <span className="text-zinc-400 dark:text-zinc-500">{t('settings.off')}</span>;

  const policy = info.config.submissions ?? {};
  const { protection } = info;

  return (
    <div className="space-y-6">
      <ScheduleSection
        key={`${info.timeZone}|${info.published}|${JSON.stringify(info.schedule)}|${info.overrides?.updatedAt ?? ''}`}
        formId={formId}
        info={info}
        onSaved={reloadInfo}
      />

      <Card>
        <div className="flex gap-3 border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
          <Code2 className="mt-0.5 size-4 shrink-0 text-zinc-400" aria-hidden />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">{t('settings.inCodeTitle')}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
              {t('settings.inCode.before')}
              <Kbd>config</Kbd>
              {t('settings.inCode.middle')}
              <Kbd>forms/{formId}/index.tsx</Kbd>
              {t('settings.inCode.after')}
            </p>
          </div>
        </div>
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          <Section title={t('settings.responses')}>
            <Row label={t('settings.onePer')}>
              {policy.uniqueBy === 'device' ? t('settings.device') : (policy.uniqueBy ?? off)}
            </Row>
            <Row label={t('settings.drafts')}>
              {info.config.drafts
                ? `${t('settings.on')} · ${formatDuration(
                    parseDuration(
                      (typeof info.config.drafts === 'object' && info.config.drafts.expires) ||
                        '7d',
                    ),
                  )}`
                : off}
            </Row>
          </Section>
          <Section title={t('settings.protection')}>
            <Row label={t('settings.honeypot')}>{protection.honeypot ? t('settings.on') : off}</Row>
            <Row label={t('settings.minTime')}>
              {protection.minimumCompletionTimeMs
                ? formatDuration(protection.minimumCompletionTimeMs)
                : off}
            </Row>
            <Row label={t('settings.rateLimit')}>
              {protection.rateLimit
                ? t('settings.perWindow', {
                    max: protection.rateLimit.max,
                    window: formatDuration(protection.rateLimit.windowMs),
                  })
                : off}
            </Row>
            <Row label={t('settings.turnstile')}>
              {protection.turnstile ? t('settings.on') : off}
            </Row>
          </Section>
          <LanguagesSection formId={formId} info={info} />
          <WebhooksSection info={info} />
          <EmbedSection formId={formId} info={info} />
        </div>
      </Card>

      {canDeleteForms && <DangerZone formId={formId} info={info} />}
    </div>
  );
}

function LanguagesSection({ formId, info }: { formId: string; info: SchemaInfo }) {
  const t = useT();
  const languages = info.languages;
  if (!languages) return null;
  const [source] = languages.available;
  return (
    <Section title={t('settings.languages')}>
      {source && <Row label={t('settings.writtenIn')}>{LOCALE_NAMES[source]}</Row>}
      {languages.coverage.map((c) => {
        const done = c.total - c.missing.length;
        return (
          <div key={c.locale} className="py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-6">
              <dt className="text-zinc-500 dark:text-zinc-400">{LOCALE_NAMES[c.locale]}</dt>
              <dd
                className={
                  c.missing.length
                    ? 'font-medium text-amber-600 tabular-nums dark:text-amber-400'
                    : 'font-medium text-emerald-600 tabular-nums dark:text-emerald-400'
                }
              >
                {t('settings.translated', { done, total: c.total })}
              </dd>
            </div>
            {c.missing.length > 0 && (
              <p
                className="mt-1 line-clamp-2 text-[12px] text-zinc-500"
                title={c.missing.join('\n')}
              >
                {t('settings.missing', { list: c.missing.map((m) => `“${m}”`).join('、') })}
              </p>
            )}
          </div>
        );
      })}
      {languages.coverage.length === 0 && (
        <p className="py-2.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('settings.noTranslations.before')}
          <Kbd>forms/{formId}/locales/&lt;lang&gt;.json</Kbd>
          {t('settings.noTranslations.after')}
        </p>
      )}
    </Section>
  );
}

function WebhooksSection({ info }: { info: SchemaInfo }) {
  const t = useT();
  const hooks = info.webhooks ?? [];
  return (
    <Section title={t('settings.webhooks')}>
      {hooks.length === 0 ? (
        <div className="py-2.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('settings.noWebhooks.before')}
          <Kbd>webhooks</Kbd>
          {t('settings.noWebhooks.after')}
        </div>
      ) : (
        hooks.map((hook) => (
          <Row key={hook.origin} label={hook.origin}>
            <Badge tone={hook.signed ? 'green' : 'amber'}>
              {hook.signed ? t('settings.webhookSigned') : t('settings.webhookUnsigned')}
            </Badge>
          </Row>
        ))
      )}
      {hooks.some((hook) => !hook.signed) && (
        <div className="pt-2.5 text-[12px] text-zinc-500 dark:text-zinc-400">
          {t('settings.webhookUnsignedHint')}
        </div>
      )}
    </Section>
  );
}

function EmbedSection({ formId, info }: { formId: string; info: SchemaInfo }) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const origins = info.embed?.origins ?? [];
  const snippet = `<div data-open-form="${formId}"></div>\n<script src="${window.location.origin}/embed.js" async></script>`;
  const copy = () => {
    void navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <Section title={t('settings.embed')}>
      <div className="py-2.5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <span className="text-[13px] text-zinc-500 dark:text-zinc-400">
            {t('settings.embedHint')}
          </span>
          <Button variant="ghost" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            {copied ? t('settings.copied') : t('settings.copy')}
          </Button>
        </div>
        <pre className="overflow-x-auto rounded-md bg-zinc-50 p-3 font-mono text-[11.5px] leading-relaxed text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {snippet}
        </pre>
      </div>
      {origins.length === 0 ? (
        <div className="py-2.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('settings.embedNone.before')}
          <Kbd>embed.origins</Kbd>
          {t('settings.embedNone.after')}
        </div>
      ) : (
        <Row label={t('settings.embedAllowed')}>
          {origins.includes('*') ? t('settings.embedAny') : origins.join(', ')}
        </Row>
      )}
    </Section>
  );
}

function DangerZone({ formId, info }: { formId: string; info: SchemaInfo }) {
  const t = useT();
  return (
    <Card className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold">{t('deleteForm.zoneTitle')}</h2>
        <p className="mt-1 text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
          {t('deleteForm.zone.before')}
          <Kbd>forms/{formId}/</Kbd>
          {t('deleteForm.zone.after')}
        </p>
      </div>
      <DeleteFormButton
        form={{ id: formId, title: info.schema.title ?? formId, responses: info.responses }}
      >
        {t('deleteForm.submit')}
      </DeleteFormButton>
    </Card>
  );
}
