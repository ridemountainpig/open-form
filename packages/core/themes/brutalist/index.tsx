import {
  type ButtonUIProps,
  type CheckboxUIProps,
  type ChoiceGroupUIProps,
  defineTheme,
  type FieldUIProps,
  type HeaderUIProps,
  type ProgressUIProps,
  type RatingUIProps,
  type SelectUIProps,
  type SuccessUIProps,
  type TextareaUIProps,
  type TextInputUIProps,
} from '@open-form-build/core';
import './brutalist.css';

// Brutalist: neo-brutalism — loud yellow, thick black borders, hard offset
// shadows, heavy uppercase type, blocks you can feel pressing. See THEME.md.

function Header({ title, description }: HeaderUIProps) {
  if (!title && !description) return null;
  return (
    <header className="br-header">
      {title && (
        <h1 className="br-title">
          <span>{title}</span>
        </h1>
      )}
      {description && <p className="br-desc">{description}</p>}
    </header>
  );
}

function Progress({ nav, label }: ProgressUIProps) {
  if (nav.total < 2) return null;
  return (
    <div className="br-progress">
      <div
        className="br-progress-blocks"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={nav.total}
        aria-valuenow={nav.position + 1}
        aria-label={label}
      >
        {nav.steps.map((step) => (
          <span key={step.index} data-state={step.state} />
        ))}
      </div>
      <span className="br-progress-label">{label}</span>
    </div>
  );
}

function Button({ variant, className, type = 'button', ...props }: ButtonUIProps) {
  return (
    <button type={type} className={`br-btn br-btn-${variant} ${className ?? ''}`} {...props} />
  );
}

function Success({ title, children }: SuccessUIProps) {
  return (
    <div className="br-success">
      <div className="br-sticker">{title}</div>
      <div className="br-success-body">{children}</div>
    </div>
  );
}

function Field({ field, children, as = 'div', hideLabel, hideDescription }: FieldUIProps) {
  const Root = as;
  const label = field.label && !hideLabel && (
    <>
      {field.label}
      {field.required && (
        <span className="br-req" aria-hidden="true">
          *
        </span>
      )}
    </>
  );
  return (
    <Root className="br-field" data-invalid={field.invalid || undefined}>
      {label &&
        (as === 'fieldset' ? (
          <legend className="br-label">{label}</legend>
        ) : (
          <label className="br-label" htmlFor={field.id}>
            {label}
          </label>
        ))}
      {field.description && !hideDescription && (
        <p className="br-help" id={field.descriptionId}>
          {field.description}
        </p>
      )}
      {children}
      {field.error && (
        <p className="br-error" id={field.errorId}>
          {field.error}
        </p>
      )}
    </Root>
  );
}

function TextInput({ field, value, onChange, unit, ...attrs }: TextInputUIProps) {
  return (
    <div className="br-input-wrap">
      <input
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="br-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="br-unit">{unit}</span>}
    </div>
  );
}

function Textarea({ field, value, onChange, maxLength, ...attrs }: TextareaUIProps) {
  return (
    <div className="br-input-wrap br-textarea-wrap">
      <textarea
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="br-input br-textarea"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength !== undefined && (
        <span className="br-count" aria-hidden="true">
          {[...value].length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function Select({ field, options, value, onChange, placeholder }: SelectUIProps) {
  return (
    <div className="br-input-wrap br-select">
      <select
        {...field.controlProps}
        ref={field.ref}
        className="br-input"
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

function ChoiceGroup({
  field,
  options,
  multiple,
  selected,
  onToggle,
  variant,
}: ChoiceGroupUIProps) {
  return (
    <div className="br-choices" data-variant={variant}>
      {options.map((option, index) => (
        <label key={option.value} className="br-choice">
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            onBlur={field.onBlur}
            onChange={(e) => onToggle(option.value, e.target.checked)}
          />
          <span
            className="br-choice-box"
            data-multiple={multiple || undefined}
            aria-hidden="true"
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function Checkbox({ field, checked, onChange, children, markRequired }: CheckboxUIProps) {
  return (
    <label className="br-choice br-single">
      <input
        {...field.controlProps}
        ref={field.ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="br-choice-box" data-multiple aria-hidden="true" />
      <span className="br-single-text">
        <span>
          {children}
          {markRequired && (
            <span className="br-req" aria-hidden="true">
              *
            </span>
          )}
        </span>
        {field.description && (
          <span className="br-help" id={field.descriptionId}>
            {field.description}
          </span>
        )}
      </span>
    </label>
  );
}

function Rating({ field, scores, value, onChange, lowLabel, highLabel }: RatingUIProps) {
  return (
    <div>
      <div className="br-rating" style={{ '--br-count': scores.length } as object}>
        {scores.map((score, index) => (
          <label key={score} className="br-rating-item">
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
        <div className="br-rating-labels" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

export default defineTheme({
  colorScheme: 'light',
  font: '"Helvetica Neue", Helvetica, Arial, var(--of-cjk), sans-serif',
  headingFont: '"Arial Black", "Helvetica Neue", Helvetica, Impact, var(--of-cjk), sans-serif',
  radius: '0px',
  spacing: 'comfortable',
  width: '600px',
  colors: {
    primary: '#ff4f9a',
    primaryForeground: '#000000',
    background: '#ffd84d',
    surface: '#fffdf3',
    foreground: '#000000',
    muted: '#3b3b3b',
    border: '#000000',
    control: '#000000',
    input: '#ffffff',
    error: '#e5001c',
    success: '#00a86b',
  },
  components: {
    Header,
    Progress,
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
