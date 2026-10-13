import { isValidElement, type ReactNode } from 'react';
import type { CustomValidator } from '../schema/index.ts';
import { type TextInputUIProps, useFormComponents } from './components.tsx';
import { useFormContext } from './context.ts';
import { useTranslate, useTranslatedNode } from './i18n.tsx';
import { normalizeOptions, type OptionInput, translateOptions } from './options.ts';
import { type FieldApi, useField } from './use-field.ts';

// Built-in fields are behavior only: they wire a value into the form with
// `useField` and hand rendering to the active components (see components.tsx).

type BaseProps = {
  name: string;
  label?: string;
  description?: string;
  required?: boolean;
  /** Extra validation: return an error message, or pass a Zod / Valibot / Standard Schema. */
  validate?: CustomValidator;
};

export type FieldShellProps = {
  field: FieldApi;
  children: ReactNode;
  /** Use `'fieldset'` for groups of inputs (radios, checkboxes). */
  as?: 'div' | 'fieldset';
  hideLabel?: boolean;
  /** For controls that render `field.description` themselves. */
  hideDescription?: boolean;
};

/** Label, description and error around a control, in the active theme's style. Use it for custom fields. */
export function FieldShell(props: FieldShellProps) {
  const { Field } = useFormComponents();
  return <Field {...props} />;
}

function stringValue(value: unknown): string {
  if (value === undefined || value === null) return '';
  return String(value);
}

type TextLikeProps = BaseProps & {
  placeholder?: string;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  /** Matched against the whole value, like the HTML `pattern` attribute. */
  pattern?: string;
  patternMessage?: string;
  autoComplete?: string;
};

function TextLike({
  type,
  inputMode,
  autoComplete,
  ...props
}: TextLikeProps & {
  type: 'text' | 'email' | 'url' | 'tel';
  inputMode?: TextInputUIProps['inputMode'];
}) {
  const field = useField({ ...props, type });
  const tr = useTranslate();
  const { Field, TextInput } = useFormComponents();
  return (
    <Field field={field}>
      <TextInput
        field={field}
        type={type}
        inputMode={inputMode}
        autoComplete={autoComplete}
        placeholder={props.placeholder && tr(props.placeholder)}
        maxLength={props.maxLength}
        value={stringValue(field.value)}
        onChange={field.setValue}
      />
    </Field>
  );
}

export type TextProps = TextLikeProps;

export function Text(props: TextProps) {
  return <TextLike {...props} type="text" />;
}

export function Email({ autoComplete = 'email', ...props }: TextProps) {
  return <TextLike {...props} type="email" inputMode="email" autoComplete={autoComplete} />;
}

export function Url({ autoComplete = 'url', ...props }: TextProps) {
  return <TextLike {...props} type="url" inputMode="url" autoComplete={autoComplete} />;
}

export function Tel({ autoComplete = 'tel', ...props }: TextProps) {
  return <TextLike {...props} type="tel" inputMode="tel" autoComplete={autoComplete} />;
}

export type TextareaProps = TextLikeProps & { rows?: number };

export function Textarea({ rows = 4, autoComplete, ...props }: TextareaProps) {
  const field = useField({ ...props, type: 'textarea' });
  const tr = useTranslate();
  const { Field, Textarea: TextareaUI } = useFormComponents();
  return (
    <Field field={field}>
      <TextareaUI
        field={field}
        rows={rows}
        autoComplete={autoComplete}
        placeholder={props.placeholder && tr(props.placeholder)}
        maxLength={props.maxLength}
        value={stringValue(field.value)}
        onChange={field.setValue}
      />
    </Field>
  );
}

export type NumberInputProps = BaseProps & {
  placeholder?: string;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number;
  integer?: boolean;
  /** Shown after the input, e.g. `"years"`. */
  unit?: string;
};

export function NumberInput({ step, unit, ...props }: NumberInputProps) {
  const field = useField({ ...props, step, type: 'number' });
  const tr = useTranslate();
  const { Field, TextInput } = useFormComponents();
  return (
    <Field field={field}>
      <TextInput
        field={field}
        type="number"
        inputMode={props.integer ? 'numeric' : 'decimal'}
        min={props.min}
        max={props.max}
        step={step ?? (props.integer ? 1 : 'any')}
        placeholder={props.placeholder && tr(props.placeholder)}
        unit={unit && tr(unit)}
        value={stringValue(field.value)}
        onChange={field.setValue}
      />
    </Field>
  );
}

export type DateInputProps = BaseProps & {
  defaultValue?: string;
  /** `YYYY-MM-DD` */
  min?: string;
  /** `YYYY-MM-DD` */
  max?: string;
};

export function DateInput(props: DateInputProps) {
  const field = useField({ ...props, type: 'date' });
  const { Field, TextInput } = useFormComponents();
  return (
    <Field field={field}>
      <TextInput
        field={field}
        type="date"
        min={props.min}
        max={props.max}
        value={stringValue(field.value)}
        onChange={field.setValue}
      />
    </Field>
  );
}

export type ChoiceProps = BaseProps & {
  /** `['A', 'B']` or `[{ value: 'a', label: 'A' }]` */
  options: readonly OptionInput[];
  defaultValue?: string;
};

export type SelectProps = ChoiceProps & { placeholder?: string };

export function Select({ placeholder, ...props }: SelectProps) {
  const options = normalizeOptions(props.options);
  const field = useField({ ...props, type: 'select', options });
  const { messages } = useFormContext('Select');
  const tr = useTranslate();
  const { Field, Select: SelectUI } = useFormComponents();
  return (
    <Field field={field}>
      <SelectUI
        field={field}
        options={translateOptions(options, tr)}
        placeholder={placeholder ? tr(placeholder) : messages.selectPlaceholder}
        value={stringValue(field.value)}
        onChange={field.setValue}
      />
    </Field>
  );
}

export type RadioGroupProps = ChoiceProps & {
  /** `'list'` stacks options; `'cards'` lays them out as a responsive grid. */
  variant?: 'list' | 'cards';
};

export function RadioGroup({ variant = 'list', ...props }: RadioGroupProps) {
  const options = normalizeOptions(props.options);
  const field = useField({ ...props, type: 'radio', options });
  const tr = useTranslate();
  const { Field, ChoiceGroup } = useFormComponents();
  const value = stringValue(field.value);
  return (
    <Field field={field} as="fieldset">
      <ChoiceGroup
        field={field}
        options={translateOptions(options, tr)}
        multiple={false}
        variant={variant}
        selected={value ? [value] : []}
        onToggle={(next) => field.setValue(next)}
      />
    </Field>
  );
}

export type CheckboxProps = BaseProps & {
  defaultValue?: boolean;
  /** Inline text next to the box; falls back to `label`. */
  children?: ReactNode;
};

// Plain text of a JSX label, so responses and exports get a readable column name.
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return '';
}

/** A single yes/no box. `required` means it must be checked (e.g. terms). */
export function Checkbox({ children, ...props }: CheckboxProps) {
  const label = props.label ?? (textOf(children).replace(/\s+/g, ' ').trim() || undefined);
  const field = useField({ ...props, label, type: 'checkbox' });
  const { Field, Checkbox: CheckboxUI } = useFormComponents();
  // A separate label above the box only when both `label` and inline text are given.
  const labelAbove = props.label !== undefined && children !== undefined;
  const inline = useTranslatedNode(children ?? props.label);
  return (
    <Field field={field} hideLabel={!labelAbove} hideDescription>
      <CheckboxUI
        field={field}
        checked={field.value === true}
        onChange={field.setValue}
        markRequired={!labelAbove && field.required}
      >
        {inline}
      </CheckboxUI>
    </Field>
  );
}

export type CheckboxGroupProps = BaseProps & {
  options: readonly OptionInput[];
  defaultValue?: string[];
  minSelected?: number;
  maxSelected?: number;
  variant?: 'list' | 'cards';
};

export function CheckboxGroup({ variant = 'list', ...props }: CheckboxGroupProps) {
  const options = normalizeOptions(props.options);
  const field = useField({ ...props, type: 'checkbox-group', options });
  const tr = useTranslate();
  const { Field, ChoiceGroup } = useFormComponents();
  const selected = Array.isArray(field.value) ? (field.value as string[]) : [];
  const toggle = (value: string, on: boolean) => {
    const next = on ? [...selected, value] : selected.filter((v) => v !== value);
    field.setValue(options.map((o) => o.value).filter((v) => next.includes(v)));
  };
  return (
    <Field field={field} as="fieldset">
      <ChoiceGroup
        field={field}
        options={translateOptions(options, tr)}
        multiple
        variant={variant}
        selected={selected}
        onToggle={toggle}
      />
    </Field>
  );
}

export type RatingProps = BaseProps & {
  /** Highest score. Default 5. */
  max?: number;
  /** Lowest score. Default 1 (use 0 for NPS-style 0–10). */
  min?: number;
  /** Captions under the lowest and highest score. */
  lowLabel?: string;
  highLabel?: string;
  defaultValue?: number;
};

/** A row of scores, e.g. 1–5 satisfaction or 0–10 NPS. Stored as a number. */
export function Rating({ min = 1, max = 5, lowLabel, highLabel, ...props }: RatingProps) {
  const field = useField({ ...props, type: 'number', min, max, integer: true });
  const tr = useTranslate();
  const { Field, Rating: RatingUI } = useFormComponents();
  const scores = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const value = field.value === undefined || field.value === '' ? undefined : Number(field.value);
  return (
    <Field field={field} as="fieldset">
      <RatingUI
        field={field}
        scores={scores}
        value={value}
        onChange={field.setValue}
        lowLabel={lowLabel && tr(lowLabel)}
        highLabel={highLabel && tr(highLabel)}
      />
    </Field>
  );
}
