import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/doto.css';
import './fonts/jetbrains-mono.css';
import './commit-night.css';

// Commit Night: a terminal UI in a window. Bordered panes with legends, a steps
// list, a status bar, prompts with a `?` that turns into a tick, `[x]` boxes and
// segmented keys. Everything but the Layout is CSS over the runtime's markup.

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
    <div className="cn-window" data-state={state}>
      <div className="cn-titlebar" aria-hidden="true">
        <i />
        <i />
        <i />
        <span>guest@taipei — commit-night register</span>
      </div>
      <div className="cn-head">
        <div>
          <p className="cn-prompt" aria-hidden="true">
            $ npx commit-night register
          </p>
          {inForm ? header : <p className="cn-wordmark">COMMIT NIGHT v12</p>}
        </div>
        <dl className="cn-meta">
          <div>
            <dt>when</dt>
            <dd>Fri, Jan 15 2027 · 19:00–22:00</dd>
          </div>
          <div>
            <dt>where</dt>
            <dd>Huashan 1914, Taipei</dd>
          </div>
        </dl>
      </div>
      <div className="cn-grid">
        {inForm && nav.total > 1 && (
          <nav className="cn-pane cn-steps" aria-label="Steps">
            <span className="cn-legend">STEPS</span>
            <ol>
              {nav.steps.map((step) => (
                <li key={step.index} data-state={step.state}>
                  <button
                    type="button"
                    disabled={!step.reachable || step.state === 'current'}
                    aria-current={step.state === 'current' ? 'step' : undefined}
                    onClick={() => nav.goTo(step.position)}
                  >
                    <span aria-hidden="true">
                      {step.state === 'done' ? '✓' : step.state === 'current' ? '▸' : '·'}
                    </span>
                    <span>{String(step.position + 1).padStart(2, '0')}</span>
                    <span className="cn-step-name">{step.title}</span>
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
        <div
          className={
            state === 'success'
              ? 'cn-pane cn-main of-success'
              : inForm
                ? 'cn-pane cn-main'
                : 'cn-pane cn-main of-notice'
          }
          role={inForm ? undefined : 'status'}
        >
          {inForm && (
            <>
              <span className="cn-legend">
                {String(nav.position + 1).padStart(2, '0')} · {(nav.stepTitle ?? '').toUpperCase()}
              </span>
              <span className="cn-legend cn-legend-end">
                {nav.position + 1}/{nav.total}
              </span>
            </>
          )}
          {banner}
          {intro}
          {content}
          {alert}
          {actions}
        </div>
        {aside}
      </div>
      <div className="cn-status" aria-hidden="true">
        <b>{inForm ? 'REGISTER' : 'DONE'}</b>
        {inForm && (
          <span>
            step {nav.position + 1}/{nav.total}
          </span>
        )}
        <span className="cn-path">~/commit-night/v12</span>
        <span className="cn-keys">
          <kbd>tab</kbd> move <kbd>space</kbd> toggle <kbd>⏎</kbd> next
        </span>
        <b className="cn-free">free entry</b>
      </div>
    </div>
  );
}

const MONO = '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace';

export default defineTheme({
  font: MONO,
  headingFont: MONO,
  radius: '3px',
  spacing: 'compact',
  width: '1372px',
  colorScheme: 'dark',
  colors: {
    primary: '#a6e36e',
    primaryForeground: '#0c1407',
    background: '#06080b',
    surface: '#0c0f15',
    foreground: '#cdd5e3',
    muted: '#8792a8',
    border: '#262d3b',
    control: '#657087',
    input: '#0c0f15',
    error: '#ff8b8b',
    success: '#a6e36e',
  },
  components: { Layout },
});
