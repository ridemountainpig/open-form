import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './fonts/source-serif-4.css';
import './northwind.css';

// Northwind: a careers page. A company bar, the role as a serif headline, the
// steps as tabs across the top of a white sheet, and the role's facts beside it.

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
    <div className="nw-page" data-state={state}>
      <div className="nw-bar">
        <div className="nw-bar-in">
          <span className="nw-logo" aria-hidden="true">
            <i />
            Northwind
          </span>
          <span className="nw-ref">Careers · REQ-2291</span>
        </div>
      </div>
      <div className="nw-wrap">
        <div className="nw-main">
          {inForm && (
            <div className="nw-role">
              {header}
              <ul className="nw-meta">
                <li>Taipei</li>
                <li>Hybrid, 2 days in office</li>
                <li>Full-time</li>
              </ul>
            </div>
          )}
          {inForm && nav.total > 1 && (
            <ol className="nw-steps">
              {nav.steps.map((step) => (
                <li key={step.index} data-state={step.state}>
                  <button
                    type="button"
                    disabled={!step.reachable || step.state === 'current'}
                    aria-current={step.state === 'current' ? 'step' : undefined}
                    onClick={() => nav.goTo(step.position)}
                  >
                    <i aria-hidden="true">{step.state === 'done' ? '✓' : step.position + 1}</i>
                    <span>{step.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          <div
            className={
              state === 'success'
                ? 'nw-sheet of-success'
                : inForm
                  ? 'nw-sheet'
                  : 'nw-sheet of-notice'
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
        {aside && <aside className="nw-side">{aside}</aside>}
      </div>
    </div>
  );
}

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: '"Source Serif 4", ui-serif, Georgia, var(--of-cjk-serif), serif',
  radius: '7px',
  spacing: 'comfortable',
  width: '1180px',
  colors: {
    primary: '#10233f',
    primaryForeground: '#ffffff',
    background: '#f5f4f0',
    surface: '#ffffff',
    foreground: '#10233f',
    muted: '#5d687e',
    border: '#e1dfd7',
    control: '#8a909c',
    input: '#ffffff',
    error: '#b3261e',
    success: '#1f7a4d',
  },
  dark: {
    primary: '#dbe6ff',
    primaryForeground: '#0a0f18',
    background: '#0a0f18',
    surface: '#101724',
    foreground: '#eef2f8',
    muted: '#8b96ab',
    border: '#222c3e',
    control: '#5f6b82',
    input: '#101724',
    error: '#ff8a7a',
    success: '#6fd3a0',
  },
  components: { Layout },
});
