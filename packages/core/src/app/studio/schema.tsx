import { GitBranch } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  type ConditionNames,
  explainCondition,
  type FieldSchema,
  schemaNames,
} from '../../schema/index.ts';
import { useFormDetail } from './form-detail.tsx';
import { useT } from './i18n.tsx';
import { Badge, Card, Skeleton } from './ui.tsx';

const COLUMNS = 5;
const NONE = <span className="text-zinc-300 dark:text-zinc-700">—</span>;

export function Schema() {
  const { info } = useFormDetail();
  const t = useT();
  if (!info) return <Skeleton className="h-64 w-full" />;

  const { schema } = info;
  const names = schemaNames(schema);

  return (
    <div className="space-y-3">
      <p className="text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {t('schema.intro')}
      </p>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead>
            <tr className="text-xs text-zinc-500 dark:text-zinc-400 [&>th]:py-2.5 [&>th]:pr-4 [&>th]:font-medium [&>th]:whitespace-nowrap">
              <th scope="col" className="pl-5">
                {t('schema.col.field')}
              </th>
              <th scope="col">{t('schema.col.key')}</th>
              <th scope="col">{t('schema.col.type')}</th>
              <th scope="col">{t('schema.col.validation')}</th>
              <th scope="col" className="pr-5!">
                {t('schema.col.when')}
              </th>
            </tr>
          </thead>
          {schema.pages.map((page) => {
            const fields = schema.fields.filter((f) => f.page === page.index);
            return (
              <tbody key={page.index}>
                <tr className="border-t border-zinc-200 bg-zinc-50/80 dark:border-zinc-800 dark:bg-zinc-800/30">
                  <th
                    scope="colgroup"
                    colSpan={COLUMNS}
                    className="py-2 pr-5 pl-5 text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    <span className="tabular-nums">{t('schema.step', { n: page.index + 1 })}</span>
                    {page.title && (
                      <span className="ml-2 text-zinc-800 dark:text-zinc-200">{page.title}</span>
                    )}
                    {page.when.length > 0 && (
                      <Condition>
                        {t('schema.if', {
                          condition: explainCondition(page.when, names, t.locale),
                        })}
                      </Condition>
                    )}
                  </th>
                </tr>
                {fields.map((field) => (
                  <FieldRow
                    key={`${field.name}:${JSON.stringify(field.when)}`}
                    field={field}
                    pageWhen={page.when.length}
                    names={names}
                  />
                ))}
                {fields.length === 0 && (
                  <tr className="border-t border-zinc-100 dark:border-zinc-800/70">
                    <td colSpan={COLUMNS} className="py-2.5 pl-5 text-zinc-400 dark:text-zinc-500">
                      {t('schema.noFields')}
                    </td>
                  </tr>
                )}
              </tbody>
            );
          })}
        </table>
      </Card>
    </div>
  );
}

// Conditions read as sentences and run long, so they get their own line.
function Condition({ children }: { children: ReactNode }) {
  return (
    <p className="mt-1 flex gap-1.5 text-[12px] leading-snug font-normal text-zinc-500 dark:text-zinc-400">
      <GitBranch className="mt-px size-3.5 shrink-0 text-zinc-400" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function FieldRow({
  field,
  pageWhen,
  names,
}: {
  field: FieldSchema;
  pageWhen: number;
  names: ConditionNames;
}) {
  const t = useT();
  // The step's own conditions are on its heading row; show only what the field adds.
  const own = field.when.slice(pageWhen);
  return (
    <tr className="border-t border-zinc-100 align-top dark:border-zinc-800/70 [&>td]:py-2.5 [&>td]:pr-4">
      <td className="min-w-40 pl-5 text-zinc-800 dark:text-zinc-200">{field.label ?? NONE}</td>
      <td className="font-mono text-[12px] whitespace-nowrap text-zinc-700 dark:text-zinc-300">
        {field.name}
      </td>
      <td className="font-mono text-[12px] whitespace-nowrap text-zinc-500 dark:text-zinc-400">
        {field.type}
      </td>
      <td className="whitespace-nowrap">
        {field.required || field.hasCustomValidator ? (
          <span className="flex gap-1.5">
            {field.required && <Badge tone="amber">{t('schema.required')}</Badge>}
            {field.hasCustomValidator && <Badge>{t('schema.custom')}</Badge>}
          </span>
        ) : (
          NONE
        )}
      </td>
      <td className="min-w-56 pr-5! text-[12.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">
        {own.length > 0 ? explainCondition(own, names, t.locale) : NONE}
      </td>
    </tr>
  );
}
