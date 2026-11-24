import type { ShaderSource } from '@vgpu/wgsl';
import { useEffect, useRef, useState } from 'react';
import still from './still.png';

// The launch stage on a WebGPU canvas, rendered by vgpu from scene.wgsl
// (prepared into scene-shader.json by scripts/prepare-launch-shader.mjs). One
// sphere per person coming, one small moon per session, and on success they
// melt into one drop. Without WebGPU, or with reduced motion before the GPU is
// up, a still of the same render shows.

// One device for the page, kept across remounts (React re-runs effects in dev).
let shared: Promise<import('vgpu').Gpu> | undefined;

type Props = { people: number; sessions: number; done: boolean };

export function Scene({ people, sessions, done }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ people, sessions, done, kick: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Object.assign(live.current, { people, sessions, done });
    live.current.kick += 1;
  }, [people, sessions, done]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !('gpu' in navigator)) return;
    let disposed = false;
    let teardown = () => {};

    void (async () => {
      try {
        const [{ clock, effect, frameLoop, init, surface }, shader] = await Promise.all([
          import('vgpu'),
          import('./scene-shader.json').then((m) => m.default as unknown as ShaderSource),
        ]);
        shared ??= init();
        const gpu = await shared;
        if (disposed) return;
        const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
        const out = surface(gpu, canvas, { dpr: [1, 1.75], clearColor: [0, 0, 0, 0] });
        const look = [0, 0];
        const aim = [0, 0];
        const eased = {
          people: live.current.people,
          sessions: live.current.sessions,
          merge: live.current.done ? 1 : 0,
        };
        let jiggle = 0;
        let seen = live.current.kick;
        const scene = effect(gpu, shader, {
          set: {
            params: {
              time: 2.2,
              aspect: 1,
              look,
              px: 0.004,
              ...eased,
              jiggle: 0,
            },
          },
        });
        await scene.compile(out);
        if (disposed) return out.dispose();
        out.onResize(({ width, height }) => {
          scene.set({ params: { aspect: width / height, px: 2 / height } });
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
          const now = reduced ? 2.2 : time.time;
          const dt = Math.min(0.1, Math.max(0, now - last));
          last = now;
          const state = live.current;
          if (state.kick !== seen) {
            seen = state.kick;
            jiggle = 1;
          }
          const ease = reduced ? 1 : 1 - Math.exp(-dt * 5);
          const goal = {
            people: state.people,
            sessions: state.sessions,
            merge: state.done ? 1 : 0,
          };
          for (const key of ['people', 'sessions', 'merge'] as const) {
            const next =
              eased[key] + (goal[key] - eased[key]) * (key === 'merge' ? ease * 0.4 : ease);
            eased[key] = Math.abs(goal[key] - next) < 0.002 ? goal[key] : next;
          }
          for (let i = 0; i < 2; i++)
            look[i] += (aim[i] * 2 - look[i]) * (reduced ? 0 : 1 - Math.exp(-dt * 4));
          jiggle *= Math.exp(-dt * 2.5);
          scene.set({ params: { time: now, look, jiggle: reduced ? 0 : jiggle, ...eased } });
        };

        let loop: { stop(): void } | undefined;
        const start = () => {
          if (loop || disposed) return;
          loop = frameLoop(gpu, (frame) => {
            tick();
            frame.pass(out, scene);
          });
        };
        const stop = () => {
          loop?.stop();
          loop = undefined;
        };

        if (reduced) {
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
    <div className="lr-scene" data-ready={ready || undefined} aria-hidden="true">
      <img className="lr-still" src={still} alt="" />
      <canvas ref={canvasRef} className="lr-canvas" />
    </div>
  );
}
