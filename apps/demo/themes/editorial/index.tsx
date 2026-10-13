import {
  type CheckboxUIProps,
  type ChoiceGroupUIProps,
  defineTheme,
  type FieldUIProps,
  type RatingUIProps,
  type SelectUIProps,
  SplitLayout,
  type TextareaUIProps,
  type TextInputUIProps,
} from '@open-form-build/core';
import './editorial.css';

// Editorial: a magazine look — serif type, hairline rules, underline inputs, pill choices,
// and a split layout with an ink panel. See THEME.md.
// Each component receives the field's behavior (value, errors, ARIA) as props
// and only decides how it looks.

function Field({ field, children, as = 'div', hideLabel, hideDescription }: FieldUIProps) {
  const Root = as;
  const label = field.label && !hideLabel && (
    <>
      {field.label}
      {field.required && <span aria-hidden="true"> *</span>}
    </>
  );
  return (
    <Root className="ed-field" data-invalid={field.invalid || undefined}>
      {label &&
        (as === 'fieldset' ? (
          <legend className="ed-label">{label}</legend>
        ) : (
          <label className="ed-label" htmlFor={field.id}>
            {label}
          </label>
        ))}
      {field.description && !hideDescription && (
        <p className="ed-help" id={field.descriptionId}>
          {field.description}
        </p>
      )}
      {children}
      {field.error && (
        <p className="ed-error" id={field.errorId}>
          {field.error}
        </p>
      )}
    </Root>
  );
}

function TextInput({ field, value, onChange, unit, ...attrs }: TextInputUIProps) {
  return (
    <div className="ed-line">
      <input
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="ed-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="ed-unit">{unit}</span>}
    </div>
  );
}

function Textarea({ field, value, onChange, maxLength, ...attrs }: TextareaUIProps) {
  return (
    <div className="ed-line">
      <textarea
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="ed-input ed-textarea"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength !== undefined && (
        <span className="ed-count" aria-hidden="true">
          {[...value].length}/{maxLength}
        </span>
      )}
    </div>
  );
}

function Select({ field, options, value, onChange, placeholder }: SelectUIProps) {
  return (
    <div className="ed-line ed-select">
      <select
        {...field.controlProps}
        ref={field.ref}
        className="ed-input"
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

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  return (
    <div className="ed-chips">
      {options.map((option, index) => (
        <label key={option.value} className="ed-chip">
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
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function Checkbox({ field, checked, onChange, children, markRequired }: CheckboxUIProps) {
  return (
    <label className="ed-check">
      <input
        {...field.controlProps}
        ref={field.ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="ed-check-box" aria-hidden="true" />
      <span className="ed-check-text">
        {children}
        {markRequired && <span aria-hidden="true"> *</span>}
        {field.description && (
          <span className="ed-help" id={field.descriptionId}>
            {field.description}
          </span>
        )}
      </span>
    </label>
  );
}

function Rating({ field, scores, value, onChange, lowLabel, highLabel }: RatingUIProps) {
  return (
    <div className="ed-rating">
      <div className="ed-rating-row">
        {scores.map((score, index) => (
          <label key={score} className="ed-rating-item">
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
        <div className="ed-rating-labels" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

export default defineTheme({
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont:
    '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, var(--of-cjk-serif), serif',
  radius: '0px',
  spacing: 'spacious',
  width: '620px',
  colors: {
    primary: '#151412',
    primaryForeground: '#f7f3ec',
    background: '#efe9df',
    surface: '#f7f3ec',
    foreground: '#151412',
    muted: '#6f675d',
    border: '#d6cdbf',
    control: '#857d70',
    input: '#f7f3ec',
    error: '#b42318',
  },
  dark: {
    primary: '#efe9df',
    primaryForeground: '#151412',
    background: '#0f0e0c',
    surface: '#171513',
    foreground: '#efe9df',
    muted: '#a0978a',
    border: '#38332c',
    control: '#6e675e',
    input: '#171513',
    error: '#ff8a7a',
  },
  components: {
    Layout: SplitLayout,
    Field,
    TextInput,
    Textarea,
    Select,
    ChoiceGroup,
    Checkbox,
    Rating,
  },
});
