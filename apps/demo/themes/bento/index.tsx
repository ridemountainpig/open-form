import { defineTheme, type LayoutUIProps, type TextInputUIProps } from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './bento.css';

// Bento: the form is a board of tiles. A yellow hero tile holds the title, every
// question is a numbered tile sized by what it asks, and a dark tile at the end
// holds the form's `aside` and the button. Tiles, numbers and chips are CSS on
// the runtime's markup; the Layout draws the board and a number field becomes a
// stepper. See THEME.md.

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
    <div className="bn-page" data-state={state}>
      {banner}
      <div className="bn-grid">
        <div className="bn-tile bn-hero">
          <i className="bn-sun" aria-hidden="true" />
          {inForm ? (
            header
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
          <div className="bn-board">
            {intro}
            {content}
            <div className="bn-tile bn-go">
              {aside}
              {nav.total > 1 && (
                <span className="bn-count">
                  {nav.position + 1} of {nav.total}
                </span>
              )}
              {alert}
              {actions}
            </div>
          </div>
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
  components: { Layout, TextInput },
});
