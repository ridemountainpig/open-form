import type { CSSProperties, ReactNode } from 'react';

// The garden beside the questions. `stage` is how many answers are in: each one
// plants something new, and every plant draws itself in when it appears.

const LEAF = 'M0 0C14 -11 36 -11 48 0C36 11 14 11 0 0Z';

type FrondProps = {
  from: [number, number];
  bend: [number, number];
  to: [number, number];
  tone: 1 | 2 | 3;
  delay: number;
  pairs: number;
  size: number;
  width: number;
};

function Frond({ from, bend, to, tone, delay, pairs, size, width }: FrondProps) {
  const [x0, y0] = from;
  const [cx, cy] = bend;
  const [x1, y1] = to;
  const leaves: ReactNode[] = [];
  for (let i = 0; i < pairs; i++) {
    const t = 0.16 + i * (0.84 / pairs);
    const u = 1 - t;
    const x = u * u * x0 + 2 * u * t * cx + t * t * x1;
    const y = u * u * y0 + 2 * u * t * cy + t * t * y1;
    const dx = 2 * u * (cx - x0) + 2 * t * (x1 - cx);
    const dy = 2 * u * (cy - y0) + 2 * t * (y1 - cy);
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    const scale = size * (1.05 - t * 0.75);
    for (const side of [-1, 1]) {
      leaves.push(
        <g
          key={`${i}${side}`}
          transform={`translate(${x} ${y}) rotate(${angle + side * 58}) scale(${scale})`}
        >
          <path
            className={`fe-leaf fe-g${tone}`}
            d={LEAF}
            style={{ animationDelay: `${delay + 0.25 + t * 1.1}s` }}
          />
        </g>,
      );
    }
  }
  return (
    <g
      className="fe-sway"
      style={{ transformOrigin: `${x0}px ${y0}px`, animationDelay: `${-delay * 2}s` }}
    >
      <path
        className={`fe-stem fe-g${tone}`}
        d={`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`}
        pathLength={1}
        strokeWidth={width}
        style={{ animationDelay: `${delay}s` }}
      />
      {leaves}
    </g>
  );
}

function Flower() {
  const leaves: Array<[number, number, number, number, number]> = [
    [446, 760, -150, 2.3, 0.6],
    [452, 640, -28, 2, 0.85],
  ];
  return (
    <g className="fe-sway" style={{ transformOrigin: '455px 900px', animationDuration: '7s' }}>
      <path className="fe-stem fe-g1" d="M455 900Q430 660 470 430" pathLength={1} strokeWidth={7} />
      {leaves.map(([x, y, r, s, d]) => (
        <g key={y} transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
          <path className="fe-leaf fe-g2" d={LEAF} style={{ animationDelay: `${d}s` }} />
        </g>
      ))}
      <g transform="translate(470 430)">
        <g className="fe-head">
          <g className="fe-petals">
            {Array.from({ length: 10 }, (_, i) => (
              <ellipse
                key={i}
                className="fe-petal"
                cx="0"
                cy="-50"
                rx="19"
                ry="38"
                transform={`rotate(${i * 36})`}
              />
            ))}
          </g>
          <circle className="fe-eye" r="27" />
          <circle className="fe-g1" r="11" />
        </g>
      </g>
    </g>
  );
}

function Sprout({
  x,
  scale,
  tone,
  delay,
}: {
  x: number;
  scale: number;
  tone: 2 | 3;
  delay: number;
}) {
  const top = 900 - 90 * scale;
  return (
    <g className="fe-sway" style={{ transformOrigin: `${x}px 900px`, animationDuration: '4.2s' }}>
      <path
        className={`fe-stem fe-g${tone}`}
        d={`M${x} 900Q${x - 8} 840 ${x} ${top}`}
        pathLength={1}
        strokeWidth={5}
        style={{ animationDelay: `${delay}s` }}
      />
      {[-140, -40].map((r) => (
        <g key={r} transform={`translate(${x} ${top}) rotate(${r}) scale(${scale})`}>
          <path
            className={`fe-leaf fe-g${tone}`}
            d={LEAF}
            style={{ animationDelay: `${delay + 0.7}s` }}
          />
        </g>
      ))}
    </g>
  );
}

export function Garden({ stage, total, done }: { stage: number; total: number; done: boolean }) {
  return (
    <aside className="fe-art" aria-hidden="true">
      <svg aria-hidden="true" viewBox="0 0 640 900" preserveAspectRatio="xMidYMax slice">
        <circle className="fe-ring" cx="430" cy="270" r="118" />
        <circle className="fe-ring" cx="430" cy="270" r="118" style={{ animationDelay: '1.66s' }} />
        <circle className="fe-ring" cx="430" cy="270" r="118" style={{ animationDelay: '3.33s' }} />
        <circle className="fe-sun" cx="430" cy="270" r="118" />
        <ellipse className="fe-hill2" cx="520" cy="930" rx="420" ry="190" />
        <ellipse className="fe-hill1" cx="110" cy="950" rx="400" ry="170" />
        <Frond
          from={[150, 900]}
          bend={[60, 640]}
          to={[30, 470]}
          tone={2}
          delay={0.1}
          pairs={9}
          size={1.25}
          width={5}
        />
        {stage >= 1 && (
          <Frond
            from={[160, 900]}
            bend={[170, 560]}
            to={[250, 330]}
            tone={1}
            delay={0}
            pairs={12}
            size={1.5}
            width={6}
          />
        )}
        {stage >= 2 && (
          <Frond
            from={[170, 900]}
            bend={[300, 700]}
            to={[360, 560]}
            tone={3}
            delay={0}
            pairs={8}
            size={1.15}
            width={5}
          />
        )}
        {stage >= 3 && <Flower />}
        {stage >= 4 && (
          <>
            <Sprout x={560} scale={1.5} tone={3} delay={0} />
            <Sprout x={602} scale={1.05} tone={2} delay={0.3} />
          </>
        )}
        {done &&
          Array.from({ length: 9 }, (_, i) => (
            <circle
              key={i}
              className="fe-dot"
              cx={60 + i * 66}
              cy={820 - (i % 3) * 90}
              r={3 + (i % 3)}
              style={{ animationDelay: `${i * 0.75}s` } as CSSProperties}
            />
          ))}
      </svg>
      <div className="fe-chip">
        <div className="fe-pips">
          {Array.from({ length: total }, (_, i) => (
            <i
              key={i}
              data-on={i < stage || done || undefined}
              data-now={(i === stage && !done) || undefined}
            />
          ))}
        </div>
        <div>
          <b>{done ? 'Your garden is in bloom' : 'Your garden is growing'}</b>
          <span>Every answer plants something new</span>
        </div>
      </div>
    </aside>
  );
}
