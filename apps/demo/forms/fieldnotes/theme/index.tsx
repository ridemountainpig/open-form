import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/geist.css';
import './fieldnotes.css';

// Fieldnotes: a page in a notes app. A soft gradient cover, a page icon that
// overlaps it, then the questions as plain blocks down one column.

function Doc({ state, banner, header, intro, content, alert, actions }: LayoutUIProps) {
  return (
    <div className="fn-page" data-state={state}>
      <div className="fn-cover" aria-hidden="true" />
      <div
        className={
          state === 'success'
            ? 'fn-doc of-success'
            : state === 'form'
              ? 'fn-doc'
              : 'fn-doc of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        <div className="fn-icon" aria-hidden="true">
          <svg aria-hidden="true" viewBox="0 0 44 44" width="44" height="44" fill="none">
            <path
              d="M10 6h18l6 6v26H10zM16 18h12M16 24h12M16 30h7"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        {banner}
        {state === 'form' && header}
        {intro}
        {content}
        {alert}
        {actions}
        {state === 'form' && <p className="fn-foot">Plain text, yours to keep.</p>}
      </div>
    </div>
  );
}

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '8px',
  spacing: 'spacious',
  width: '700px',
  colors: {
    primary: '#1f6fc4',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    surface: '#ffffff',
    foreground: '#1d1d1f',
    muted: '#6b6a67',
    border: '#e9e9e7',
    control: '#8d8c88',
    input: '#ffffff',
    error: '#c9302c',
    success: '#1f8a4c',
  },
  dark: {
    primary: '#6cb2f7',
    primaryForeground: '#0d1722',
    background: '#191919',
    surface: '#191919',
    foreground: '#ececec',
    muted: '#a3a29f',
    border: '#2f2f2f',
    control: '#7d7c79',
    input: '#191919',
    error: '#ff8480',
    success: '#57c98a',
  },
  components: { Layout: Doc },
});
