import type { ShaderSource } from '@vgpu/wgsl';
import { useEffect, useRef, useState } from 'react';
import dwarf from './stills/dwarf.png';
import lionhead from './stills/lionhead.png';
import lop from './stills/lop.png';
import upright from './stills/upright.png';

// Hop on a WebGPU canvas, rendered by vgpu from hop.wgsl (prepared into
// hop-shader.json by scripts/prepare-hop-shader.mjs). The breed morphs the ears,
// the finish tints the metal, each carrot a day joins the orbit, and Hop turns
// toward the pointer. Without WebGPU, or with reduced motion before the GPU is
// up, a silver still of the chosen breed shows.

export const FINISHES = {
  silver: { tint: [0.97, 0.96, 0.95] },
  rose: { tint: [0.98, 0.74, 0.66] },
  champagne: { tint: [0.97, 0.86, 0.64] },
  black: { tint: [0.32, 0.32, 0.35] },
} as const;

export const BREEDS = { upright, lop, lionhead, dwarf } as const;

export type Breed = keyof typeof BREEDS;

export function isBreed(value: unknown): value is Breed {
  return typeof value === 'string' && value in BREEDS;
}

const BREED_INDEX = Object.fromEntries(Object.keys(BREEDS).map((key, i) => [key, i])) as Record<
  Breed,
  number
>;

export type Finish = keyof typeof FINISHES;

export function isFinish(value: unknown): value is Finish {
  return typeof value === 'string' && value in FINISHES;
}

// One device for the page, kept across remounts (React re-runs effects in dev).
let shared: Promise<import('vgpu').Gpu> | undefined;

type Props = { breed: Breed; finish: Finish; carrots: number; cheer: boolean };

export function Mascot({ breed, finish, carrots, cheer }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ breed, finish, carrots, cheer, kick: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Object.assign(live.current, { breed, finish, carrots });
    live.current.kick += 1;
  }, [breed, finish, carrots]);

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
          import('./hop-shader.json').then((m) => m.default as unknown as ShaderSource),
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
        let morph = BREED_INDEX[live.current.breed];
        let seen = live.current.kick;
        const hop = effect(gpu, shader, {
          set: {
            params: {
              tint,
              time: 1.3,
              look,
              aspect: 1,
              jiggle: 0,
              px: 0.004,
              blush: 1,
              breed: morph,
              carrots: live.current.carrots,
            },
          },
        });
        await hop.compile(out);
        if (disposed) return out.dispose();
        out.onResize(({ width, height }) => {
          hop.set({ params: { aspect: width / height, px: 2 / height } });
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
          const goal = BREED_INDEX[state.breed];
          morph = Math.abs(goal - morph) < 0.002 ? goal : morph + (goal - morph) * ease;
          for (let i = 0; i < 2; i++)
            look[i] += (aim[i] * 2.2 - look[i]) * (still ? 0 : 1 - Math.exp(-dt * 4));
          jiggle = state.cheer && !still ? Math.max(jiggle, 0.45) : jiggle * Math.exp(-dt * 2.2);
          hop.set({
            params: {
              tint,
              time: now,
              look,
              jiggle: still ? 0 : jiggle,
              breed: morph,
              carrots: state.carrots,
            },
          });
        };

        let loop: { stop(): void } | undefined;
        const start = () => {
          if (loop || disposed) return;
          loop = frameLoop(gpu, (frame) => {
            tick();
            frame.pass(out, hop);
          });
        };
        const stop = () => {
          loop?.stop();
          loop = undefined;
        };

        if (still) {
          // Draw once now, and again whenever an answer changes.
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
    <div className="hp-mascot" data-ready={ready || undefined} aria-hidden="true">
      <img className="hp-still" src={BREEDS[breed]} alt="" />
      <canvas ref={canvasRef} className="hp-canvas" />
    </div>
  );
}
