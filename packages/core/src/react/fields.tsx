import { isValidElement, type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  type CustomValidator,
  composePhone,
  dialCode,
  type FieldOption,
  hasCountryCode,
  isPhoneCountry,
  PHONE_COUNTRIES,
  type PhoneCountry,
  splitPhone,
} from '../schema/index.ts';
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

export type TelProps = TextProps & {
  /**
   * Shows a country picker beside the number, starting on this country, and
   * stores answers with their country code: `+886912345678`.
   */
  defaultCountry?: PhoneCountry;
  /**
   * The countries in the picker, in this order. Answers must carry one of their
   * calling codes; regions that share one (`+1`, `+7`, `+44`…) can't be told
   * apart, so `['CA']` accepts any `+1` number. Default: all.
   */
  countries?: readonly PhoneCountry[];
};

export function Tel({ defaultCountry, countries, ...props }: TelProps) {
  if (defaultCountry === undefined && countries === undefined) {
    const { autoComplete = 'tel', ...rest } = props;
    return <TextLike {...rest} type="tel" inputMode="tel" autoComplete={autoComplete} />;
  }
  return <InternationalTel {...props} defaultCountry={defaultCountry} countries={countries} />;
}

function countryProblem(name: string, countries: readonly string[] | undefined, fallback?: string) {
  if (countries?.length === 0) return `<Tel name="${name}">: \`countries\` is empty.`;
  const unknown = [...(countries ?? []), ...(fallback ? [fallback] : [])].find(
    (country) => !isPhoneCountry(country),
  );
  if (unknown !== undefined) {
    return `<Tel name="${name}">: unknown country ${JSON.stringify(unknown)}. Use ISO 3166-1 alpha-2 codes such as "TW" or "US".`;
  }
  if (fallback && countries && !countries.includes(fallback)) {
    return `<Tel name="${name}">: \`defaultCountry\` ${JSON.stringify(fallback)} isn't in \`countries\`.`;
  }
  return undefined;
}

function useCountryOptions(countries: readonly PhoneCountry[] | undefined): FieldOption[] {
  const { messages } = useFormContext('Tel');
  const locale = messages.locale;
  const key = countries?.join(',');
  return useMemo(() => {
    let names: Intl.DisplayNames | undefined;
    try {
      names = new Intl.DisplayNames([locale], { type: 'region' });
    } catch {}
    const list = (key ? key.split(',') : PHONE_COUNTRIES).map((country) => ({
      value: country,
      label: `${names?.of(country) ?? country} +${dialCode(country)}`,
    }));
    // An author's list keeps its order; the full list is alphabetical in the form's language.
    if (!key) list.sort((a, b) => a.label.localeCompare(b.label, locale));
    return list;
  }, [key, locale]);
}

function InternationalTel({
  defaultCountry,
  countries,
  placeholder,
  autoComplete = 'tel-national',
  defaultValue,
  ...props
}: TelProps) {
  const problem = countryProblem(props.name, countries, defaultCountry);
  if (problem) throw new Error(problem);
  const preferred = defaultCountry ?? countries?.[0] ?? 'US';
  const field = useField({
    ...props,
    // Stored the way answers are: a national default gets the country code.
    defaultValue: defaultValue && composePhone(preferred, defaultValue),
    type: 'tel',
    international: true,
    countries: countries && [...countries],
  });
  const { messages } = useFormContext('Tel');
  const tr = useTranslate();
  const { Field, PhoneInput } = useFormComponents();
  const options = useCountryOptions(countries);

  const value = stringValue(field.value);
  const [draft, setDraft] = useState(() => ({ value, ...splitPhone(value, preferred, countries) }));
  // The stored answer changed elsewhere (a restored draft, a reset): show it.
  let current = draft;
  if (draft.value !== value) {
    current = { value, ...splitPhone(value, draft.country, countries) };
    setDraft(current);
  }

  // A national value set from outside (`<Form defaultValues>`, Start over) is
  // stored the way typed answers are, with the picker's country code.
  const { setValue } = field;
  useEffect(() => {
    if (value && !value.startsWith('+')) setValue(composePhone(current.country, value));
  }, [value, current.country, setValue]);

  const update = (country: string, national: string) => {
    const next = composePhone(country, national);
    setDraft({ value: next, country, national });
    field.setValue(next);
  };
  // A pasted `+44 20…` keeps its own code; once the respondent moves on, the
  // picker follows it when it's one of the offered countries.
  const onBlur = () => {
    if (hasCountryCode(current.national)) {
      const split = splitPhone(current.value, current.country, countries);
      if (split.national !== current.value) setDraft({ value: current.value, ...split });
    }
    field.onBlur();
  };
  // Picking a country after typing a number with its own code replaces that
  // code, so the picker and the stored answer always agree.
  const onCountryChange = (country: string) => {
    if (hasCountryCode(current.national)) {
      const split = splitPhone(current.value, country, countries);
      if (split.national !== current.value) return update(country, split.national);
    }
    update(country, current.national);
  };
  const numberField: FieldApi = {
    ...field,
    onBlur,
    controlProps: { ...field.controlProps, onBlur },
  };

  return (
    <Field field={field}>
      <PhoneInput
        field={numberField}
        country={current.country}
        countries={options}
        onCountryChange={onCountryChange}
        value={current.national}
        onChange={(national) => update(current.country, national)}
        countryLabel={messages.countryCode}
        placeholder={placeholder && tr(placeholder)}
        autoComplete={autoComplete}
      />
    </Field>
  );
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

export type MatrixRowInput = {
  name: string;
  label: string;
  /** Overrides the matrix's `required` for this row. */
  required?: boolean;
};

export type MatrixProps = {
  label?: string;
  description?: string;
  /** The choices every row offers: `['Poor', 'Good']` or `[{ value: '1', label: 'Poor' }]`. */
  columns: readonly OptionInput[];
  /** One single-choice question per row, each stored under its own `name`. */
  rows: readonly MatrixRowInput[];
  /** Every row must be answered, unless a row says otherwise. */
  required?: boolean;
};

/** Rows of single-choice questions sharing one set of columns, laid out as a grid. */
export function Matrix({
  label,
  description,
  columns,
  rows,
  required = false,
  ...dev
}: MatrixProps & { 'data-of-loc'?: string }) {
  const options = normalizeOptions(columns);
  const tr = useTranslate();
  const { Matrix: MatrixUI } = useFormComponents();
  const allRequired = rows.length > 0 && rows.every((row) => row.required ?? required);
  return (
    <MatrixUI
      label={label && tr(label)}
      description={description && tr(description)}
      required={allRequired}
      columns={translateOptions(options, tr)}
    >
      {rows.map((row) => (
        <MatrixRowField
          key={row.name}
          name={row.name}
          label={row.label}
          required={row.required ?? required}
          markRequired={!allRequired}
          options={options}
          data-of-loc={dev['data-of-loc']}
        />
      ))}
    </MatrixUI>
  );
}

function MatrixRowField({
  options,
  markRequired,
  ...props
}: MatrixRowInput & {
  options: FieldOption[];
  markRequired: boolean;
  'data-of-loc'?: string;
}) {
  const field = useField({ ...props, type: 'radio', options });
  const tr = useTranslate();
  const { MatrixRow } = useFormComponents();
  return (
    <MatrixRow
      field={field}
      columns={translateOptions(options, tr)}
      value={stringValue(field.value)}
      onChange={field.setValue}
      markRequired={markRequired && field.required}
    />
  );
}
