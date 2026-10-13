import { FieldShell, useField, useTranslate } from '@open-form-build/core';

export const PLANS = [
  { id: 'hobby', name: 'Hobby', price: '$0', blurb: 'Side projects' },
  { id: 'team', name: 'Team', price: '$20', blurb: 'Up to 10 people' },
  { id: 'enterprise', name: 'Enterprise', price: 'Custom', blurb: 'SSO, audit logs' },
];

/** A custom field: any React UI, wired into validation and storage by useField. */
export function PlanPicker({ name, label }: { name: string; label: string }) {
  const field = useField({
    name,
    label,
    type: 'select',
    required: true,
    options: PLANS.map((p) => ({ value: p.id, label: p.name })),
  });
  // Text in your own markup goes through tr() so it follows the respondent's language.
  const tr = useTranslate();

  return (
    <FieldShell field={field} as="fieldset">
      <div className="sales-plans">
        {PLANS.map((plan, index) => (
          <label key={plan.id} className="sales-plan">
            <span className="sales-plan-name">
              <input
                ref={index === 0 ? field.ref : undefined}
                type="radio"
                className="of-radio"
                name={field.name}
                value={plan.id}
                checked={field.value === plan.id}
                aria-invalid={field.controlProps['aria-invalid']}
                aria-describedby={field.controlProps['aria-describedby']}
                onChange={() => field.setValue(plan.id)}
                onBlur={field.onBlur}
              />
              {tr(plan.name)}
            </span>
            <span className="sales-plan-price">{tr(plan.price)}</span>
            <span className="sales-plan-blurb">{tr(plan.blurb)}</span>
          </label>
        ))}
      </div>
    </FieldShell>
  );
}
