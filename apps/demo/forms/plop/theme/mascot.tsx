import type { ShaderSource } from '@vgpu/wgsl';
import { useEffect, useRef, useState } from 'react';
import black from './stills/black.png';
import champagne from './stills/champagne.png';
import rose from './stills/rose.png';
import silver from './stills/silver.png';

// Plop on a WebGPU canvas, rendered by vgpu from plop.wgsl (prepared into
// plop-shader.json by scripts/prepare-plop-shader.mjs). The chosen finish tints
// the metal and makes it wobble; Plop turns toward the pointer. Without WebGPU,
// or with reduced motion before the GPU is up, a still of the same render shows.

export const FINISHES = {
  silver: { tint: [0.97, 0.96, 0.95], still: silver },
  rose: { tint: [0.98, 0.74, 0.66], still: rose },
  champagne: { tint: [0.97, 0.86, 0.64], still: champagne },
  black: { tint: [0.32, 0.32, 0.35], still: black },
} as const;

export type Finish = keyof typeof FINISHES;

export function isFinish(value: unknown): value is Finish {
  return typeof value === 'string' && value in FINISHES;
}

// One device for the page, kept across remounts (React re-runs effects in dev).
let shared: Promise<import('vgpu').Gpu> | undefined;

type Props = { finish: Finish; cheer: boolean };

export function Mascot({ finish, cheer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ finish, cheer, kick: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    live.current.finish = finish;
    live.current.kick += 1;
  }, [finish]);

  useEffect(() => {
    live.current.cheer = cheer;
    if (cheer) live.current.kick += 1;
  }, [cheer]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !('gpu' in navigator)) return;
    let disposed = false;
    let teardown = () => {};

    void (async () => {
      try {
        const [{ clock, effect, frameLoop, init, surface }, shader] = await Promise.all([
          import('vgpu'),
          import('./plop-shader.json').then((m) => m.default as unknown as ShaderSource),
        ]);
        shared ??= init();
        const gpu = await shared;
        if (disposed) return;
        const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const out = surface(gpu, canvas, { dpr: [1, 1.75], clearColor: [0, 0, 0, 0] });
        const tint = [...FINISHES[live.current.finish].tint];
        const look = [0, 0];
        const aim = [0, 0];
        let jiggle = 0;
        let seen = live.current.kick;
        const plop = effect(gpu, shader, {
          set: {
            params: {
              tint,
              time: 1.3,
              look,
              aspect: 1,
              jiggle: 0,
              px: 0.004,
              blush: 1,
            },
          },
        });
        await plop.compile(out);
        if (disposed) return out.dispose();
        out.onResize(({ width, height }) => {
          plop.set({ params: { aspect: width / height, px: 2 / height } });
        });

        const onPointer = (event: PointerEvent) => {
          const box = canvas.getBoundingClientRect();
          aim[0] = Math.max(
            -1,
            Math.min(1, (event.clientX - box.left - box.width / 2) / innerWidth),
          );
          aim[1] = Math.max(
            -1,
            Math.min(1, (event.clientY - box.top - box.height / 2) / innerHeight),
          );
        };

        const time = clock(gpu);
        let last = 0;
        const tick = () => {
          const now = still ? 1.3 : time.time;
          const dt = Math.min(0.1, Math.max(0, now - last));
          last = now;
          const state = live.current;
          if (state.kick !== seen) {
            seen = state.kick;
            jiggle = 1;
          }
          const target = FINISHES[state.finish].tint;
          const ease = still ? 1 : 1 - Math.exp(-dt * 6);
          for (let i = 0; i < 3; i++) tint[i] += (target[i] - tint[i]) * ease;
          for (let i = 0; i < 2; i++)
            look[i] += (aim[i] * 2.2 - look[i]) * (still ? 0 : 1 - Math.exp(-dt * 4));
          jiggle = state.cheer && !still ? Math.max(jiggle, 0.45) : jiggle * Math.exp(-dt * 2.2);
          plop.set({ params: { tint, time: now, look, jiggle: still ? 0 : jiggle } });
        };

        let loop: { stop(): void } | undefined;
        const start = () => {
          if (loop || disposed) return;
          loop = frameLoop(gpu, (frame) => {
            tick();
            frame.pass(out, plop);
          });
        };
        const stop = () => {
          loop?.stop();
          loop = undefined;
        };

        if (still) {
          // Draw once now, and again whenever the finish changes.
          let drawn = -1;
          const id = setInterval(() => {
            if (drawn === live.current.kick) return;
            drawn = live.current.kick;
            start();
            requestAnimationFrame(() => requestAnimationFrame(stop));
          }, 150);
          teardown = () => clearInterval(id);
        } else {
          const io = new IntersectionObserver(([entry]) =>
            entry?.isIntersecting ? start() : stop(),
          );
          io.observe(canvas);
          addEventListener('pointermove', onPointer, { passive: true });
          teardown = () => {
            io.disconnect();
            removeEventListener('pointermove', onPointer);
          };
        }
        gpu.lost.then(() => setReady(false));
        setReady(true);
        const cleanup = teardown;
        teardown = () => {
          cleanup();
          stop();
          out.dispose();
        };
        if (disposed) teardown();
      } catch {
        setReady(false);
      }
    })();

    return () => {
      disposed = true;
      teardown();
    };
  }, []);

  return (
    <div className="pl-mascot" data-ready={ready || undefined} aria-hidden="true">
      <img className="pl-still" src={FINISHES[finish].still} alt="" />
      <canvas ref={canvasRef} className="pl-canvas" />
    </div>
  );
}
