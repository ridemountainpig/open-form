import {
  type ChoiceGroupUIProps,
  defineTheme,
  FocusLayout,
  type LayoutUIProps,
  type RatingUIProps,
  useFormNav,
} from '@open-form-build/core';
import { useEffect, useRef } from 'react';
import './fonts/bricolage-grotesque.css';
import './fonts/geist-mono.css';
import './conversational.css';

// Conversational: one question per screen on a warm sunrise wash. Choices
// carry letter keys, and a single answer moves on by itself. See THEME.md.

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
      if (document.querySelectorAll('[data-kt-keys]').length !== 1) return;
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
    <div ref={ref} className="kt-choices" data-kt-keys="">
      {options.map((option, index) => (
        <label key={option.value} className="kt-choice">
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
          <span className="kt-cap">
            <span className="kt-key" aria-hidden="true">
              {LETTERS[index]}
            </span>
            <span className="kt-choice-label">{option.label}</span>
            <span className="kt-check" aria-hidden="true">
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
      <div className="kt-scale" data-many={scores.length > 7 || undefined}>
        {scores.map((score, index) => (
          <label key={score} className="kt-scale-item">
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
        <div className="kt-scale-ends" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  );
}

function Layout(props: LayoutUIProps) {
  return (
    <div className="kt-page">
      <div className="kt-top" aria-hidden="true">
        <span className="kt-logo">
          <i />
        </span>
      </div>
      <FocusLayout {...props} />
    </div>
  );
}

const FONT =
  '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif';

export default defineTheme({
  font: FONT,
  headingFont: FONT,
  radius: '6px',
  spacing: 'comfortable',
  width: '880px',
  colors: {
    primary: '#3b2412',
    primaryForeground: '#fff6ea',
    background: '#f9e3c4',
    surface: '#fbecd6',
    foreground: '#3b2412',
    muted: '#6e5440',
    border: '#c9ab8c',
    control: '#8a6a50',
    input: '#fdf3e4',
    error: '#a3271b',
    success: '#2d6a3e',
  },
  dark: {
    primary: '#fbeedd',
    primaryForeground: '#2a1710',
    background: '#2b1a1a',
    surface: '#33201d',
    foreground: '#fbeedd',
    muted: '#c9b3a0',
    border: '#6b4a40',
    control: '#a88a78',
    input: '#3a2521',
    error: '#ff9a8a',
    success: '#8ed3a0',
  },
  components: { Layout, ChoiceGroup, Rating },
});
