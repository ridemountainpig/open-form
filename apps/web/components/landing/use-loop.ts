'use client';

import { useInView, useReducedMotion } from 'motion/react';
import { type RefObject, useEffect, useState } from 'react';

/**
 * Steps through `cues` (ms from the start) while `ref` is on screen, then
 * restarts after `loop` ms. `phase` counts the cues passed; with reduced
 * motion it rests on the final phase.
 */
export function useLoop(ref: RefObject<Element | null>, cues: readonly number[], loop: number) {
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [state, setState] = useState({ phase: cues.length, cycle: 0 });

  useEffect(() => {
    if (!inView || reduced) {
      setState((s) => ({ ...s, phase: cues.length }));
      return;
    }
    let timers: number[] = [];
    const run = () => {
      setState((s) => ({ phase: 0, cycle: s.cycle + 1 }));
      timers = cues.map((at, k) =>
        window.setTimeout(() => setState((s) => ({ ...s, phase: k + 1 })), at),
      );
      timers.push(window.setTimeout(run, loop));
    };
    run();
    return () => {
      for (const t of timers) window.clearTimeout(t);
    };
  }, [inView, reduced, cues, loop]);

  return state;
}
