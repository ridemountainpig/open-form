import { useFieldValue, useTranslate } from '@open-form-build/core';
import { PLANS } from './plan-picker.tsx';

/** Fills the ink panel with the request as it's being written. Display only. */
export function RequestSummary() {
  const tr = useTranslate();
  const company = useFieldValue<string>('company')?.trim();
  const teamSize = useFieldValue<string>('teamSize');
  const planId = useFieldValue<string>('plan');
  const seats = useFieldValue<number | string>('seats');
  const plan = PLANS.find((p) => p.id === planId);

  const rows: Array<[string, string | undefined]> = [
    ['Company', company],
    ['Team size', teamSize && tr('{size} people', { size: teamSize })],
    ['Plan', plan && `${tr(plan.name)} · ${tr(plan.price)}`],
  ];
  if (planId === 'enterprise')
    rows.push(['Seats', seats ? tr('{n} seats', { n: seats }) : undefined]);

  return (
    <section className="sales-summary" aria-label={tr('Your request')}>
      <p className="sales-summary-title">{tr('Your request')}</p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="sales-summary-row">
            <dt>{tr(label)}</dt>
            <dd data-empty={value ? undefined : ''}>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
