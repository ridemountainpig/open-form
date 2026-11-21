import {
  defineTheme,
  type HeaderUIProps,
  type ProgressUIProps,
  type SuccessUIProps,
  type TextareaUIProps,
  type TextInputUIProps,
} from '@open-form-build/core';
import './brutalist.css';

// Brutalist: neo-brutalism — loud yellow, thick black borders, hard offset
// shadows, heavy uppercase type, blocks you can feel pressing. See THEME.md.
// Labels, help, errors, the select, the choice tiles, the checkbox, the rating
// strip, the matrix and the buttons are the runtime's own markup, restyled in
// brutalist.css. The components below exist for markup it doesn't have: the
// marker behind the title, a block per step, the sticker and the input wrappers.

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

function Success({ title, children }: SuccessUIProps) {
  return (
    <div className="br-success">
      <div className="br-sticker">{title}</div>
      <div className="br-success-body">{children}</div>
    </div>
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
  components: { Header, Progress, Success, TextInput, Textarea },
});
