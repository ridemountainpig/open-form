import {
  type ChoiceGroupUIProps,
  defineTheme,
  type LayoutUIProps,
  type TextInputUIProps,
} from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './offsite.css';

// Offsite: the whole form is one bento board. A yellow hero tile holds the
// invitation, every question is a numbered tile of its own shape, and the last
// tile keeps score and sends.

const HINTS: Record<string, string> = {
  train: 'Fri 08:20',
  driving: 'parking needed',
  own: "I'll meet you there",
  hike: '4 hrs · moderate',
  surf: '2 hrs · beginners',
  cook: '3 hrs · indoors',
  nothing: 'all day · recommended',
};

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  return (
    <div className="bn-opts">
      {options.map((option, index) => (
        <label key={option.value} className="bn-opt">
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
          <span className="bn-opt-label">{option.label}</span>
          {HINTS[option.value] && <small>{HINTS[option.value]}</small>}
          <i aria-hidden="true" />
        </label>
      ))}
    </div>
  );
}

function TextInput({ field, type, value, onChange, unit: _unit, ...attrs }: TextInputUIProps) {
  const input = (
    <input
      {...field.controlProps}
      {...attrs}
      ref={field.ref}
      className="of-input"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (type !== 'number') return input;
  const min = typeof attrs.min === 'number' ? attrs.min : Number.NEGATIVE_INFINITY;
  const max = typeof attrs.max === 'number' ? attrs.max : Number.POSITIVE_INFINITY;
  const bump = (by: number) => {
    onChange(String(Math.min(max, Math.max(min, (Number(value) || 0) + by))));
  };
  return (
    <div className="bn-stepper">
      <button type="button" aria-label="−1" onClick={() => bump(-1)}>
        −
      </button>
      {input}
      <button type="button" aria-label="+1" onClick={() => bump(1)}>
        +
      </button>
    </div>
  );
}

function Layout({ state, banner, header, intro, content, alert, actions, aside }: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="bn-page" data-state={state}>
      {banner}
      <div className="bn-grid">
        <div className="bn-tile bn-hero">
          <i className="bn-sun" aria-hidden="true" />
          <span className="bn-brand" aria-hidden="true">
            Kumo Labs · Team offsite
          </span>
          {inForm ? (
            <>
              {header}
              <p className="bn-how" aria-hidden="true">
                <span>
                  <b>1</b>
                  <b>2</b>
                  <b>3</b>
                </span>
                Eight quick boxes, in order. About a minute.
              </p>
            </>
          ) : (
            <div
              className={state === 'success' ? 'bn-end of-success' : 'bn-end of-notice'}
              role="status"
            >
              {content}
            </div>
          )}
        </div>
        {inForm && (
          <>
            {intro}
            {content}
            <div className="bn-tile bn-go">
              {aside}
              {alert}
              {actions}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const FONT =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif';

export default defineTheme({
  font: FONT,
  headingFont: FONT,
  radius: '14px',
  buttonRadius: '999px',
  spacing: 'compact',
  width: '1600px',
  colors: {
    primary: '#15150f',
    primaryForeground: '#ffffff',
    background: '#ecebe6',
    surface: '#ffffff',
    foreground: '#15150f',
    muted: '#66655c',
    border: '#d9d7ce',
    control: '#8d8b80',
    input: '#f3f2ed',
    error: '#b3261e',
    success: '#1a7f45',
  },
  dark: {
    primary: '#f3f2ea',
    primaryForeground: '#0c0c0a',
    background: '#0c0c0a',
    surface: '#191916',
    foreground: '#f3f2ea',
    muted: '#a09f94',
    border: '#2c2c27',
    control: '#75746a',
    input: '#22221e',
    error: '#ff9a8a',
    success: '#7fd3a3',
  },
  components: { Layout, ChoiceGroup, TextInput },
});
