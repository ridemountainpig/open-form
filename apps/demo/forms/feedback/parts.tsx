import {
  defaultComponents,
  type HeaderUIProps,
  useFormValues,
  useTranslate,
} from '@open-form-build/core';

export const FEATURES = [
  { value: 'editor', label: '✏️  Form editing' },
  { value: 'responses', label: '📥  Managing responses' },
  { value: 'csv', label: '📊  CSV export' },
  { value: 'themes', label: '🎨  Themes' },
];

const icon = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

/** The welcome screen: a badge that mirrors the success check, then what to expect. */
export function FeedbackHeader(props: HeaderUIProps) {
  const tr = useTranslate();
  return (
    <div className="fb-cover">
      <span className="fb-badge" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true" {...icon}>
          <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H11l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
          <path d="M8.5 11.25h.01M12 11.25h.01M15.5 11.25h.01" strokeWidth={2.6} />
        </svg>
      </span>
      <defaultComponents.Header {...props} />
      <ul className="fb-facts">
        <li>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...icon}>
            <circle cx="12" cy="12" r="8.5" />
            <path d="M12 7.5V12l3 2" />
          </svg>
          {tr('About a minute')}
        </li>
        <li>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...icon}>
            <path d="M8 7h11M8 12h11M8 17h11M4.5 7h.01M4.5 12h.01M4.5 17h.01" />
          </svg>
          {tr('4 questions')}
        </li>
        <li>
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" {...icon}>
            <rect x="5" y="10.5" width="14" height="9.5" rx="2" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
          </svg>
          {tr('Anonymous is fine')}
        </li>
      </ul>
    </div>
  );
}

function segment(score: number): string {
  if (score >= 9) return "You're one of our biggest fans.";
  if (score >= 7) return 'Just shy of a perfect score.';
  return 'Your suggestions go to the top of our list.';
}

/** What we heard, played back on the success screen. Display only. */
export function FeedbackReceipt() {
  const values = useFormValues();
  const tr = useTranslate();
  const score = values.nps === undefined || values.nps === '' ? Number.NaN : Number(values.nps);
  const used = Array.isArray(values.features)
    ? FEATURES.filter((feature) => (values.features as unknown[]).includes(feature.value))
    : [];
  const email = String(values.email ?? '').trim();
  if (!Number.isFinite(score)) return null;

  return (
    <div className="fb-receipt">
      <div className="fb-score">
        <span className="fb-score-value">{score}</span>
        <span className="fb-score-scale">/ 10</span>
      </div>
      <p className="fb-score-note">{tr(segment(score))}</p>
      {used.length > 0 && (
        <ul className="fb-chips" aria-label={tr('Which features do you use most?')}>
          {used.map((feature) => (
            <li key={feature.value}>{tr(feature.label)}</li>
          ))}
        </ul>
      )}
      {email && (
        <p className="fb-reply">{tr("If we need to, we'll write to {email}", { email })}</p>
      )}
    </div>
  );
}
