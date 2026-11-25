import { useFormValues } from '@open-form-build/core';
import { BASE, CONCENTRATION, HEART, pick, SIZES, TOP } from './notes.ts';

export function useBlend() {
  const values = useFormValues();
  const top = pick(TOP, values.top);
  const heart = pick(HEART, values.heart);
  const base = pick(BASE, values.base);
  const concentration = pick(CONCENTRATION, values.concentration);
  const size = pick(SIZES, values.size);
  const engraving = String(values.engraving ?? '').trim();
  return {
    notes: [top, heart, base] as const,
    names: [top && TOP[top].name, heart && HEART[heart].name, base && BASE[base].name],
    concentration,
    size,
    price: size ? SIZES[size].price + (concentration === 'extrait' ? 30 : 0) : undefined,
    engraving,
    gift: values.gift === true,
    email: String(values.email ?? ''),
  };
}

export function Receipt() {
  const blend = useBlend();
  return (
    <div className="pa-receipt">
      <p className="pa-receipt-name">{blend.engraving || 'Untitled'}</p>
      <dl className="pa-receipt-notes">
        {['Top', 'Heart', 'Base'].map((layer, i) => (
          <div key={layer}>
            <dt>{layer}</dt>
            <dd>{blend.names[i]}</dd>
          </div>
        ))}
      </dl>
      <p className="pa-receipt-line">
        <span>
          {blend.concentration ? CONCENTRATION[blend.concentration].name : ''}
          {blend.size ? ` · ${SIZES[blend.size].name}` : ''}
          {blend.gift ? ' · gift wrapped' : ''}
        </span>
        {blend.price !== undefined && <b>€{blend.price}</b>}
      </p>
      <p className="of-description">
        We mix it by hand and let it rest for a week before it ships. A tracking link goes to{' '}
        {blend.email || 'your email'} when it leaves the atelier.
      </p>
    </div>
  );
}
