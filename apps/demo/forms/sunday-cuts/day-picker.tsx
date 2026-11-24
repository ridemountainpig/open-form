import { FieldShell, useField, useFormLanguage } from '@open-form-build/core';
import { useMemo } from 'react';

type Props = { name: string; label: string; description?: string; required?: boolean };

function iso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The next seven days as tiles. The shop is closed on Mondays, so those can't be picked. Stores `YYYY-MM-DD`. */
export function DayPicker({ name, label, description, required }: Props) {
  const field = useField({
    name,
    label,
    description,
    required,
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
    validate: (value) =>
      typeof value === 'string' && new Date(`${value}T12:00`).getDay() === 1
        ? 'We are closed on Mondays.'
        : undefined,
  });
  const { locale } = useFormLanguage();
  const days = useMemo(() => {
    const start = new Date();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i + 1);
      return {
        value: iso(date),
        weekday: date.toLocaleDateString(locale, { weekday: 'short' }),
        day: date.getDate(),
        closed: date.getDay() === 1,
      };
    });
  }, [locale]);

  return (
    <FieldShell field={field} as="fieldset">
      <div className="sc-days">
        {days.map((day, index) => (
          <label key={day.value} className="sc-day" data-closed={day.closed || undefined}>
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={day.value}
              disabled={day.closed}
              checked={field.value === day.value}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={() => field.setValue(day.value)}
            />
            <span>{day.weekday}</span>
            <b>{day.day}</b>
          </label>
        ))}
      </div>
    </FieldShell>
  );
}
