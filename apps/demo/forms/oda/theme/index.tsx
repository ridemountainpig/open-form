import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './fonts/instrument-serif.css';
import './oda.css';

// Oda: the form is one sentence. The page is a letter in large serif type with
// the blanks set inline; the foot holds the progress pips and the send button.

function Layout({ state, banner, header, intro, content, alert, actions, aside }: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="od-page" data-state={state}>
      <div className="od-top">
        <span className="od-logo" aria-hidden="true">
          Oda <i>Studio</i>
        </span>
        {inForm && header}
      </div>
      <div
        className={
          state === 'success' ? 'od-main of-success' : inForm ? 'od-main' : 'od-main of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {banner}
        {intro}
        {content}
        {alert}
      </div>
      {inForm && (
        <div className="od-foot">
          {aside}
          {actions}
        </div>
      )}
    </div>
  );
}

const SERIF = '"Instrument Serif", ui-serif, Georgia, var(--of-cjk-serif), serif';

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: SERIF,
  radius: '14px',
  buttonRadius: '999px',
  spacing: 'spacious',
  width: '1080px',
  colors: {
    primary: '#5a35f0',
    primaryForeground: '#ffffff',
    background: '#efeaff',
    surface: '#ffffff',
    foreground: '#1a1433',
    muted: '#5f5884',
    border: '#cfc6f2',
    control: '#8679c4',
    input: '#ffffff',
    error: '#b3261e',
    success: '#5a35f0',
  },
  dark: {
    primary: '#a892ff',
    primaryForeground: '#0f0b1f',
    background: '#0f0b1f',
    surface: '#181233',
    foreground: '#efeaff',
    muted: '#9a93bd',
    border: '#33295f',
    control: '#6f63a8',
    input: '#181233',
    error: '#ff9a9a',
    success: '#a892ff',
  },
  components: { Layout },
});
