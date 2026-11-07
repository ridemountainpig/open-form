import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/noto-sans-tc.css';
import './fonts/quicksand.css';
import './careers.css';

// The careers page of the company site: a red bar with the wordmark, a gray
// title band, a breadcrumb, then the questions on a white sheet beside a
// numbered step rail.

function Wordmark() {
  return (
    <span className="mp-wordmark" role="img" aria-label="Microprogram 微程式">
      <span aria-hidden="true">micro</span>
      <span aria-hidden="true">program</span>
    </span>
  );
}

function Layout({
  state,
  nav,
  banner,
  header,
  title,
  progress,
  intro,
  content,
  alert,
  actions,
  aside,
}: LayoutUIProps) {
  const steps = state === 'form' && nav.total > 1;
  return (
    <div className="mp-site" data-state={state}>
      <div className="mp-bar">
        <div className="mp-bar-inner">
          <Wordmark />
          <span className="mp-bar-nav">人才招募</span>
        </div>
      </div>
      <div className="mp-band">
        <div className="mp-band-inner">
          {state === 'form' ? header : <p className="mp-band-title">{title}</p>}
        </div>
      </div>
      <p className="mp-crumb">
        <span>Home</span>
        <span aria-hidden="true">›</span>
        <span>人才招募</span>
        <span aria-hidden="true">›</span>
        <span className="mp-crumb-here">線上應徵</span>
      </p>
      <div className={steps ? 'mp-main' : 'mp-main mp-main-single'}>
        {steps && (
          <nav className="mp-rail" aria-label="應徵步驟">
            <ol>
              {nav.steps.map((step) => (
                <li key={step.index} data-state={step.state}>
                  <button
                    type="button"
                    disabled={!step.reachable || step.state === 'current'}
                    aria-current={step.state === 'current' ? 'step' : undefined}
                    onClick={() => nav.goTo(step.position)}
                  >
                    <span className="mp-rail-dot" aria-hidden="true">
                      {step.position + 1}
                    </span>
                    <span>{step.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <section
          className={
            state === 'success'
              ? 'mp-sheet of-success'
              : state === 'unavailable'
                ? 'mp-sheet of-notice'
                : 'mp-sheet'
          }
          role={state === 'form' ? undefined : 'status'}
        >
          {banner}
          {steps && <div className="mp-phone-progress">{progress}</div>}
          {intro}
          {content}
          {alert}
          {actions}
        </section>
        {aside && <aside className="mp-aside">{aside}</aside>}
      </div>
      <footer className="mp-foot">
        <p className="mp-foot-slogan" lang="en">
          MAKING IT BETTER TOGETHER.
        </p>
        <p>微程式資訊股份有限公司</p>
      </footer>
    </div>
  );
}

export default defineTheme({
  font: '"Noto Sans TC", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont:
    '"Quicksand", "Noto Sans TC", ui-sans-serif, system-ui, -apple-system, var(--of-cjk), sans-serif',
  radius: '6px',
  buttonRadius: '999px',
  spacing: 'comfortable',
  width: '1180px',
  colors: {
    primary: '#e2231a',
    primaryForeground: '#ffffff',
    background: '#f2f2f2',
    surface: '#ffffff',
    foreground: '#333333',
    muted: '#666666',
    border: '#dedede',
    control: '#8c8c8c',
    input: '#ffffff',
    error: '#b3261e',
    success: '#2e7d4f',
  },
  dark: {
    primary: '#ff5a50',
    primaryForeground: '#1a0503',
    background: '#1b1b1b',
    surface: '#262626',
    foreground: '#eeeeee',
    muted: '#ababab',
    border: '#3a3a3a',
    control: '#808080',
    input: '#1f1f1f',
    error: '#ff8a80',
    success: '#6fcf97',
  },
  components: { Layout },
});
