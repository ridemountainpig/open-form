'use client';

import { useInView, useReducedMotion } from 'motion/react';
import { type KeyboardEvent, type ReactNode, useEffect, useId, useRef, useState } from 'react';
import { Container, SectionHeading } from './frame';
import {
  FieldVisual,
  PipelineVisual,
  RequestVisual,
  ResponsesVisual,
  StorageVisual,
} from './visuals';

type Stop = {
  where: string;
  title: string;
  body: ReactNode;
  visual: ReactNode;
  dwell: number;
};

const mono = 'font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-text)]';

const stops: Stop[] = [
  {
    where: 'Browser',
    title: 'Checked as they type.',
    body: 'Required fields, formats and limits come from the form file, so mistakes are caught before anything is sent.',
    visual: <FieldVisual />,
    dwell: 4200,
  },
  {
    where: 'Request',
    title: 'Sent with proof of a person.',
    body: 'One POST to the submission API. A honeypot field and a timing token signed at page load ride along with the answers.',
    visual: <RequestVisual />,
    dwell: 4200,
  },
  {
    where: 'Server',
    title: 'Checked again, by the same rules.',
    body: 'The server learns the form by rendering the same file, so it enforces exactly what the browser did. Then deadlines, response caps, rate limits and one-per-email.',
    visual: <PipelineVisual />,
    dwell: 5400,
  },
  {
    where: 'SQLite',
    title: 'Stored on your disk.',
    body: (
      <>
        A row in <span className={mono}>.open-form/open-form.db</span>, written by Node&apos;s
        built-in SQLite. No database server, and the folder stays out of git.
      </>
    ),
    visual: <StorageVisual />,
    dwell: 4400,
  },
  {
    where: 'Studio',
    title: 'Read, exported, sent on.',
    body: 'Search and open every response in Studio. Export to Excel, CSV or JSON, or post each new one to a webhook.',
    visual: <ResponsesVisual />,
    dwell: 5200,
  },
];

const LAST = stops.length - 1;
const EDGE = 100 / stops.length / 2;
const SPAN = 100 - EDGE * 2;

export function Journey() {
  const baseId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();
  const [active, setActive] = useState(0);
  const [picked, setPicked] = useState(false);

  useEffect(() => {
    if (!inView || reduced || picked) return;
    const timer = window.setTimeout(
      () => setActive((a) => (a === LAST ? 0 : a + 1)),
      stops[active].dwell,
    );
    return () => window.clearTimeout(timer);
  }, [inView, reduced, picked, active]);

  const pick = (i: number) => {
    setPicked(true);
    setActive(i);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = active === LAST ? 0 : active + 1;
    else if (e.key === 'ArrowLeft') next = active === 0 ? LAST : active - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = LAST;
    if (next === null) return;
    e.preventDefault();
    pick(next);
    tabRefs.current[next]?.focus();
  };

  const stop = stops[active];
  const at = EDGE + (active / LAST) * SPAN;

  return (
    <section id="journey">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading
          number="02"
          label="Data flow"
          title="The life of a response."
          lead="Every answer takes the same path, and every check along it comes from the one file your agent wrote."
        />

        <div ref={ref} data-reveal>
          <div
            role="tablist"
            aria-label="Where a response goes"
            onKeyDown={onKeyDown}
            className="relative grid pt-10"
            style={{ gridTemplateColumns: `repeat(${stops.length}, minmax(0, 1fr))` }}
          >
            <span
              aria-hidden="true"
              className="absolute top-[55px] h-px bg-[color:var(--color-rule)]"
              style={{ left: `${EDGE}%`, right: `${EDGE}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute top-[55px] h-px bg-[color:var(--color-text)] transition-[width] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ left: `${EDGE}%`, width: `${(active / LAST) * SPAN}%` }}
            />
            <span
              aria-hidden="true"
              className="absolute top-0 -translate-x-1/2 rounded-full bg-[color:var(--color-text)] px-2 py-0.5 font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-ink)] transition-[left] duration-700 ease-[cubic-bezier(0.23,1,0.32,1)]"
              style={{ left: `${at}%` }}
            >
              #48
            </span>

            {stops.map((s, i) => {
              const selected = i === active;
              const passed = i < active;
              return (
                <button
                  key={s.where}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${i}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => pick(i)}
                  className="group relative flex flex-col items-center gap-3"
                >
                  <span
                    className={`relative flex size-[30px] items-center justify-center rounded-full border font-[family-name:var(--font-mono)] text-[11.5px] transition-colors duration-300 ${
                      selected
                        ? 'border-[color:var(--color-text)] bg-[color:var(--color-text)] text-[color:var(--color-ink)]'
                        : passed
                          ? 'border-[color:var(--color-text)] bg-[color:var(--color-ink)] text-[color:var(--color-text)]'
                          : 'border-[color:var(--color-rule)] bg-[color:var(--color-ink)] text-[color:var(--color-muted)] group-hover:border-[color:var(--color-dim)]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`caption transition-colors ${selected ? 'text-[color:var(--color-text)]' : 'group-hover:text-[color:var(--color-text)]'}`}
                  >
                    {s.where}
                  </span>
                </button>
              );
            })}
          </div>

          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active}`}
            className="mt-10 grid grid-cols-1 gap-8 border-t border-[color:var(--color-rule-soft)] pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] lg:gap-16"
          >
            <div key={`text-${active}`} className="panel-in flex flex-col gap-4">
              <span className="eyebrow">
                Stop {active + 1} of {stops.length} · {stop.where}
              </span>
              <h3 className="display text-[30px] leading-[1.08] sm:text-[38px]">{stop.title}</h3>
              <p className="max-w-[46ch] text-pretty text-[15.5px] leading-[1.6] text-[color:var(--color-text-soft)]">
                {stop.body}
              </p>
            </div>
            <div key={`visual-${active}`} className="panel-in min-h-[340px]">
              {stop.visual}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
