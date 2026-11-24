import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
} from '@open-form-build/core';
import { isSession, SESSIONS, useRsvp } from '../ticket.tsx';
import { Scene } from './scene.tsx';
import './launch.css';

// A launch-event RSVP beside a dark studio stage (scene.tsx): chrome spheres,
// one per person coming and a small moon per session, under a slide-style
// caption that follows the answers. The sessions question is the programme.

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const { field, options, selected, onToggle } = props;
  if (field.name !== 'sessions') return <defaultComponents.ChoiceGroup {...props} />;
  return (
    <div className="lr-programme">
      {options.map((option, index) => {
        const session = isSession(option.value) ? SESSIONS[option.value] : undefined;
        return (
          <label key={option.value} className="lr-slot">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="checkbox"
              name={field.name}
              value={option.value}
              checked={selected.includes(option.value)}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            <span className="lr-slot-index" aria-hidden="true">
              {String(index + 1).padStart(2, '0')}
            </span>
            <span className="lr-slot-body">
              <span className="lr-slot-name">{session?.name ?? option.label}</span>
              {session && <span className="lr-slot-time">{session.time}</span>}
            </span>
            <span className="lr-slot-mark" aria-hidden="true" />
          </label>
        );
      })}
    </div>
  );
}

function Caption({ done }: { done: boolean }) {
  const rsvp = useRsvp();
  const last = rsvp.sessions.at(-1);
  const word = done ? 'See you' : last ? SESSIONS[last].word : 'Launch';
  const detail = rsvp.sessions.map((s) => SESSIONS[s].name).join('、');
  return (
    <div className="lr-caption" aria-live="polite">
      <p className="lr-eyebrow">
        {`${String(rsvp.people).padStart(2, '0')} / ${rsvp.guests ? `你和 ${rsvp.guests} 位同行` : '你一個人'}`}
      </p>
      <p className="lr-word" aria-hidden="true">
        {word}
      </p>
      <p className="lr-detail">{detail || '選場次，球會跟著多一顆小衛星。'}</p>
    </div>
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
  const rsvp = useRsvp();
  const done = state === 'success';
  return (
    <div className="lr-page" data-state={state}>
      <section className="lr-stage">
        <p className="lr-mark" aria-hidden="true">
          MONO <span>× 2027 Spring</span>
        </p>
        <Scene people={rsvp.people} sessions={rsvp.sessions.length} done={done} />
        {state === 'form' || done ? <Caption done={done} /> : null}
      </section>
      <section
        className={
          done ? 'lr-sheet of-success' : state === 'form' ? 'lr-sheet' : 'lr-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' ? header : <p className="lr-name">{title}</p>}
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
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '10px',
  buttonRadius: '999px',
  width: '500px',
  colors: {
    primary: '#111113',
    primaryForeground: '#ffffff',
    background: '#f4f4f5',
    surface: '#ffffff',
    foreground: '#111113',
    muted: '#5e5f66',
    border: '#e2e2e5',
    control: '#85868e',
    input: '#ffffff',
    error: '#b42318',
    success: '#1f7a4d',
  },
  dark: {
    primary: '#f4f4f5',
    primaryForeground: '#0b0b0c',
    background: '#0b0b0c',
    surface: '#121214',
    foreground: '#f4f4f5',
    muted: '#a1a2a9',
    border: '#26262b',
    control: '#6c6d75',
    input: '#18181b',
    error: '#ff8a7a',
    success: '#6fd39c',
  },
  components: { Layout, ChoiceGroup },
});
