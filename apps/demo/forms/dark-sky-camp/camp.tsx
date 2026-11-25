import { useFormValues } from '@open-form-build/core';
import { pick, SIGNS, SITES, signFor, visibleAtNight, WEEKENDS } from './sky.ts';

export function useCamp() {
  const values = useFormValues();
  const raw = Number(values.group);
  const sign = signFor(values.birthday);
  return {
    weekend: pick(WEEKENDS, values.weekend),
    site: pick(SITES, values.site),
    group: Number.isInteger(raw) && raw >= 1 && raw <= 6 ? raw : 0,
    sign,
    signName: sign ? SIGNS[sign]?.name : undefined,
    telescope: values.telescope === true,
    name: String(values.name ?? '').trim(),
  };
}

export function Ticket() {
  const camp = useCamp();
  const weekend = camp.weekend && WEEKENDS[camp.weekend];
  const site = camp.site && SITES[camp.site];
  return (
    <div className="ds-ticket">
      <p className="ds-ticket-head">
        <span>{weekend ? `${weekend.name} · ${weekend.dates}` : 'Dark Sky Camp'}</span>
        <b>{camp.group > 1 ? `${camp.group} people` : '1 person'}</b>
      </p>
      <p className="ds-ticket-site">{site?.name}</p>
      <p className="of-description">
        Arrive before sunset on the first day; we switch every light off at 21:00. Bring warm layers
        {camp.telescope ? ' — your telescope will be set up at your pitch' : ''}.
        {camp.sign && camp.signName && camp.weekend
          ? visibleAtNight(camp.sign, camp.weekend)
            ? ` We'll point out ${camp.signName} on the first night.`
            : ` ${camp.signName} is too close to the Sun to see that weekend, so we'll show you where it hides on the sky chart.`
          : ''}
      </p>
    </div>
  );
}
