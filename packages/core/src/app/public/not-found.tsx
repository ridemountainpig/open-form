import type { Locale } from '../../schema/index.ts';
import '../../react/styles.css';
import './public.css';

// The logo's step rail with its last step missing: the form this link was for isn't here.
function MissingStep() {
  return (
    <div className="of-missing-art" aria-hidden="true">
      <div className="of-missing-card of-missing-card-back" />
      <svg className="of-missing-card" viewBox="0 0 232 148" fill="none" aria-hidden="true">
        <path className="of-missing-rail" d="M36 41v22" />
        <path className="of-missing-rail of-missing-dashed" d="M36 85v20" />
        <circle className="of-missing-done" cx="36" cy="30" r="8" />
        <rect className="of-missing-bar" x="60" y="26" width="104" height="8" rx="4" />
        <circle className="of-missing-done" cx="36" cy="74" r="8" />
        <rect className="of-missing-bar" x="60" y="70" width="76" height="8" rx="4" />
        <g className="of-missing-gone">
          <circle cx="36" cy="118" r="10" />
          <rect x="60" y="113" width="120" height="10" rx="5" />
        </g>
      </svg>
    </div>
  );
}

export function MissingPage({
  locale,
  title,
  message,
}: {
  locale: Locale;
  title: string;
  message?: string;
}) {
  return (
    <div className="of-host">
      <main className="of-root of-missing" lang={locale}>
        <MissingStep />
        <p className="of-missing-code">404</p>
        <h1 className="of-missing-title">{title}</h1>
        {message && <p className="of-missing-message">{message}</p>}
      </main>
    </div>
  );
}

export function NotFound() {
  return <MissingPage locale="en" title="Page not found" />;
}
