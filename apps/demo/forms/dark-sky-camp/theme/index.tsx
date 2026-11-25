import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import { useCamp } from '../camp.tsx';
import { SITES, WEEKENDS } from '../sky.ts';
import { Scene } from './scene.tsx';
import './sky.css';

// A stargazing-camp booking beside the sky over the campsite (scene.tsx). The
// answers change the sky itself: the season, the horizon, a tent per person,
// and your star sign drawn in. Quiet type over a night-blue sheet.

function Sky({ done }: { done: boolean }) {
  const camp = useCamp();
  const weekend = camp.weekend && WEEKENDS[camp.weekend];
  return (
    <section className="ds-sky">
      <Scene camp={camp} done={done} />
      <p className="ds-mark">
        Dark Sky Camp <span>Bortle 1–3</span>
      </p>
      <div className="ds-caption" aria-live="polite">
        <p className="ds-eyebrow">
          {[weekend && `${weekend.name} · ${weekend.dates}`, camp.site && SITES[camp.site].name]
            .filter(Boolean)
            .join('  ·  ') || 'Pick a weekend and a site'}
        </p>
        <p className="ds-word">
          {done
            ? 'See you out there'
            : (camp.signName ?? (camp.weekend ? WEEKENDS[camp.weekend].name : 'Tonight'))}
        </p>
        <p className="ds-detail">
          {camp.group ? `${camp.group} ${camp.group === 1 ? 'tent' : 'tents'} lit` : ''}
          {camp.signName && !done ? ' · your sign, drawn in' : ''}
        </p>
      </div>
    </section>
  );
}

function Layout({
  state,
  banner,
  header,
  title,
  progress,
  intro,
  content,
  alert,
  actions,
}: LayoutUIProps) {
  const done = state === 'success';
  return (
    <div className="ds-page" data-state={state}>
      <Sky done={done} />
      <section
        className={
          done ? 'ds-sheet of-success' : state === 'form' ? 'ds-sheet' : 'ds-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' ? header : <p className="ds-name">{title}</p>}
        {progress}
        {intro}
        {content}
        {alert}
        {actions}
      </section>
    </div>
  );
}

export default defineTheme({
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  radius: '10px',
  buttonRadius: '999px',
  width: '480px',
  colors: {
    primary: '#25306b',
    primaryForeground: '#f4f5ff',
    background: '#f2f3f8',
    surface: '#fafbfe',
    foreground: '#141833',
    muted: '#5a5f7a',
    border: '#dfe1ec',
    control: '#8489a3',
    input: '#ffffff',
    error: '#b42318',
    success: '#1f7a4d',
  },
  dark: {
    primary: '#c9d2ff',
    primaryForeground: '#0b0e22',
    background: '#06070f',
    surface: '#0b0d18',
    foreground: '#e9ebf7',
    muted: '#9a9fbc',
    border: '#1f2236',
    control: '#6b7092',
    input: '#11142a',
    error: '#ff8a7a',
    success: '#6fd39c',
  },
  components: { Layout },
});
