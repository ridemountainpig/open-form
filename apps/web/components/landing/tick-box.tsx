'use client';

import { useInView } from 'motion/react';
import { useRef } from 'react';
import { CheckGlyph } from './copy-command';

const TICK_STAGGER_MS = 260;

/** A printed checkbox that ticks itself once it scrolls into view. */
export function TickBox({ index }: { index: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 1 });

  return (
    <span
      ref={ref}
      aria-hidden="true"
      className="flex size-6 shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--color-text)]"
    >
      {inView ? (
        <CheckGlyph
          className="tick-in size-4 text-[color:var(--color-text)]"
          style={{ animationDelay: `${200 + index * TICK_STAGGER_MS}ms` }}
        />
      ) : null}
    </span>
  );
}
