import {
  defineTheme,
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
// Prompts, help, errors, choices, the checkbox, the matrix and the buttons are the
// runtime's own markup, their glyphs drawn in terminal.css. The components below
// exist for markup or text it doesn't have: the window, the command line, the
// ASCII bar, the result screens, the `❯` before each input and the rating's
// scale line.

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
    Success,
    Notice,
    TextInput,
    Textarea,
    Select,
    Rating,
  },
});
