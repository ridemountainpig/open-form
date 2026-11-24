import { T, useFormValues } from '@open-form-build/core';

const PIECES: Record<string, { name: string; from: string }> = {
  table: { name: 'Dining table', from: 'NT$ 86,000' },
  bench: { name: 'Bench', from: 'NT$ 32,000' },
  shelving: { name: 'Shelving', from: 'NT$ 48,000' },
  other: { name: 'Something else', from: 'On drawing' },
};

const TIMBERS: Record<string, string> = {
  oak: 'White oak',
  walnut: 'Walnut',
  ash: 'Ash',
  cherry: 'Cherry',
  undecided: 'To be chosen',
};

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

/** The job docket on the brand panel: it fills in as the enquiry is written. */
export function Docket() {
  const values = useFormValues();
  const piece = PIECES[text(values.piece)];
  const who = [text(values.name), text(values.city)].filter(Boolean).join(', ');
  const seats =
    values.piece === 'table' && typeof values.seats === 'number' ? ` · seats ${values.seats}` : '';
  const rows: Array<[string, string]> = [
    ['For', who],
    ['Piece', piece ? `${piece.name}${seats}` : ''],
    ['Timber', TIMBERS[text(values.timber)] ?? ''],
    ['Room', text(values.room) ? 'Described' : ''],
  ];
  return (
    <>
      <div className="hd-tag" aria-hidden="true">
        <div className="hd-tag-top">
          <span>Job docket</span>
          <b>Nº 0427 · draft</b>
        </div>
        <dl>
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd data-empty={value ? undefined : ''}>{value || 'not yet'}</dd>
            </div>
          ))}
        </dl>
        <div className="hd-tag-foot">
          <p>
            <small>Estimate from</small>
            {piece?.from ?? '—'}
          </p>
          <div className="hd-bars">
            {Array.from({ length: 18 }, (_, i) => (
              <i key={i} />
            ))}
          </div>
        </div>
      </div>
      <dl className="hd-facts">
        <div>
          <dt>
            <T>Lead time</T>
          </dt>
          <dd>
            <T>12–14 weeks</T>
          </dd>
        </div>
        <div>
          <dt>
            <T>Each season</T>
          </dt>
          <dd>
            <T>9 commissions</T>
          </dd>
        </div>
        <div>
          <dt>
            <T>Since</T>
          </dt>
          <dd>2011</dd>
        </div>
      </dl>
    </>
  );
}
