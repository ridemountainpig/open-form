import { useFormValues } from '@open-form-build/core';

const PRICES: Record<string, string> = { '5': 'NT$ 600', '10': 'NT$ 900', '21': 'NT$ 1,400' };
const KM: Record<string, number> = { '5': 5, '10': 10, '21': 21.1 };

export function formatPace(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Faster runners start first: the wave a target pace (seconds per km) lands in. */
export function waveFor(pace: number): { letter: string; start: string } {
  if (pace <= 300) return { letter: 'A', start: '20:00' };
  if (pace <= 380) return { letter: 'B', start: '20:10' };
  return { letter: 'C', start: '20:20' };
}

function finish(pace: number, distance: string): string {
  const total = Math.round(pace * (KM[distance] ?? 10));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** The race bib on the stage: a live preview of the answers. */
export function Bib() {
  const values = useFormValues();
  const distance = typeof values.distance === 'string' ? values.distance : '10';
  const pace = typeof values.pace === 'number' ? values.pace : 340;
  const wave = waveFor(pace);
  const name = (typeof values.bibName === 'string' && values.bibName.trim()) || 'Your name';
  const color = typeof values.bibColor === 'string' ? values.bibColor : 'amber';
  return (
    <>
      <p className="ml-stage-top">
        <span>
          Your bib · <b>live preview</b>
        </span>
        <span>Printed on tear-proof Tyvek</span>
      </p>
      <div className="ml-bib" data-color={color} aria-hidden="true">
        <i className="ml-hole" />
        <i className="ml-hole" />
        <i className="ml-hole" />
        <i className="ml-hole" />
        <div className="ml-bib-top">
          <b>Moonlap {distance === '21' ? '21.1' : distance}K</b>
          <span>
            <span className="ml-phases">
              <i />
              <i />
              <i />
              <i />
            </span>
            Taipei · 27.03.2027
          </span>
        </div>
        <div className="ml-bib-mid">
          <span>
            Wave {wave.letter} · Start {wave.start}
          </span>
          <b>2716</b>
          <span>Pace {formatPace(pace)} / km</span>
        </div>
        <div className="ml-bib-name">
          <b>{name}</b>
          <span />
          <em>{wave.letter}</em>
        </div>
        <div className="ml-bib-tear">
          <b>2716</b>
          <span>
            Baggage tag · tear here
            <br />
            Emergency contact on reverse
          </span>
          <span className="ml-bars">
            {Array.from({ length: 22 }, (_, i) => (
              <i key={i} />
            ))}
          </span>
        </div>
      </div>
      <dl className="ml-stats">
        <div>
          <dt>Entry</dt>
          <dd>{PRICES[distance] ?? '—'}</dd>
        </div>
        <div>
          <dt>Start</dt>
          <dd>{wave.start}</dd>
        </div>
        <div>
          <dt>Est. finish</dt>
          <dd>{finish(pace, distance)}</dd>
        </div>
        <div>
          <dt>Moon that night</dt>
          <dd>Waning 71%</dd>
        </div>
      </dl>
    </>
  );
}
