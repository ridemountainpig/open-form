import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './minimal.css';

// Minimal: black on white, one narrow column, nothing decorative. The mark in the
// corner is the only chrome, so the layout is a component; everything else is CSS
// on the runtime's markup. See THEME.md.

function Sheet({ state, banner, header, intro, content, alert, actions }: LayoutUIProps) {
  return (
    <div className="pc-page" data-state={state}>
      <div className="pc-bar">
        <span className="pc-mark" aria-hidden="true">
          <i />
        </span>
      </div>
      <div
        className={
          state === 'success'
            ? 'pc-sheet of-success'
            : state === 'form'
              ? 'pc-sheet'
              : 'pc-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' && header}
        {intro}
        {content}
        {alert}
        {actions}
      </div>
    </div>
  );
}

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '12px',
  buttonRadius: '999px',
  spacing: 'spacious',
  width: '520px',
  colors: {
    primary: '#111111',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    surface: '#ffffff',
    foreground: '#111111',
    muted: '#6b6b6b',
    border: '#e8e8e8',
    control: '#8c8c8c',
    input: '#ffffff',
    error: '#c4281c',
    success: '#1a7f47',
  },
  dark: {
    primary: '#f2f2f2',
    primaryForeground: '#0c0c0c',
    background: '#0c0c0c',
    surface: '#0c0c0c',
    foreground: '#f2f2f2',
    muted: '#9a9a9a',
    border: '#232323',
    control: '#737373',
    input: '#0c0c0c',
    error: '#ff7b6e',
    success: '#4cc38a',
  },
  components: { Layout: Sheet },
});
