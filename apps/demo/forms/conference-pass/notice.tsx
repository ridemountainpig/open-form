import { type NoticeUIProps, T, useTranslate } from '@open-form-build/core';

const STAMP: Partial<Record<NoticeUIProps['state'], string>> = {
  closed: 'CLOSED',
  full: 'SOLD OUT',
};

/** The closed screens as a voided pass, so they look like the rest of the form. */
export function PassNotice({ state, eyebrow, title, message }: NoticeUIProps) {
  const tr = useTranslate();
  const stamp = STAMP[state];
  const heading =
    state === 'closed' ? (
      <T>Registration is closed</T>
    ) : state === 'full' ? (
      <T>Every pass is taken</T>
    ) : (
      title
    );
  return (
    <div className="pass-notice">
      <div className="pass-ticket pass-ticket-void" aria-hidden="true">
        <div className="pass-ticket-main">
          <div className="pass-ticket-top">
            <span>OPENCONF ’26</span>
            <span>{tr('NOV 14–15 · TAIPEI')}</span>
          </div>
          <div className="pass-ticket-void-code" />
          <div className="pass-ticket-meta">
            <span>{tr('ADMIT ONE')}</span>
            <span>#——————</span>
          </div>
        </div>
        <div className="pass-ticket-stub">
          <span>{tr('ADMIT ONE')}</span>
        </div>
        {stamp && <span className="pass-stamp">{tr(stamp)}</span>}
      </div>
      {eyebrow && <p className="of-eyebrow">{eyebrow}</p>}
      <h1 className="of-title">{heading}</h1>
      <p className="of-description">{message}</p>
      {(state === 'closed' || state === 'full') && (
        <p className="pass-notice-next">
          <T>Already registered? Your pass is in your inbox — show its code at the door.</T>
        </p>
      )}
    </div>
  );
}
