import {
  type ChoiceGroupUIProps,
  defineTheme,
  type LayoutUIProps,
  type RatingUIProps,
  useFieldValue,
  useTranslate,
} from '@open-form-build/core';
import './fonts/bricolage-grotesque.css';
import './fonts/geist-mono.css';
import './loop.css';

// Loop: a bike-share survey as a ride. One huge question per screen on acid
// lime, a dashed route with a stop per step along the bottom, and the score
// they picked standing behind everything as a giant numeral.

const LETTERS = 'ABCDEFGHIJ';

const NOTES: Record<string, string> = {
  commute: 'Home to work, most days',
  lastMile: 'From the station to the door',
  night: 'Riverside, after dinner',
  errands: 'Market, post office, coffee',
  wandering: 'No destination at all',
};

function verdict(score: number): string {
  if (score >= 9) return 'You would lend a friend your helmet.';
  if (score >= 7) return 'A good ride, but not one to shout about yet.';
  return 'Noted. The next stop is for telling us why.';
}

function Rating({ field, scores, value, onChange, lowLabel, highLabel }: RatingUIProps) {
  const tr = useTranslate();
  return (
    <div className="lp-score">
      <div className="lp-scale">
        {scores.map((score, index) => (
          <label
            key={score}
            className="lp-dot"
            data-past={(value !== undefined && score < value) || undefined}
          >
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={score}
              checked={value === score}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={() => onChange(score)}
            />
            <span>{score}</span>
          </label>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="lp-ends" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
      <p className="lp-verdict" aria-live="polite">
        {value !== undefined && (
          <>
            <i />
            {tr(verdict(value))}
          </>
        )}
      </p>
    </div>
  );
}

function ChoiceGroup({ field, options, multiple, selected, onToggle }: ChoiceGroupUIProps) {
  const tr = useTranslate();
  return (
    <div className="lp-cards">
      {options.map((option, index) => (
        <label key={option.value} className="lp-card">
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            onBlur={field.onBlur}
            onChange={(e) => onToggle(option.value, e.target.checked)}
          />
          <span className="lp-key" aria-hidden="true">
            {LETTERS[index]}
          </span>
          <span className="lp-card-text">
            {option.label}
            {NOTES[option.value] && <small>{tr(NOTES[option.value] as string)}</small>}
          </span>
          <span className="lp-tick" aria-hidden="true" />
        </label>
      ))}
    </div>
  );
}

function Bike() {
  return (
    <svg viewBox="0 0 26 16" width="26" height="16" aria-hidden="true">
      <circle cx="5" cy="11" r="4" />
      <circle cx="21" cy="11" r="4" />
      <path d="M5 11l5-8h7l4 8M10 3l4 8h-9M15 1h3" />
    </svg>
  );
}

function Layout({ state, nav, banner, header, intro, content, alert, actions }: LayoutUIProps) {
  const tr = useTranslate();
  const score = useFieldValue<number>('score');
  const inForm = state === 'form';
  return (
    <div className="lp-screen" data-state={state}>
      <div className="lp-ghost" aria-hidden="true">
        {typeof score === 'number' ? score : ''}
      </div>
      <div className="lp-top" aria-hidden="true">
        <svg
          aria-hidden="true"
          viewBox="0 0 44 26"
          width="44"
          height="26"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.2"
        >
          <circle cx="13" cy="13" r="10.5" />
          <circle cx="31" cy="13" r="10.5" />
        </svg>
        loop
      </div>
      <div
        className={
          state === 'success' ? 'lp-mid of-success' : inForm ? 'lp-mid' : 'lp-mid of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {banner}
        {inForm && (
          <div className="lp-kick">
            <b>{nav.position + 1}</b>
            <span>
              {tr('of')} {nav.total}
            </span>
            {header}
          </div>
        )}
        {intro}
        {content}
        {alert}
      </div>
      {inForm && (
        <div className="lp-bot">
          <ol className="lp-route">
            {nav.steps.map((step) => (
              <li
                key={step.index}
                data-state={step.state}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                <span className="lp-stop">{step.state === 'current' && <Bike />}</span>
                <span className="lp-stop-name">{step.title}</span>
              </li>
            ))}
          </ol>
          {actions}
        </div>
      )}
    </div>
  );
}

const FONT =
  '"Bricolage Grotesque", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif';

export default defineTheme({
  font: FONT,
  headingFont: FONT,
  radius: '18px',
  buttonRadius: '999px',
  spacing: 'comfortable',
  width: '1040px',
  colors: {
    primary: '#11150a',
    primaryForeground: '#d9ff43',
    background: '#d9ff43',
    surface: '#d9ff43',
    foreground: '#11150a',
    muted: '#3d4a14',
    border: '#11150a',
    control: '#11150a',
    input: '#e6ff86',
    error: '#a1140a',
    success: '#11150a',
  },
  dark: {
    primary: '#dcff4a',
    primaryForeground: '#0c1007',
    background: '#0c1007',
    surface: '#0c1007',
    foreground: '#dcff4a',
    muted: '#a3bd3c',
    border: '#dcff4a',
    control: '#dcff4a',
    input: '#141a0b',
    error: '#ff9d8f',
    success: '#dcff4a',
  },
  components: { Layout, Rating, ChoiceGroup },
});
