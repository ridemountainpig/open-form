import type { ShaderSource } from '@vgpu/wgsl';
import { useEffect, useRef, useState } from 'react';
import type { useCamp } from '../camp.tsx';
import { SITES, shapeUniforms, WEEKENDS } from '../sky.ts';
import still from './still.png';
import stillDark from './still-dark.png';

// The sky on a WebGPU canvas, rendered by vgpu from scene.wgsl (prepared into
// scene-shader.json by scripts/prepare-sky-shader.mjs). The weekend, site and
// group ease the sky and horizon towards their new look, a birthday draws its
// star sign, and success sends one bright meteor across. Without WebGPU a
// still of the same render shows.

let shared: Promise<import('vgpu').Gpu> | undefined;

type Camp = ReturnType<typeof useCamp>;

function isDark(el: Element) {
  const scheme = el.closest<HTMLElement>('[data-scheme]')?.dataset.scheme;
  if (scheme === 'dark' || scheme === 'light') return scheme === 'dark' ? 1 : 0;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
}

function goal(camp: Camp) {
  const weekend = WEEKENDS[camp.weekend ?? 'perseids'];
  return {
    site: SITES[camp.site ?? 'dunes'].index,
    milky: camp.weekend ? weekend.milky : 0.7,
    meteors: camp.weekend ? weekend.meteors : 0.35,
    tents: camp.group,
  };
}

export function Scene({ camp, done }: { camp: Camp; done: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const live = useRef({ camp, done });
  const [ready, setReady] = useState(false);
  live.current.camp = camp;
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
        const now = () => (reduced ? 40 : time.time + 40);

        const eased = goal(live.current.camp);
        let sign = live.current.camp.sign;
        let reveal = sign ? 1 : 0;
        let fireball = live.current.done ? 1 : 0;
        const look = [0, 0];
        const aim = [0, 0];
        let dark = isDark(canvas);
        const params = () => ({
          dark,
          ...eased,
          reveal,
          fireball,
          look,
          ...shapeUniforms(sign),
        });

        const scene = effect(gpu, shader, {
          set: { params: { time: now(), aspect: 1, ...params() } },
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
        let wasDone = live.current.done;
        const tick = () => {
          const t = now();
          const dt = Math.min(0.1, Math.max(0, t - last));
          last = t;
          const state = live.current;
          if (frames++ % 30 === 0) dark = isDark(canvas);
          const g = goal(state.camp);
          const ease = reduced ? 1 : 1 - Math.exp(-dt * 1.6);
          for (const k of ['site', 'milky', 'meteors', 'tents'] as const)
            eased[k] += (g[k] - eased[k]) * ease;
          if (state.camp.sign !== sign) {
            sign = state.camp.sign;
            reveal = 0;
          }
          reveal = sign ? Math.min(1, reveal + (reduced ? 1 : dt / 2.4)) : 0;
          if (state.done && !wasDone) fireball = 0;
          wasDone = state.done;
          if (state.done && fireball < 1)
            fireball = Math.min(1, fireball + (reduced ? 1 : dt / 2.2));
          for (let i = 0; i < 2; i++)
            look[i] += (aim[i] - look[i]) * (reduced ? 0 : 1 - Math.exp(-dt * 2));
          scene.set({ params: { time: t, ...params() } });
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
            const c = live.current.camp;
            const mark = JSON.stringify([c.weekend, c.site, c.group, c.sign, isDark(canvas)]);
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
    <div className="ds-scene" data-ready={ready || undefined} aria-hidden="true">
      <img className="ds-still ds-still-light" src={still} alt="" />
      <img className="ds-still ds-still-dark" src={stillDark} alt="" />
      <canvas ref={canvasRef} className="ds-canvas" />
    </div>
  );
}
