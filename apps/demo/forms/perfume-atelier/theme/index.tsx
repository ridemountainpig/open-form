import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import { useBlend } from '../blend.tsx';
import { Scene } from './scene.tsx';
import './perfume.css';

// A perfumer's order sheet beside a tank of water (scene.tsx): every note you
// pick drops into it as ink, top notes near the surface and base notes at the
// bottom. Quiet serif type, hairlines, and the tank as the only colour.

function Tank({ done }: { done: boolean }) {
  const blend = useBlend();
  return (
    <section className="pa-tank">
      <Scene blend={blend} done={done} />
      <p className="pa-mark">Sillage Atelier</p>
      <ol className="pa-layers" aria-hidden="true">
        {['Top', 'Heart', 'Base'].map((layer, i) => (
          <li key={layer} data-layer={i}>
            <span>{layer}</span>
            <b>{blend.names[i] ?? '—'}</b>
          </li>
        ))}
      </ol>
      <div className="pa-label" aria-live="polite">
        <p className="pa-label-no">{done ? 'Blended for you' : 'No. 001 · in progress'}</p>
        <p className="pa-label-name">{blend.engraving || 'Untitled'}</p>
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
    <div className="pa-page" data-state={state}>
      <Tank done={done} />
      <section
        className={
          done ? 'pa-sheet of-success' : state === 'form' ? 'pa-sheet' : 'pa-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' ? header : <p className="pa-name">{title}</p>}
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
  headingFont:
    '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  radius: '2px',
  buttonRadius: '999px',
  width: '480px',
  colors: {
    primary: '#1d1b19',
    primaryForeground: '#faf8f4',
    background: '#f6f4ef',
    surface: '#fbfaf7',
    foreground: '#1d1b19',
    muted: '#6b665e',
    border: '#e3dfd6',
    control: '#8f897f',
    input: '#ffffff',
    error: '#a8261d',
    success: '#2c6e49',
  },
  dark: {
    primary: '#efe9df',
    primaryForeground: '#141312',
    background: '#0e0f12',
    surface: '#131417',
    foreground: '#efe9df',
    muted: '#a49d92',
    border: '#2a2a2e',
    control: '#75716b',
    input: '#18191c',
    error: '#ff8f80',
    success: '#7fcf9e',
  },
  components: { Layout },
});
