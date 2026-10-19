'use client';

import { useEffect, useState } from 'react';
import { CheckGlyph } from './copy-command';

const SECTIONS = [
  ['try', 'Try it'],
  ['journey', 'Data flow'],
  ['features', 'Authoring'],
  ['fields', 'Fields'],
  ['themes', 'Looks'],
  ['compare', 'Compare'],
  ['faq', 'FAQ'],
  ['install', 'Get started'],
] as const;
const LAST = SECTIONS.length - 1;

/**
 * The page read as a form being filled in: the logo's step rail, with the
 * section you're on as the current step and a check at the end.
 */
export function StepRail() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.innerHeight * 0.4;
      let current = 0;
      SECTIONS.forEach(([id], i) => {
        const top = document.getElementById(id)?.getBoundingClientRect().top;
        if (top !== undefined && top <= line) current = i;
      });
      const bottom = window.innerHeight + window.scrollY;
      if (bottom >= document.documentElement.scrollHeight - 4) current = LAST;
      setActive(current);
    };
    // Scroll fires many times a frame; measure the sections once per frame.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <nav
      aria-label="Sections"
      className="fixed top-1/2 left-5 z-30 hidden -translate-y-1/2 min-[1360px]:block"
    >
      <ol className="relative flex flex-col gap-5">
        <span
          aria-hidden="true"
          className="absolute top-2.5 bottom-2.5 left-[9.5px] w-px bg-[color:var(--color-rule)]"
        />
        <span
          aria-hidden="true"
          className="absolute top-2.5 left-[9.5px] w-px bg-[color:var(--color-text)] transition-[height] duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{ height: `calc((100% - 20px) * ${active / LAST})` }}
        />
        {SECTIONS.map(([id, label], i) => {
          const current = i === active;
          const passed = i < active;
          const last = i === LAST;
          return (
            <li key={id}>
              <a
                href={`#${id}`}
                aria-current={current ? 'step' : undefined}
                className="group relative flex items-center"
              >
                <span
                  className={`relative z-10 flex size-5 items-center justify-center rounded-full border transition-colors duration-300 ${
                    current || (last && passed)
                      ? 'border-[color:var(--color-text)] bg-[color:var(--color-text)] text-[color:var(--color-ink)]'
                      : passed
                        ? 'border-[color:var(--color-text)] bg-[color:var(--color-ink)] text-[color:var(--color-text)]'
                        : 'border-[color:var(--color-rule)] bg-[color:var(--color-ink)] text-[color:var(--color-dim)] group-hover:border-[color:var(--color-dim)]'
                  }`}
                >
                  {last ? (
                    <CheckGlyph className="size-3" />
                  ) : (
                    <span
                      className={`size-[5px] rounded-full bg-current ${passed ? 'opacity-45' : ''}`}
                    />
                  )}
                </span>
                <span
                  className={`pointer-events-none absolute left-7 rounded-[4px] bg-[color:var(--color-ink)] px-1.5 py-0.5 font-[family-name:var(--font-mono)] text-[11px] tracking-[0.08em] whitespace-nowrap uppercase transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 ${
                    current
                      ? 'text-[color:var(--color-text)] opacity-0 min-[1520px]:opacity-100'
                      : 'text-[color:var(--color-muted)] opacity-0'
                  }`}
                >
                  {label}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
