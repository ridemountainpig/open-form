import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/archivo.css';
import './poster.css';

// Poster: a Swiss poster. Paper, black and one red; a headline set as large as
// the page allows, heavy rules, and answers in boxes that fill solid when
// picked. Everything is CSS on the runtime's markup except the Layout, which
// splits the sheet into the headline column and the questions. See THEME.md.

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
    <div className="ps-sheet" data-state={state}>
      <div className="ps-head">
        <p className="ps-strip" aria-hidden="true">
          <span>Form</span>
          {inForm && nav.total > 1 && (
            <span>
              {String(nav.position + 1).padStart(2, '0')}/{String(nav.total).padStart(2, '0')}
            </span>
          )}
          <i />
        </p>
        {inForm && header}
        {inForm && aside}
      </div>
      <div
        className={
          state === 'success' ? 'ps-body of-success' : inForm ? 'ps-body' : 'ps-body of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {banner}
        {intro}
        {content}
        {alert}
        {actions}
      </div>
    </div>
  );
}

const FONT =
  '"Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif';

export default defineTheme({
  font: FONT,
  headingFont: FONT,
  radius: '0px',
  spacing: 'comfortable',
  width: '1320px',
  colorScheme: 'light',
  colors: {
    primary: '#d81e05',
    primaryForeground: '#ffffff',
    background: '#f1eee6',
    surface: '#f1eee6',
    foreground: '#0d0d0d',
    muted: '#55524a',
    border: '#0d0d0d',
    control: '#0d0d0d',
    input: '#f1eee6',
    error: '#b01500',
    success: '#0d0d0d',
  },
  components: { Layout },
});
