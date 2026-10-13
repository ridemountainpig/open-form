import {
  type ComponentPropsWithoutRef,
  type ComponentType,
  createContext,
  type HTMLAttributes,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type { FieldOption, Locale } from '../schema/index.ts';
import type { FormAvailability } from './context.ts';
import type { FormNav } from './nav.ts';
import type { FieldApi } from './use-field.ts';

// Appearance contract. Built-in fields own behavior (value, validation, focus,
// ARIA via `field.controlProps`); these components own markup and styling, and
// a theme or a form can replace any of them.

export type FieldUIProps = {
  field: FieldApi;
  children: ReactNode;
  /** `'fieldset'` for groups of inputs: the label becomes a legend. */
  as?: 'div' | 'fieldset';
  hideLabel?: boolean;
  /** The control renders `field.description` itself (e.g. a single checkbox). */
  hideDescription?: boolean;
};

export type TextInputUIProps = {
  field: FieldApi;
  type: 'text' | 'email' | 'url' | 'tel' | 'number' | 'date';
  value: string;
  onChange(value: string): void;
  inputMode?: HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | 'any';
  /** Suffix shown after the input, e.g. `"years"`. */
  unit?: string;
};

export type TextareaUIProps = {
  field: FieldApi;
  value: string;
  onChange(value: string): void;
  rows: number;
  autoComplete?: string;
  placeholder?: string;
  maxLength?: number;
};

export type SelectUIProps = {
  field: FieldApi;
  options: FieldOption[];
  value: string;
  onChange(value: string): void;
  placeholder: string;
};

export type ChoiceGroupUIProps = {
  field: FieldApi;
  options: FieldOption[];
  /** Checkboxes when true, radios when false. */
  multiple: boolean;
  selected: string[];
  onToggle(value: string, checked: boolean): void;
  variant: 'list' | 'cards';
};

export type CheckboxUIProps = {
  field: FieldApi;
  checked: boolean;
  onChange(checked: boolean): void;
  /** Text next to the box. */
  children: ReactNode;
  /** Show the required marker inline (there is no label above). */
  markRequired: boolean;
};

export type RatingUIProps = {
  field: FieldApi;
  scores: number[];
  value: number | undefined;
  onChange(score: number): void;
  lowLabel?: string;
  highLabel?: string;
};

// Form chrome. The framework renders the step itself (focus, scope) and the
// error live region, and hands them to `Layout` as ready-made regions.

export type LayoutUIProps = {
  /** `'success'` / `'unavailable'` put a Success / Notice in `content` instead of a step. */
  state: 'form' | 'success' | 'unavailable';
  nav: FormNav;
  /** Preview-only notice that the live form is closed. */
  banner: ReactNode;
  /** The form's title and description, rendered by `Header`. */
  header: ReactNode;
  title?: string;
  description?: string;
  progress: ReactNode;
  /** Top-level content outside any `<Page>` in a multi-step form. */
  intro: ReactNode;
  /** The current step (or the success / unavailable screen). */
  content: ReactNode;
  /** Live region for form-level errors. Keep it rendered. */
  alert: ReactNode;
  /** Back / Next / Submit. */
  actions: ReactNode;
  /** `<Form aside>` content, if any. */
  aside: ReactNode;
};

export type HeaderUIProps = {
  title?: string;
  description?: string;
};

export type ProgressUIProps = {
  nav: FormNav;
  /** Localized "Step 2 of 5". */
  label: string;
};

export type NavUIProps = {
  nav: FormNav;
  /** `<Submit>` children, or the localized default. */
  submitLabel: ReactNode;
  labels: { back: string; next: string; submitting: string };
};

export type ButtonUIProps = ComponentPropsWithoutRef<'button'> & {
  variant: 'primary' | 'secondary';
};

export type SuccessUIProps = {
  title: ReactNode;
  /** `<Success>` children, or the configured / default message. */
  children: ReactNode;
};

export type NoticeUIProps = {
  state: FormAvailability['state'];
  /** The form's title, for context. */
  eyebrow?: string;
  title: string;
  message: string;
};

export type LanguageSwitchUIProps = {
  value: Locale;
  /** Each language's own name: English, 繁體中文, 日本語… */
  options: Array<{ value: Locale; label: string }>;
  onChange(locale: Locale): void;
  /** Accessible name, e.g. "Language". */
  label: string;
};

export type FormComponents = {
  Layout: ComponentType<LayoutUIProps>;
  LanguageSwitch: ComponentType<LanguageSwitchUIProps>;
  Header: ComponentType<HeaderUIProps>;
  Progress: ComponentType<ProgressUIProps>;
  Nav: ComponentType<NavUIProps>;
  Button: ComponentType<ButtonUIProps>;
  Success: ComponentType<SuccessUIProps>;
  Notice: ComponentType<NoticeUIProps>;
  Field: ComponentType<FieldUIProps>;
  TextInput: ComponentType<TextInputUIProps>;
  Textarea: ComponentType<TextareaUIProps>;
  Select: ComponentType<SelectUIProps>;
  ChoiceGroup: ComponentType<ChoiceGroupUIProps>;
  Checkbox: ComponentType<CheckboxUIProps>;
  Rating: ComponentType<RatingUIProps>;
};

export function RequiredMark() {
  return (
    <span className="of-required" aria-hidden="true">
      *
    </span>
  );
}

function DefaultField({ field, children, as = 'div', hideLabel, hideDescription }: FieldUIProps) {
  const label = field.label && !hideLabel && (
    <>
      {field.label}
      {field.required && <RequiredMark />}
    </>
  );
  const description = field.description && !hideDescription && (
    <p className="of-help" id={field.descriptionId}>
      {field.description}
    </p>
  );
  const error = field.error && (
    <p className="of-error" id={field.errorId}>
      {field.error}
    </p>
  );

  if (as === 'fieldset') {
    return (
      <fieldset className="of-field" data-invalid={field.invalid || undefined}>
        {label && <legend className="of-label">{label}</legend>}
        {description}
        {children}
        {error}
      </fieldset>
    );
  }
  return (
    <div className="of-field" data-invalid={field.invalid || undefined}>
      {label && (
        <label className="of-label" htmlFor={field.id}>
          {label}
        </label>
      )}
      {description}
      {children}
      {error}
    </div>
  );
}

function DefaultTextInput({ field, type, value, onChange, unit, ...attrs }: TextInputUIProps) {
  const input = (
    <input
      {...field.controlProps}
      {...attrs}
      ref={field.ref}
      className={type === 'date' ? 'of-input of-date' : 'of-input'}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (!unit) return input;
  return (
    <div className="of-input-group">
      {input}
      <span className="of-unit">{unit}</span>
    </div>
  );
}

function DefaultTextarea({ field, value, onChange, maxLength, ...attrs }: TextareaUIProps) {
  return (
    <>
      <textarea
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="of-input of-textarea"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength !== undefined && (
        <div className="of-counter" aria-hidden="true">
          {[...value].length} / {maxLength}
        </div>
      )}
    </>
  );
}

function DefaultSelect({ field, options, value, onChange, placeholder }: SelectUIProps) {
  return (
    <div className="of-select-wrap">
      <select
        {...field.controlProps}
        ref={field.ref}
        className="of-input of-select"
        value={value}
        data-placeholder={value === '' || undefined}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled={field.required}>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DefaultChoiceGroup({
  field,
  options,
  multiple,
  selected,
  onToggle,
  variant,
}: ChoiceGroupUIProps) {
  return (
    <div className="of-choices" data-variant={variant}>
      {options.map((option, index) => (
        <label key={option.value} className="of-choice">
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            className={multiple ? 'of-checkbox' : 'of-radio'}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            onBlur={field.onBlur}
            onChange={(e) => onToggle(option.value, e.target.checked)}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function DefaultCheckbox({ field, checked, onChange, children, markRequired }: CheckboxUIProps) {
  return (
    <label className="of-choice of-choice-single">
      <input
        {...field.controlProps}
        ref={field.ref}
        type="checkbox"
        className="of-checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="of-choice-text">
        <span>
          {children}
          {markRequired && <RequiredMark />}
        </span>
        {field.description && (
          <span className="of-help" id={field.descriptionId}>
            {field.description}
          </span>
        )}
      </span>
    </label>
  );
}

function DefaultRating({ field, scores, value, onChange, lowLabel, highLabel }: RatingUIProps) {
  return (
    <>
      <div className="of-rating" style={{ '--of-rating-count': scores.length } as object}>
        {scores.map((score, index) => (
          <label key={score} className="of-rating-item">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={score}
              checked={value === score}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={() => onChange(score)}
            />
            <span>{score}</span>
          </label>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="of-rating-labels" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </>
  );
}

function DefaultLayout({
  state,
  banner,
  header,
  progress,
  intro,
  content,
  alert,
  actions,
  aside,
}: LayoutUIProps) {
  if (state !== 'form') {
    return (
      <div
        className={state === 'success' ? 'of-form of-success' : 'of-form of-notice'}
        role="status"
      >
        {content}
      </div>
    );
  }
  const card = (
    <div className="of-form">
      {banner}
      {header}
      {progress}
      {intro}
      {content}
      {alert}
      {actions}
    </div>
  );
  if (!aside) return card;
  return (
    <div className="of-shell">
      {card}
      <aside className="of-aside">{aside}</aside>
    </div>
  );
}

function DefaultHeader({ title, description }: HeaderUIProps) {
  if (!title && !description) return null;
  return (
    <header className="of-header">
      {title && <h1 className="of-title">{title}</h1>}
      {description && <p className="of-description">{description}</p>}
    </header>
  );
}

function DefaultProgress({ nav, label }: ProgressUIProps) {
  if (nav.total < 2) return null;
  return (
    <div className="of-progress">
      <div className="of-progress-label">{label}</div>
      <div
        className="of-progress-track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={nav.total}
        aria-valuenow={nav.position + 1}
        aria-label={label}
      >
        <div
          className="of-progress-bar"
          style={{ width: `${((nav.position + 1) / nav.total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function DefaultNav({ nav, submitLabel, labels }: NavUIProps) {
  const { Button } = useFormComponents();
  return (
    <div className="of-nav">
      {!nav.isFirst && (
        <Button type="button" variant="secondary" onClick={nav.back}>
          {labels.back}
        </Button>
      )}
      <Button type="submit" variant="primary" disabled={nav.submitting}>
        {nav.submitting ? labels.submitting : nav.isLast ? submitLabel : labels.next}
      </Button>
    </div>
  );
}

function DefaultButton({ variant, className, type = 'button', ...props }: ButtonUIProps) {
  const classes = ['of-button', `of-button-${variant}`, className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}

function DefaultSuccess({ title, children }: SuccessUIProps) {
  return (
    <>
      <div className="of-success-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="of-title">{title}</h1>
      {children}
    </>
  );
}

function DefaultNotice({ eyebrow, title, message }: NoticeUIProps) {
  return (
    <>
      {eyebrow && <p className="of-eyebrow">{eyebrow}</p>}
      <h1 className="of-title">{title}</h1>
      <p className="of-description">{message}</p>
    </>
  );
}

/** The built-in look. Spread it to override a few components, or wrap one to extend it. */
function DefaultLanguageSwitch({ value, options, onChange, label }: LanguageSwitchUIProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const choose = (next: Locale) => {
    setOpen(false);
    button.current?.focus();
    if (next !== value) onChange(next);
  };

  const onListKey = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...(list.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const step = event.key === 'ArrowDown' ? 1 : -1;
      items[Math.min(items.length - 1, Math.max(0, index + step))]?.focus();
    }
  };

  return (
    <div className="of-lang" ref={root}>
      <button
        ref={button}
        type="button"
        className="of-lang-button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current?.label ?? value}`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
        </svg>
        <span lang={value}>{current?.label ?? value}</span>
        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
          <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div
          ref={list}
          role="listbox"
          aria-label={label}
          tabIndex={-1}
          className="of-lang-menu"
          onKeyDown={onListKey}
        >
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              role="option"
              lang={o.value}
              aria-selected={o.value === value}
              className="of-lang-option"
              onClick={() => choose(o.value)}
            >
              {o.label}
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" aria-hidden="true">
                <path
                  d="m3.5 8.5 3 3 6-7"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export const defaultComponents: FormComponents = {
  Layout: DefaultLayout,
  LanguageSwitch: DefaultLanguageSwitch,
  Header: DefaultHeader,
  Progress: DefaultProgress,
  Nav: DefaultNav,
  Button: DefaultButton,
  Success: DefaultSuccess,
  Notice: DefaultNotice,
  Field: DefaultField,
  TextInput: DefaultTextInput,
  Textarea: DefaultTextarea,
  Select: DefaultSelect,
  ChoiceGroup: DefaultChoiceGroup,
  Checkbox: DefaultCheckbox,
  Rating: DefaultRating,
};

export const ComponentsContext = createContext<FormComponents>(defaultComponents);

/** The components in effect: defaults ← theme `components` ← `<Form components>`. */
export function useFormComponents(): FormComponents {
  return useContext(ComponentsContext);
}

export function mergeComponents(
  ...layers: Array<Partial<FormComponents> | undefined>
): FormComponents {
  const merged = { ...defaultComponents };
  for (const layer of layers) {
    if (!layer) continue;
    for (const [key, component] of Object.entries(layer)) {
      if (component) (merged as Record<string, unknown>)[key] = component;
    }
  }
  return merged;
}
