import { type FieldApi, T, useField, useFormValues, useTranslate } from '@open-form-build/core';

type Option = { value: string; label: string };

type BlankProps = {
  name: string;
  /** Read by screen readers and used as the column title in Responses; the sentence is the visible label. */
  label: string;
  placeholder: string;
  type?: 'text' | 'email';
  autoComplete?: string;
  required?: boolean;
};

function Problem({ field }: { field: FieldApi }) {
  if (!field.error) return null;
  return (
    <span className="od-error" id={field.errorId}>
      {field.error}
    </span>
  );
}

/** A blank in the sentence: a text field that grows with what is typed into it. */
export function Blank({
  name,
  label,
  placeholder,
  type = 'text',
  autoComplete,
  required,
}: BlankProps) {
  const field = useField({ name, label, required, type });
  const tr = useTranslate();
  const value = typeof field.value === 'string' ? field.value : '';
  const hint = tr(placeholder);
  return (
    <span
      className="od-blank"
      data-filled={value ? '' : undefined}
      data-invalid={field.invalid || undefined}
    >
      <span className="od-sizer" aria-hidden="true">
        {value || hint}
      </span>
      <input
        {...field.controlProps}
        ref={field.ref}
        type={type}
        inputMode={type === 'email' ? 'email' : undefined}
        autoComplete={autoComplete}
        autoCapitalize={type === 'email' ? 'none' : undefined}
        spellCheck={false}
        placeholder={hint}
        aria-label={field.label}
        value={value}
        onChange={(event) => field.setValue(event.target.value)}
      />
      <Problem field={field} />
    </span>
  );
}

type PickProps = Omit<BlankProps, 'type' | 'autoComplete'> & { options: Option[] };

/** A blank with a fixed set of endings: a native select dressed as part of the sentence. */
export function Pick({ name, label, placeholder, options, required }: PickProps) {
  const field = useField({ name, label, required, type: 'select', options });
  const tr = useTranslate();
  const value = typeof field.value === 'string' ? field.value : '';
  const chosen = options.find((option) => option.value === value);
  return (
    <span
      className="od-blank od-pick"
      data-filled={chosen ? '' : undefined}
      data-invalid={field.invalid || undefined}
    >
      <span className="od-sizer" aria-hidden="true">
        {chosen ? tr(chosen.label) : tr(placeholder)}
      </span>
      <select
        {...field.controlProps}
        ref={field.ref}
        aria-label={field.label}
        value={value}
        onChange={(event) => field.setValue(event.target.value)}
      >
        <option value="" disabled>
          {tr(placeholder)}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {tr(option.label)}
          </option>
        ))}
      </select>
      <Problem field={field} />
    </span>
  );
}

/** How many blanks are filled, for the foot of the letter. */
export function Progress({ total }: { total: number }) {
  const values = useFormValues();
  const filled = Object.values(values).filter(
    (value) => typeof value === 'string' && value.trim(),
  ).length;
  const done = Math.min(filled, total);
  return (
    <div className="od-progress">
      <p>
        {done} / {total} <T>blanks filled</T>
      </p>
      <div aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <i key={i} data-on={i < done || undefined} />
        ))}
      </div>
    </div>
  );
}
