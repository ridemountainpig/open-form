import { T, useFormLanguage, useFormValues } from '@open-form-build/core';

export const SERVICES: Record<string, { name: string; minutes: number; price: number }> = {
  cut: { name: 'The cut', minutes: 30, price: 600 },
  cutBeard: { name: 'Cut + beard', minutes: 45, price: 850 },
  shave: { name: 'Hot shave', minutes: 30, price: 500 },
  kids: { name: "Kids' cut", minutes: 20, price: 400 },
};

const BARBERS: Record<string, string> = {
  anyone: 'Anyone free',
  leo: 'Leo',
  mina: 'Mina',
  jo: 'Jo',
};

function endTime(start: string, minutes: number): string {
  const [h = 0, m = 0] = start.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** The booking stub beside the form: it fills in as the answers do. */
export function Ticket() {
  const values = useFormValues();
  const { locale } = useFormLanguage();
  const service = SERVICES[String(values.service)];
  const time = typeof values.time === 'string' ? values.time : '';
  const day =
    typeof values.day === 'string' && values.day
      ? new Date(`${values.day}T12:00`).toLocaleDateString(locale, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })
      : '';
  const name = typeof values.name === 'string' ? values.name.trim() : '';
  return (
    <div className="sc-ticket">
      <div className="sc-ticket-top">
        <p className="sc-caption">Sunday Cuts</p>
        <p className="sc-when">
          {day || <T>Pick a day</T>}
          <small>
            {time ? (
              service ? (
                `${time} – ${endTime(time, service.minutes)}`
              ) : (
                time
              )
            ) : (
              <T>and a time</T>
            )}
          </small>
        </p>
      </div>
      <div className="sc-tear" />
      <dl className="sc-ticket-rows">
        <div>
          <dt>
            <T>Service</T>
          </dt>
          <dd>{service ? <T>{service.name}</T> : '—'}</dd>
        </div>
        <div>
          <dt>
            <T>Barber</T>
          </dt>
          <dd>
            <T>{BARBERS[String(values.barber)] ?? 'Anyone free'}</T>
          </dd>
        </div>
        <div>
          <dt>
            <T>Name</T>
          </dt>
          <dd>{name || '—'}</dd>
        </div>
        <div className="sc-total">
          <dt>
            <T>Pay at the shop</T>
          </dt>
          <dd>{service ? `NT$ ${service.price}` : '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
