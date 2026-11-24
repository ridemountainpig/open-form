import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import { useState } from 'react';
import './fonts/ibm-plex-mono.css';
import './fonts/vt323.css';
import './tinbox.css';

// Tinbox: the form is a curl command on the amber screen of a beige desktop
// computer. The Layout draws the machine; the PHOSPHOR knob on its chin switches
// the tube between amber and green. Fields are the runtime's markup, laid out
// as `"key": value` lines in tinbox.css.

const ROWS = [
  ['esc', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'delete'],
  ['tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'],
  ['caps', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", 'enter ⏎'],
];

function Layout({ state, nav, banner, header, intro, content, alert, actions }: LayoutUIProps) {
  const [green, setGreen] = useState(false);
  const inForm = state === 'form';
  return (
    <div className="tb-scene" data-phosphor={green ? 'green' : 'amber'}>
      <div className="tb-disk" aria-hidden="true">
        <span>
          TINBOX BETA
          <br />
          KEY DISK 01
          <br />
          do not bend
        </span>
      </div>
      <p className="tb-note" aria-hidden="true">
        Be nice in the note field :)
      </p>
      <div className="tb-monitor">
        <div className="tb-bezel">
          <div
            className={
              state === 'success'
                ? 'tb-screen of-success'
                : inForm
                  ? 'tb-screen'
                  : 'tb-screen of-notice'
            }
            role={inForm ? undefined : 'status'}
          >
            {banner}
            {inForm && (
              <div className="tb-head">
                {header}
                <p className="tb-open">
                  <i />
                  open
                </p>
              </div>
            )}
            {inForm && (
              <p className="tb-curl" aria-hidden="true">
                <span>{'// request an API key. edit the values, then hit enter.'}</span>
                <b>$ curl -X POST https://api.tinbox.dev/v1/beta -d {"'{"}</b>
              </p>
            )}
            {intro}
            {content}
            {inForm && (
              <p className="tb-curl" aria-hidden="true">
                {"}'"}
              </p>
            )}
            {alert}
            {actions}
            {inForm && (
              <p className="tb-statusbar" aria-hidden="true">
                <span>TAB next field</span>
                <span>SPACE toggle</span>
                <span>⏎ send</span>
                <b>{nav.submitting ? 'sending…' : 'ready'}</b>
              </p>
            )}
          </div>
        </div>
        <div className="tb-chin">
          <span className="tb-badge" aria-hidden="true">
            <i />
            tinbox
          </span>
          <span className="tb-slot" aria-hidden="true" />
          <span className="tb-grille" aria-hidden="true" />
          <button
            type="button"
            className="tb-knob"
            aria-pressed={green}
            aria-label="Phosphor: amber or green"
            onClick={() => setGreen((on) => !on)}
          >
            <span aria-hidden="true">PHOSPHOR</span>
            <i />
          </button>
          <span className="tb-power" aria-hidden="true">
            POWER
            <i />
          </span>
        </div>
      </div>
      <div className="tb-neck" aria-hidden="true" />
      <div className="tb-keyboard" aria-hidden="true">
        {ROWS.map((row) => (
          <div key={row[0]}>
            {row.map((key) => (
              <span key={key} data-key={key.length > 1 ? key.split(' ')[0] : undefined}>
                {key}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const MONO = '"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace';

export default defineTheme({
  font: MONO,
  headingFont: '"VT323", ui-monospace, "SF Mono", Menlo, Consolas, var(--of-cjk), monospace',
  radius: '3px',
  spacing: 'compact',
  width: '980px',
  colorScheme: 'dark',
  colors: {
    primary: '#ff7a50',
    primaryForeground: '#1a1108',
    background: '#120e0a',
    surface: '#17100a',
    foreground: '#ffc97a',
    muted: '#c2955a',
    border: '#b58a52',
    control: '#b58a52',
    input: '#17100a',
    error: '#ff8f7a',
    success: '#6fe08e',
  },
  components: { Layout },
});
