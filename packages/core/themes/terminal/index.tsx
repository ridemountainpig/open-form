import {
  type ButtonUIProps,
  type CheckboxUIProps,
  type ChoiceGroupUIProps,
  defineTheme,
  type FieldUIProps,
  type HeaderUIProps,
  type LayoutUIProps,
  type NoticeUIProps,
  type ProgressUIProps,
  type RatingUIProps,
  type SelectUIProps,
  type SuccessUIProps,
  type TextareaUIProps,
  type TextInputUIProps,
} from '@open-form-build/core';
import './terminal.css';

// Terminal: the form as a CLI session — a window frame, `? question` prompts,
// `❯` input lines, [x] / (•) choices and an ASCII progress bar. See THEME.md.

function Layout({
  state,
  nav,
  banner,
  header,
  progress,
  intro,
  content,
  alert,
  actions,
  aside,
}: LayoutUIProps) {
  const status =
    state === 'form' ? (nav.total > 1 ? `step ${nav.position + 1}/${nav.total}` : 'ready') : state;
  return (
    <div className="tm-window" data-state={state}>
      <div className="tm-titlebar" aria-hidden="true">
        <span className="tm-dots">
          <i />
          <i />
          <i />
        </span>
        <span className="tm-titlebar-text">~/forms — {status}</span>
      </div>
      <div className="tm-body" role={state === 'form' ? undefined : 'status'}>
        {banner}
        {header}
        {progress}
        {intro}
        {content}
        {alert}
        {actions}
        {aside && <div className="tm-aside">{aside}</div>}
      </div>
    </div>
  );
}

function Header({ title, description }: HeaderUIProps) {
  if (!title && !description) return null;
  return (
    <header className="tm-header">
      <p className="tm-cmd" aria-hidden="true">
        <span className="tm-accent">$</span> open-form start
      </p>
      {title && <h1 className="tm-title">{title}</h1>}
      {description && <p className="tm-desc">{description}</p>}
    </header>
  );
}

const BAR = 24;

function Progress({ nav, label }: ProgressUIProps) {
  if (nav.total < 2) return null;
  const filled = Math.round(((nav.position + 1) / nav.total) * BAR);
  return (
    <div
      className="tm-progress"
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={nav.total}
      aria-valuenow={nav.position + 1}
      aria-label={label}
    >
      <span aria-hidden="true">
        [<span className="tm-accent">{'█'.repeat(filled)}</span>
        <span className="tm-dim">{'░'.repeat(BAR - filled)}</span>]
      </span>
      <span>
        {nav.position + 1}/{nav.total}
      </span>
      {nav.stepTitle && <span className="tm-dim">{nav.stepTitle}</span>}
    </div>
  );
}

function Button({ variant, className, type = 'button', children, ...props }: ButtonUIProps) {
  return (
    <button type={type} className={`tm-btn tm-btn-${variant} ${className ?? ''}`} {...props}>
      <span aria-hidden="true">{variant === 'primary' ? '' : '← '}</span>
      {children}
      <span aria-hidden="true">{variant === 'primary' ? ' ↵' : ''}</span>
    </button>
  );
}

function Success({ title, children }: SuccessUIProps) {
  return (
    <div className="tm-result">
      <p className="tm-ok">
        <span aria-hidden="true">✔ </span>
        {title}
      </p>
      <div className="tm-result-body">{children}</div>
      <p className="tm-dim" aria-hidden="true">
        process exited with code 0
      </p>
    </div>
  );
}

function Notice({ eyebrow, title, message }: NoticeUIProps) {
  return (
    <div className="tm-result">
      {eyebrow && <p className="tm-dim"># {eyebrow}</p>}
      <p className="tm-fail">
        <span aria-hidden="true">✖ </span>
        {title}
      </p>
      <p className="tm-desc">{message}</p>
    </div>
  );
}

function Field({ field, children, as = 'div', hideLabel, hideDescription }: FieldUIProps) {
  const Root = as;
  const label = field.label && !hideLabel && (
    <>
      <span className="tm-q" aria-hidden="true">
        ?{' '}
      </span>
      {field.label}
      {field.required && (
        <span className="tm-dim" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </>
  );
  return (
    <Root className="tm-field" data-invalid={field.invalid || undefined}>
      {label &&
        (as === 'fieldset' ? (
          <legend className="tm-label">{label}</legend>
        ) : (
          <label className="tm-label" htmlFor={field.id}>
            {label}
          </label>
        ))}
      {field.description && !hideDescription && (
        <p className="tm-help" id={field.descriptionId}>
          {field.description}
        </p>
      )}
      {children}
      {field.error && (
        <p className="tm-error" id={field.errorId}>
          <span aria-hidden="true">✖ </span>
          {field.error}
        </p>
      )}
    </Root>
  );
}

function TextInput({ field, value, onChange, unit, ...attrs }: TextInputUIProps) {
  return (
    <div className="tm-line">
      <span className="tm-caret" aria-hidden="true">
        ❯
      </span>
      <input
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="tm-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="tm-dim">{unit}</span>}
    </div>
  );
}

function Textarea({ field, value, onChange, maxLength, ...attrs }: TextareaUIProps) {
  return (
    <div className="tm-line tm-multiline">
      <span className="tm-caret" aria-hidden="true">
        ❯
      </span>
      <textarea
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="tm-input"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength !== undefined && (
        <span className="tm-count tm-dim" aria-hidden="true">
          [{[...value].length}/{maxLength}]
        </span>
      )}
    </div>
  );
}

function Select({ field, options, value, onChange, placeholder }: SelectUIProps) {
  return (
    <div className="tm-line">
      <span className="tm-caret" aria-hidden="true">
        ❯
      </span>
      <select
        {...field.controlProps}
        ref={field.ref}
        className="tm-input tm-select"
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
      <span className="tm-dim" aria-hidden="true">
        ▾
      </span>
    </div>
  );
}

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  return (
    <div className="tm-choices">
      {options.map((option, index) => {
        const on = selected.includes(option.value);
        return (
          <label key={option.value} className="tm-choice">
            <input
              ref={index === 0 ? field.ref : undefined}
              type={multiple ? 'checkbox' : 'radio'}
              name={field.name}
              value={option.value}
              checked={on}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            <span className="tm-mark" aria-hidden="true">
              {multiple ? (on ? '[x]' : '[ ]') : on ? '(•)' : '( )'}
            </span>
            <span>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Checkbox({ field, checked, onChange, children, markRequired }: CheckboxUIProps) {
  return (
    <label className="tm-choice tm-single">
      <input
        {...field.controlProps}
        ref={field.ref}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="tm-mark" aria-hidden="true">
        {checked ? '[x]' : '[ ]'}
      </span>
      <span>
        {children}
        {markRequired && (
          <span className="tm-dim" aria-hidden="true">
            {' '}
            *
          </span>
        )}
        {field.description && (
          <span className="tm-help" id={field.descriptionId}>
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
      <div className="tm-rating">
        {scores.map((score, index) => (
          <label key={score} className="tm-rating-item">
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
            <span>[{score}]</span>
          </label>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <p className="tm-help" aria-hidden="true">
          {scores[0]} = {lowLabel} · {scores.at(-1)} = {highLabel}
        </p>
      )}
    </div>
  );
}

const MONO =
  'ui-monospace, "SF Mono", "JetBrains Mono", "Cascadia Code", Menlo, Consolas, var(--of-cjk), monospace';

export default defineTheme({
  colorScheme: 'dark',
  font: MONO,
  headingFont: MONO,
  radius: '4px',
  spacing: 'comfortable',
  width: '640px',
  colors: {
    primary: '#5af78e',
    primaryForeground: '#04110a',
    background: '#050706',
    surface: '#0c0f0d',
    foreground: '#d9e4dc',
    muted: '#6f8076',
    border: '#1f2823',
    control: '#6f8076',
    input: '#0c0f0d',
    error: '#ff5c57',
    success: '#5af78e',
  },
  components: {
    Layout,
    Header,
    Progress,
    Button,
    Success,
    Notice,
    Field,
    TextInput,
    Textarea,
    Select,
    ChoiceGroup,
    Checkbox,
    Rating,
  },
});
