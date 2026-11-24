import {
  type ChoiceGroupUIProps,
  defineTheme,
  FocusLayout,
  type LayoutUIProps,
  type RatingUIProps,
  useFormNav,
} from '@open-form-build/core';
import { useEffect, useRef } from 'react';
import './fonts/geist-mono.css';
import './fonts/instrument-sans.css';
import './fonts/instrument-serif.css';
import { Garden } from './garden.tsx';
import './fern.css';

// Fern: one question per screen beside a garden that grows with every answer.
// Choices carry letter keys and move on by themselves; the garden is garden.tsx.

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
    return true;
  }
  return (
    target.tagName === 'INPUT' && !['radio', 'checkbox'].includes((target as HTMLInputElement).type)
  );
}

// On a one-question step, picking a single answer moves on.
function useAutoAdvance() {
  const ref = useRef<HTMLDivElement>(null);
  const nav = useFormNav();
  const latest = useRef(nav);
  latest.current = nav;
  const advance = () => {
    const step = ref.current?.closest('.of-step');
    if (step?.querySelectorAll('.of-field').length !== 1) return;
    setTimeout(() => {
      if (!latest.current.isLast) void latest.current.next();
    }, 380);
  };
  return { ref, advance };
}

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  const { ref, advance } = useAutoAdvance();
  const latest = useRef({ selected, onToggle });
  latest.current = { selected, onToggle };

  const pick = (value: string, checked: boolean) => {
    latest.current.onToggle(value, checked);
    if (!multiple && checked) advance();
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelectorAll('[data-fe-keys]').length !== 1) return;
      const index = LETTERS.indexOf(event.key.toUpperCase());
      const option = index === -1 || event.key.length !== 1 ? undefined : options[index];
      if (!option) return;
      event.preventDefault();
      const on = multiple ? !latest.current.selected.includes(option.value) : true;
      pick(option.value, on);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div ref={ref} className="fe-choices" data-fe-keys="">
      {options.map((option, index) => (
        <label key={option.value} className="fe-choice">
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            aria-keyshortcuts={LETTERS[index]}
            onBlur={field.onBlur}
            onChange={(e) => pick(option.value, e.target.checked)}
          />
          <span className="fe-cap">
            <span className="fe-key" aria-hidden="true">
              {LETTERS[index]}
            </span>
            <span className="fe-choice-label">{option.label}</span>
            <span className="fe-check" aria-hidden="true">
              ✓
            </span>
          </span>
        </label>
      ))}
    </div>
  );
}

function Rating({ field, scores, value, onChange, lowLabel, highLabel }: RatingUIProps) {
  const { ref, advance } = useAutoAdvance();
  return (
    <div ref={ref}>
      <div className="fe-scale" data-many={scores.length > 7 || undefined}>
        {scores.map((score, index) => (
          <label key={score} className="fe-scale-item">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={score}
              checked={value === score}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={() => {
                onChange(score);
                advance();
              }}
            />
            <span>{score}</span>
          </label>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="fe-scale-ends" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function Layout(props: LayoutUIProps) {
  const { state, nav } = props;
  return (
    <div className="fe-page">
      <div className="fe-main">
        <div className="fe-logo" aria-hidden="true">
          <svg aria-hidden="true" viewBox="0 0 22 22" width="22" height="22" fill="none">
            <path
              d="M11 21V8M11 14c-5 0-7-3-7-7 4 0 7 2 7 7zM11 10c0-4 2-7 7-7 0 4-2 7-7 7z"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
          Fern
        </div>
        <FocusLayout {...props} />
      </div>
      <Garden
        stage={state === 'form' ? nav.position : nav.total}
        total={nav.total}
        done={state === 'success'}
      />
    </div>
  );
}

export default defineTheme({
  font: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '10px',
  spacing: 'comfortable',
  width: '600px',
  colors: {
    primary: '#1f5a3d',
    primaryForeground: '#ffffff',
    background: '#faf7f1',
    surface: '#faf7f1',
    foreground: '#1c2b22',
    muted: '#5f6c62',
    border: '#cfd6cc',
    control: '#7d8c80',
    input: '#f0ece2',
    error: '#b3261e',
    success: '#1f5a3d',
  },
  dark: {
    primary: '#8fd3a8',
    primaryForeground: '#0f1512',
    background: '#0f1512',
    surface: '#0f1512',
    foreground: '#eef3ee',
    muted: '#9aa89e',
    border: '#2c3a31',
    control: '#6f8075',
    input: '#161f1a',
    error: '#ff8a80',
    success: '#8fd3a8',
  },
  components: { Layout, ChoiceGroup, Rating },
});
