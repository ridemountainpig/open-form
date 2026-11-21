import {
  type ChoiceGroupUIProps,
  defineTheme,
  type LayoutUIProps,
  ScreenHeadingContext,
  type TextInputUIProps,
} from '@open-form-build/core';
import './fonts/geist-mono.css';
import './fonts/instrument-sans.css';
import './fonts/instrument-serif.css';
import './editorial.css';

// Editorial: a letterpress enquiry sheet. A dark panel holds the masthead, the
// headline and the form's `aside`; the questions are numbered rows on paper.
// Card choices are a ruled strip, list choices pills, and a number field is a
// stepper. See THEME.md.

function ChoiceGroup({
  field,
  options,
  multiple,
  selected,
  onToggle,
  variant,
}: ChoiceGroupUIProps) {
  const cards = variant === 'cards';
  return (
    <div className={cards ? 'hd-pieces' : 'hd-swatches'}>
      {options.map((option, index) => {
        return (
          <label key={option.value} className={cards ? 'hd-piece' : 'hd-swatch'}>
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
            {cards ? (
              <>
                <i className="hd-dot" aria-hidden="true" />
                <b>{option.label}</b>
              </>
            ) : (
              <>
                <i className="hd-grain" aria-hidden="true" />
                {option.label}
              </>
            )}
          </label>
        );
      })}
    </div>
  );
}

function TextInput({ field, type, value, onChange, unit, ...attrs }: TextInputUIProps) {
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
  if (type !== 'number') return input;
  const min = typeof attrs.min === 'number' ? attrs.min : Number.NEGATIVE_INFINITY;
  const max = typeof attrs.max === 'number' ? attrs.max : Number.POSITIVE_INFINITY;
  const bump = (by: number) => {
    const next = Math.min(max, Math.max(min, (Number(value) || 0) + by));
    onChange(String(next));
  };
  return (
    <div className="hd-stepper">
      <button type="button" aria-label="−1" onClick={() => bump(-1)}>
        −
      </button>
      {input}
      <button type="button" aria-label="+1" onClick={() => bump(1)}>
        +
      </button>
      {unit && <span className="hd-unit">{unit}</span>}
    </div>
  );
}

function Layout({
  state,
  nav,
  banner,
  header,
  intro,
  content,
  alert,
  actions,
  aside,
}: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="hd-page" data-state={state}>
      <section className="hd-brand">
        <p className="hd-mast" aria-hidden="true">
          <span className="hd-word">
            Atelier<i>.</i>
          </span>
          <span>Est. 2009</span>
        </p>
        {header}
        {aside}
      </section>
      <section
        className={
          state === 'success' ? 'hd-form of-success' : inForm ? 'hd-form' : 'hd-form of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {inForm && (
          <p className="hd-form-head">
            <span>{nav.stepTitle}</span>
            {nav.total > 1 && (
              <span>
                {nav.position + 1} / {nav.total}
              </span>
            )}
          </p>
        )}
        {banner}
        {intro}
        <ScreenHeadingContext.Provider value="h2">{content}</ScreenHeadingContext.Provider>
        {alert}
        {actions}
      </section>
    </div>
  );
}

const SERIF = '"Instrument Serif", ui-serif, Georgia, var(--of-cjk-serif), serif';

export default defineTheme({
  font: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: SERIF,
  radius: '0px',
  spacing: 'spacious',
  width: '860px',
  colors: {
    primary: '#c63a18',
    primaryForeground: '#fff8f0',
    background: '#f7f3ea',
    surface: '#f7f3ea',
    foreground: '#171512',
    muted: '#6b6256',
    border: '#cfc6b4',
    control: '#857c6c',
    input: '#f7f3ea',
    error: '#a8200d',
    success: '#3f6b3a',
  },
  dark: {
    primary: '#ff6a43',
    primaryForeground: '#1b0d07',
    background: '#12110f',
    surface: '#12110f',
    foreground: '#efe8da',
    muted: '#9a9080',
    border: '#34302a',
    control: '#7d7466',
    input: '#12110f',
    error: '#ff9a85',
    success: '#9cc795',
  },
  components: { Layout, ChoiceGroup, TextInput },
});
