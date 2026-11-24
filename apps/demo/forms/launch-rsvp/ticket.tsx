import { useFormValues } from '@open-form-build/core';

export const SESSIONS = {
  keynote: { time: '14:00', name: '主題演講', word: 'Keynote' },
  workshop: { time: '16:00', name: '動手做工作坊', word: 'Workshop' },
  party: { time: '18:30', name: '交流酒會', word: 'Afterparty' },
} as const;

export type Session = keyof typeof SESSIONS;

export function isSession(value: unknown): value is Session {
  return typeof value === 'string' && value in SESSIONS;
}

export function useRsvp() {
  const values = useFormValues();
  const picked = Array.isArray(values.sessions) ? values.sessions.filter(isSession) : [];
  const sessions = (Object.keys(SESSIONS) as Session[]).filter((s) => picked.includes(s));
  const raw = Number(values.guests);
  const guests = Number.isInteger(raw) && raw >= 0 && raw <= 3 ? raw : 0;
  return {
    name: String(values.name ?? '').trim(),
    email: String(values.email ?? ''),
    sessions,
    guests,
    people: guests + 1,
  };
}

export function Ticket() {
  const rsvp = useRsvp();
  return (
    <div className="lr-ticket">
      <p className="lr-ticket-who">
        <span>{rsvp.name || '你'}</span>
        <span>{rsvp.guests ? `＋ ${rsvp.guests} 位同行` : '一位'}</span>
      </p>
      <ul className="lr-ticket-sessions">
        {rsvp.sessions.map((s) => (
          <li key={s}>
            <b>{SESSIONS[s].time}</b>
            <span>{SESSIONS[s].name}</span>
          </li>
        ))}
      </ul>
      <p className="of-description">
        {rsvp.email
          ? `入場 QR code 會在 3 月 6 日前寄到 ${rsvp.email}。`
          : '入場 QR code 會在 3 月 6 日前寄出。'}
        當天憑 QR code 入場，同行的人跟你一起進場就好。
      </p>
    </div>
  );
}
