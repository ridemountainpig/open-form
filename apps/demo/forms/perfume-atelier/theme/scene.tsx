import type { ShaderSource } from '@vgpu/wgsl';
import { useEffect, useRef, useState } from 'react';
import type { useBlend } from '../blend.tsx';
import { CONCENTRATION, LAYERS } from '../notes.ts';
import still from './still.png';
import stillDark from './still-dark.png';

// The tank on a WebGPU canvas, rendered by vgpu from scene.wgsl (prepared
// into scene-shader.json by scripts/prepare-perfume-shader.mjs). Picking a
// note drops its ink in; picking another for the same layer drops the new ink
// while the old one fades. On success it all turns into one slow vortex.
// Without WebGPU a still of the same render shows.

let shared: Promise<import('vgpu').Gpu> | undefined;

type Blend = ReturnType<typeof useBlend>;

function isDark(el: Element) {
  const scheme = el.closest<HTMLElement>('[data-scheme]')?.dataset.scheme;
  if (scheme === 'dark' || scheme === 'light') return scheme === 'dark' ? 1 : 0;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
}

export function Scene({ blend, done }: { blend: Blend; done: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ notes: blend.notes as readonly (string | undefined)[], blend, done });
  const [ready, setReady] = useState(false);
  live.current.blend = blend;
  live.current.done = done;

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
        const out = surface(gpu, canvas, { dpr: [1, 1.5] });
        const time = clock(gpu);
        const now = () => (reduced ? 30 : time.time + 30);

        // slot 2i is layer i's ink, slot 2i + 1 the ink it replaced, fading out
        const ink = Array.from({ length: 6 }, () => [0, 0, 0, 0]);
        const drop = Array.from({ length: 6 }, (_, s) => {
          const layer = LAYERS[Math.floor(s / 2)];
          return [layer.x, 0, layer.depth, s * 1.37 + 0.4];
        });
        const fell = Array.from({ length: 6 }, () => -100);
        const shown: (string | undefined)[] = [undefined, undefined, undefined];
        let seed = 0;
        const sync = (t: number, instant: boolean) => {
          live.current.blend.notes.forEach((note, i) => {
            if (note === shown[i]) return;
            shown[i] = note;
            const cur = i * 2;
            const old = cur + 1;
            ink[old] = [...ink[cur]];
            drop[old] = [...drop[cur]];
            fell[old] = fell[cur];
            const table = LAYERS[i].table as Record<string, { ink: readonly number[] }>;
            const color = note ? table[note]?.ink : undefined;
            ink[cur] = color ? [...color, 1] : [0, 0, 0, 0];
            seed += 1.618;
            drop[cur] = [LAYERS[i].x, 0, LAYERS[i].depth, i * 1.37 + seed];
            fell[cur] = instant || reduced ? t - 12 : t;
          });
        };
        sync(now(), true);
        const strengthOf = () => {
          const c = live.current.blend.concentration;
          return c ? CONCENTRATION[c].strength : 1;
        };
        const eased = { strength: strengthOf(), swirl: live.current.done ? 1 : 0 };
        const look = [0, 0];
        const aim = [0, 0];
        let dark = isDark(canvas);

        const scene = effect(gpu, shader, {
          set: {
            params: {
              time: now(),
              aspect: 1,
              dark,
              strength: eased.strength,
              swirl: eased.swirl,
              calm: eased.swirl,
              look,
              ink,
              drop,
            },
          },
        });
        await scene.compile(out);
        if (disposed) return out.dispose();
        out.onResize(({ width, height }) => scene.set({ params: { aspect: width / height } }));

        const onPointer = (event: PointerEvent) => {
          aim[0] = Math.max(-1, Math.min(1, (event.clientX / innerWidth) * 2 - 1));
          aim[1] = Math.max(-1, Math.min(1, (event.clientY / innerHeight) * 2 - 1));
        };

        let last = now();
        let frames = 0;
        const tick = () => {
          const t = now();
          const dt = Math.min(0.1, Math.max(0, t - last));
          last = t;
          sync(t, false);
          if (frames++ % 30 === 0) dark = isDark(canvas);
          const ease = reduced ? 1 : 1 - Math.exp(-dt * 1.5);
          eased.strength += (strengthOf() - eased.strength) * ease;
          eased.swirl +=
            ((live.current.done ? 1 : 0) - eased.swirl) * (reduced ? 1 : 1 - Math.exp(-dt * 0.5));
          for (let s = 0; s < 6; s++) {
            drop[s][1] = Math.max(0, t - fell[s]);
            if (s % 2 === 1) ink[s][3] = Math.max(0, ink[s][3] - dt * 0.45);
          }
          for (let i = 0; i < 2; i++)
            look[i] += (aim[i] - look[i]) * (reduced ? 0 : 1 - Math.exp(-dt * 2));
          scene.set({
            params: {
              time: t,
              dark,
              strength: eased.strength,
              swirl: eased.swirl,
              calm: eased.swirl,
              look,
              ink,
              drop,
            },
          });
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
          let drawn = '';
          const id = setInterval(() => {
            const mark = JSON.stringify([
              live.current.blend.notes,
              live.current.done,
              isDark(canvas),
            ]);
            if (drawn === mark) return;
            drawn = mark;
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
    <div className="pa-scene" data-ready={ready || undefined} aria-hidden="true">
      <img className="pa-still pa-still-light" src={still} alt="" />
      <img className="pa-still pa-still-dark" src={stillDark} alt="" />
      <canvas ref={canvasRef} className="pa-canvas" />
    </div>
  );
}
