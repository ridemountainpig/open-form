import {
  type ChoiceGroupUIProps,
  defineTheme,
  type LayoutUIProps,
  useFormNav,
} from '@open-form-build/core';
import { useRef } from 'react';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './chat.css';

// Chat: the form is a conversation. Each question is a message bubble, choices
// are quick-reply chips (on a one-question step they send themselves), and the
// form's `aside` sits above the current question, for a transcript of earlier
// answers. See THEME.md.

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  const nav = useFormNav();
  const latest = useRef(nav);
  latest.current = nav;
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} className="pn-chips">
      {options.map((option, index) => (
        <label key={option.value} className="pn-chip">
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            onBlur={field.onBlur}
            onChange={(e) => {
              onToggle(option.value, e.target.checked);
              if (multiple || !e.target.checked) return;
              if (ref.current?.closest('.of-step')?.querySelectorAll('.of-field').length !== 1)
                return;
              setTimeout(() => {
                if (!latest.current.isLast) void latest.current.next();
              }, 320);
            }}
          />
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

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
    <div className="pn-page" data-state={state}>
      <div className="pn-side">
        <span className="pn-logo" aria-hidden="true">
          <i />
        </span>
        {inForm && header}
      </div>
      <div className="pn-chat">
        <div className="pn-bar">
          <span className="pn-avatar" aria-hidden="true">
            A
          </span>
          <span className="pn-who" aria-hidden="true">
            <b>Assistant</b>
            <span>Online</span>
          </span>
          {inForm && nav.total > 1 && (
            <span
              className="pn-pips"
              role="img"
              aria-label={`Message ${nav.position + 1} of ${nav.total}`}
            >
              {nav.steps.map((step) => (
                <i key={step.index} data-state={step.state} />
              ))}
            </span>
          )}
        </div>
        <div className="pn-thread">
          {banner}
          {inForm && aside}
          {intro}
          <div
            className={
              state === 'success' ? 'pn-now of-success' : inForm ? 'pn-now' : 'pn-now of-notice'
            }
            role={inForm ? undefined : 'status'}
          >
            {content}
            {alert}
          </div>
        </div>
        {inForm && actions}
      </div>
    </div>
  );
}

const FONT =
  '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif';

export default defineTheme({
  font: FONT,
  headingFont: FONT,
  radius: '18px',
  buttonRadius: '999px',
  spacing: 'comfortable',
  width: '640px',
  colors: {
    primary: '#c8401a',
    primaryForeground: '#ffffff',
    background: '#f2efe9',
    surface: '#ffffff',
    foreground: '#1d2a22',
    muted: '#5d6a61',
    border: '#d9d3c6',
    control: '#8b9288',
    input: '#ffffff',
    error: '#b3261e',
    success: '#1f6b45',
  },
  dark: {
    primary: '#ff7a4d',
    primaryForeground: '#1a0e08',
    background: '#141a16',
    surface: '#1e2621',
    foreground: '#eef1ea',
    muted: '#a3ada4',
    border: '#344038',
    control: '#6f7b72',
    input: '#1e2621',
    error: '#ff9a8a',
    success: '#7fd3a3',
  },
  components: { Layout, ChoiceGroup },
});
