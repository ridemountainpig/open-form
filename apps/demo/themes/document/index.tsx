import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './fonts/inter.css';
import './document.css';

// Document: a form that reads like a page in a notes app. A doodled cover, an icon
// overlapping it, then plain blocks in one column. The cover needs markup, so the
// layout is a component; lettered choices and the star rating are CSS. See THEME.md.

function Cover() {
  return (
    <div className="rl-cover" aria-hidden="true">
      <svg aria-hidden="true" viewBox="0 0 1440 190" preserveAspectRatio="xMidYMid slice">
        <path d="M90 120c30-50 70-60 90-20s60 30 80-10 50-40 70 0" />
        <path d="M380 60l14 30 32 4-24 22 6 32-28-16-28 16 6-32-24-22 32-4z" />
        <circle cx="560" cy="110" r="34" />
        <path d="M546 104v2M574 104v2M544 120c10 12 22 12 32 0" />
        <path d="M700 150c20-70 60-90 100-60M800 90l-4-28M800 90l-28 2" />
        <path d="M900 70c10-14 28-14 36 0 8-14 26-14 36 0 10 16-10 38-36 54-26-16-46-38-36-54z" />
        <path d="M1080 130c20-30 40-30 60 0s40 30 60 0 40-30 60 0" />
      </svg>
    </div>
  );
}

function Page({ state, banner, header, intro, content, alert, actions }: LayoutUIProps) {
  return (
    <div className="rl-page" data-state={state}>
      <Cover />
      <div
        className={
          state === 'success'
            ? 'rl-doc of-success'
            : state === 'form'
              ? 'rl-doc'
              : 'rl-doc of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        <div className="rl-icon" aria-hidden="true">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="38" height="38" fill="none">
            <path
              d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.300 1 2.200h5.200c0-.900.400-1.700 1-2.200A6 6 0 0 0 12 3z"
              stroke="currentColor"
              strokeWidth="1.700"
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
      </div>
    </div>
  );
}

export default defineTheme({
  font: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '8px',
  spacing: 'spacious',
  width: '660px',
  colors: {
    primary: '#2563d9',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    surface: '#ffffff',
    foreground: '#37352f',
    muted: '#6f6d66',
    border: '#e4e3df',
    control: '#8f8d86',
    input: '#ffffff',
    error: '#d1373d',
    success: '#1f8a4c',
  },
  dark: {
    primary: '#7aa7ff',
    primaryForeground: '#0f1420',
    background: '#191919',
    surface: '#191919',
    foreground: '#d6d5d1',
    muted: '#9b9993',
    border: '#373633',
    control: '#75736d',
    input: '#191919',
    error: '#ff7b80',
    success: '#57c98a',
  },
  components: { Layout: Page },
});
