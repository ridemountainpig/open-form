import {
  type ButtonUIProps,
  type CheckboxUIProps,
  type ChoiceGroupUIProps,
  defineTheme,
  type FieldUIProps,
  FocusLayout,
  type RatingUIProps,
  type SelectUIProps,
  type SuccessUIProps,
  type TextareaUIProps,
  type TextInputUIProps,
  useFormNav,
} from '@open-form-build/core';
import { useEffect, useRef } from 'react';
import './conversational.css';

// Conversational: one question per screen, big friendly type, soft color,
// letter keys for choices and auto-advance — Typeform-like. See THEME.md.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function CheckIcon({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} fill="none" aria-hidden="true">
      <path
        d="M4.5 10.5l3.5 3.5 7.5-8"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }
  return (
    target.tagName === 'INPUT' && !['radio', 'checkbox'].includes((target as HTMLInputElement).type)
  );
}

function Field({ field, children, as = 'div', hideLabel, hideDescription }: FieldUIProps) {
  const Root = as;
  const label = field.label && !hideLabel && (
    <>
      {field.label}
      {field.required && (
        <span className="cv-req" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
  return (
    <Root className="cv-field" data-invalid={field.invalid || undefined}>
      {label &&
        (as === 'fieldset' ? (
          <legend className="cv-question">{label}</legend>
        ) : (
          <label className="cv-question" htmlFor={field.id}>
            {label}
          </label>
        ))}
      {field.description && !hideDescription && (
        <p className="cv-help" id={field.descriptionId}>
          {field.description}
        </p>
      )}
      {children}
      {field.error && (
        <p className="cv-error" id={field.errorId}>
          {field.error}
        </p>
      )}
    </Root>
  );
}

function TextInput({ field, value, onChange, unit, ...attrs }: TextInputUIProps) {
  return (
    <div className="cv-line">
      <input
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="cv-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="cv-unit">{unit}</span>}
    </div>
  );
}

function Textarea({ field, value, onChange, maxLength, ...attrs }: TextareaUIProps) {
  return (
    <div className="cv-line cv-multiline">
      <textarea
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="cv-input"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength !== undefined && (
        <span className="cv-unit" aria-hidden="true">
          {[...value].length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function Select({ field, options, value, onChange, placeholder }: SelectUIProps) {
  return (
    <div className="cv-line cv-select">
      <select
        {...field.controlProps}
        ref={field.ref}
        className="cv-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="" disabled={field.required}>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

// On a one-question step, picking a single answer moves on, like Typeform.
function useAutoAdvance() {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useFormNav();
  const latest = useRef(nav);
  latest.current = nav;
  const advance = () => {
    const step = ref.current?.closest('.of-step');
    if (step?.querySelectorAll('.cv-field').length !== 1) return;
    setTimeout(() => {
      if (!latest.current.isLast) void latest.current.next();
    }, 380);
  };
  return { ref, advance };
}

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  const { ref, advance } = useAutoAdvance();
  const latest = useRef({ selected, onToggle });
  latest.current = { selected, onToggle };

  const pick = (value: string, checked: boolean) => {
    latest.current.onToggle(value, checked);
    if (!multiple && checked) advance();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelectorAll('[data-cv-keys]').length !== 1) return;
      const index = LETTERS.indexOf(event.key.toUpperCase());
      const option = index === -1 || event.key.length !== 1 ? undefined : options[index];
      if (!option) return;
      event.preventDefault();
      const on = multiple ? !latest.current.selected.includes(option.value) : true;
      pick(option.value, on);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div ref={ref} className="cv-choices" data-cv-keys="">
      {options.map((option, index) => (
        <label key={option.value} className="cv-choice">
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            aria-keyshortcuts={LETTERS[index]}
            onBlur={field.onBlur}
            onChange={(e) => pick(option.value, e.target.checked)}
          />
          <span className="cv-key" aria-hidden="true">
            {LETTERS[index]}
          </span>
          <span className="cv-choice-label">{option.label}</span>
          <span className="cv-check" aria-hidden="true">
            <CheckIcon size={18} />
          </span>
        </label>
      ))}
    </div>
  );
}

function Checkbox({ field, checked, onChange, children, markRequired }: CheckboxUIProps) {
  return (
    <label className="cv-choice cv-single">
      <input
        {...field.controlProps}
        ref={field.ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="cv-box" aria-hidden="true">
        <CheckIcon size={14} />
      </span>
      <span className="cv-choice-label">
        {children}
        {markRequired && (
          <span className="cv-req" aria-hidden="true">
            *
          </span>
        )}
        {field.description && (
          <span className="cv-help" id={field.descriptionId}>
            {field.description}
          </span>
        )}
      </span>
    </label>
  );
}

function Rating({ field, scores, value, onChange, lowLabel, highLabel }: RatingUIProps) {
  const { ref, advance } = useAutoAdvance();
  return (
    <div ref={ref}>
      <div
        className="cv-rating"
        data-many={scores.length > 7 || undefined}
        style={{ '--cv-count': scores.length } as object}
      >
        {scores.map((score, index) => (
          <label key={score} className="cv-rating-item">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={score}
              checked={value === score}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={() => {
                onChange(score);
                advance();
              }}
            />
            <span className="cv-rating-num">{score}</span>
          </label>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="cv-rating-labels" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function Button({ variant, className, type = 'button', children, ...props }: ButtonUIProps) {
  return (
    <button type={type} className={`cv-btn cv-btn-${variant} ${className ?? ''}`} {...props}>
      {children}
      {variant === 'primary' && !props.disabled && (
        <span className="cv-btn-mark" aria-hidden="true">
          <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true">
            <path
              d="M4 10h11m-4.5-4.5L15 10l-4.5 4.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  );
}

function Success({ title, children }: SuccessUIProps) {
  return (
    <div className="cv-success">
      <div className="cv-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="32" height="32" fill="none" aria-hidden="true">
          <path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
      <h1 className="cv-success-title">{title}</h1>
      <div className="cv-success-body">{children}</div>
    </div>
  );
}

// Latin in a rounded face; CJK falls through to the language's own fonts, which
// have real bold weights (Hiragino Maru Gothic has one, so browsers fake it).
const ROUNDED =
  'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, var(--of-cjk), sans-serif';

export default defineTheme({
  font: ROUNDED,
  headingFont: ROUNDED,
  radius: '14px',
  buttonRadius: '999px',
  spacing: 'comfortable',
  width: '680px',
  colors: {
    primary: '#5b4cf5',
    primaryForeground: '#ffffff',
    background: '#f8f7ff',
    surface: '#ffffff',
    foreground: '#1b1838',
    muted: '#66627f',
    border: '#e6e2fa',
    control: '#8a82c6',
    input: '#ffffff',
    error: '#d1242f',
    success: '#30a46c',
  },
  dark: {
    primary: '#a99cff',
    primaryForeground: '#120f2e',
    background: '#0e0c1f',
    surface: '#17142e',
    foreground: '#f0edff',
    muted: '#a39fc4',
    border: '#2c2850',
    control: '#6a62b8',
    input: '#1c1838',
    error: '#ff6b70',
    success: '#4cc38a',
  },
  components: {
    Layout: FocusLayout,
    Button,
    Success,
    Field,
    TextInput,
    Textarea,
    Select,
    ChoiceGroup,
    Checkbox,
    Rating,
  },
});
