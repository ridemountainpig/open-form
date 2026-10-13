import { useFormValues, useTranslate } from '@open-form-build/core';
import { AVATARS, COLORS } from './fields.tsx';
import { quote, ticketCode } from './pricing.ts';

const ROLES: Record<string, string> = {
  engineer: 'Engineer',
  designer: 'Designer',
  founder: 'Founder',
  student: 'Student',
};

const money = (n: number) =>
  `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

// Deterministic "barcode" stripes from the ticket code.
function barcode(code: string): string {
  const stops: string[] = [];
  let x = 0;
  for (let i = 0; i < code.length * 3; i++) {
    const w = ((code.charCodeAt(i % code.length) * (i + 7)) % 4) + 1;
    stops.push(`currentColor ${x}px ${x + w}px`, `transparent ${x + w}px ${x + w + 2}px`);
    x += w + 2;
  }
  return `linear-gradient(90deg, ${stops.join(', ')})`;
}

/**
 * The pass builds itself as people answer — a plain React component reading
 * the live answers with `useFormValues()`.
 */
export function Ticket({ final = false }: { final?: boolean }) {
  const values = useFormValues();
  const tr = useTranslate();
  const { tier, lines, total } = quote(values, tr);
  const color = COLORS.find((c) => c.value === values.color) ?? COLORS[0];
  const avatar = AVATARS.find((a) => a.value === values.avatar);
  const name = String(values.name ?? '').trim();
  const roleName = ROLES[String(values.role)];
  const role = roleName && tr(roleName);
  const code = ticketCode(values.email);
  const speaking = values.wantsToSpeak === true;

  return (
    <div className="pass-aside" data-final={final || undefined}>
      <div className="pass-ticket" style={{ background: color?.gradient }}>
        <div className="pass-ticket-main">
          <div className="pass-ticket-top">
            <span>OPENCONF ’26</span>
            <span>{tier ? tr(tier.name).toUpperCase() : tr('PICK A PASS')}</span>
          </div>
          <div className="pass-ticket-who">
            <span className="pass-ticket-avatar" key={avatar?.value}>
              {avatar?.value ?? '?'}
            </span>
            <span className="pass-ticket-name-wrap">
              <span className="pass-ticket-name">{name || tr('Your name')}</span>
              <span className="pass-ticket-role">
                {[role, speaking ? tr('Speaker') : null].filter(Boolean).join(' · ') ||
                  tr('Attendee')}
              </span>
            </span>
          </div>
          <div className="pass-ticket-meta">
            <span>{tr('NOV 14–15 · TAIPEI')}</span>
            <span>{tier ? (total === 0 ? tr('FREE') : money(total)) : '$—'}</span>
          </div>
          <div className="pass-ticket-code">
            <span className="pass-barcode" style={{ backgroundImage: barcode(code) }} />
            <span>{code}</span>
          </div>
        </div>
        <div className="pass-ticket-stub">
          <span>{tr('ADMIT ONE')}</span>
        </div>
        {final && <span className="pass-stamp">{tr('CONFIRMED')}</span>}
      </div>

      {!final && (
        <dl className="pass-quote" aria-live="polite">
          {lines.length === 0 && (
            <div className="pass-quote-empty">
              {tr('Your pass and total appear here as you go.')}
            </div>
          )}
          {lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{money(line.amount)}</dd>
            </div>
          ))}
          {lines.length > 0 && (
            <div className="pass-quote-total">
              <dt>{tr('Total')}</dt>
              <dd>{money(total)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
