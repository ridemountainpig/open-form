import type { ShaderSource } from '@vgpu/wgsl';
import { useEffect, useRef, useState } from 'react';
import { ICE, SWEETNESS, TEAS } from '../menu.ts';
import type { Order } from '../order.tsx';
import still from './still.png';

// The cup on the counter, on a WebGPU canvas rendered by vgpu from scene.wgsl
// (prepared into scene-shader.json by scripts/prepare-tea-shader.mjs). Every
// answer eases the drink towards its new look, and a change sloshes it.
// Without WebGPU a still of the same render shows.

let shared: Promise<import('vgpu').Gpu> | undefined;

const EMPTY = [0.93, 0.9, 0.84, 0.25];

function goal(order: Order, done: boolean) {
  const tint = order.tea ? TEAS[order.tea].tint : EMPTY;
  return {
    tint: [...tint],
    size: order.size === 'm' ? 0 : 1,
    sweet: order.sweetness ? SWEETNESS[order.sweetness].level : 0,
    ice: order.ice ? ICE[order.ice].cubes : 0,
    hot: order.ice === 'hot' ? 1 : 0,
    pearls: order.toppings.includes('pearls') ? 1 : 0,
    jelly: order.toppings.includes('jelly') ? 1 : 0,
    pudding: order.toppings.includes('pudding') ? 1 : 0,
    tiger: order.tea === 'sugar' ? 1 : 0,
    done: done ? 1 : 0,
    fill: order.tea ? 1 : 0,
  };
}

type Goal = ReturnType<typeof goal>;

function isDark(el: Element) {
  const scheme = el.closest<HTMLElement>('[data-scheme]')?.dataset.scheme;
  if (scheme === 'dark' || scheme === 'light') return scheme === 'dark' ? 1 : 0;
  return matchMedia('(prefers-color-scheme: dark)').matches ? 1 : 0;
}

export function Scene({ order, done }: { order: Order; done: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const target = goal(order, done);
  const key = JSON.stringify(target);
  const live = useRef({ goal: target, kick: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    live.current.goal = JSON.parse(key) as Goal;
    live.current.kick += 1;
  }, [key]);

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
        const now0 = live.current.goal;
        const eased: Goal = { ...now0, tint: [...now0.tint] };
        const look = [0, 0];
        const aim = [0, 0];
        let jiggle = 0;
        let seen = live.current.kick;
        let dark = isDark(canvas);
        const uniforms = () => ({
          tea: eased.tint,
          size: eased.size,
          sweet: eased.sweet,
          ice: eased.ice,
          hot: eased.hot,
          pearls: eased.pearls,
          jelly: eased.jelly,
          pudding: eased.pudding,
          tiger: eased.tiger,
          done: eased.done,
          fill: eased.fill,
        });
        const scene = effect(gpu, shader, {
          set: {
            params: { time: 2, aspect: 1, look, px: 0.004, dark, jiggle: 0, ...uniforms() },
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
        let frames = 0;
        const tick = () => {
          const now = reduced ? 2 : time.time;
          const dt = Math.min(0.1, Math.max(0, now - last));
          last = now;
          const state = live.current;
          if (state.kick !== seen) {
            seen = state.kick;
            jiggle = 1;
          }
          if (frames++ % 30 === 0) dark = isDark(canvas);
          const ease = reduced ? 1 : 1 - Math.exp(-dt * 3);
          const g = state.goal;
          for (let i = 0; i < 4; i++) eased.tint[i] += (g.tint[i] - eased.tint[i]) * ease;
          for (const k of ['size', 'sweet', 'ice', 'hot', 'tiger'] as const)
            eased[k] += (g[k] - eased[k]) * ease;
          // toppings fall in at a steady pace, so each one is seen dropping
          for (const k of ['pearls', 'jelly', 'pudding', 'done', 'fill'] as const) {
            const topping = k === 'pearls' || k === 'jelly' || k === 'pudding';
            // a topping taken out flips negative, which the shader shrinks away
            if (topping && g[k] === 0 && eased[k] > 0) eased[k] = -eased[k];
            const step = reduced ? 1 : dt * (topping ? 0.9 : 0.7);
            eased[k] += Math.max(-step, Math.min(step, g[k] - eased[k]));
          }
          for (let i = 0; i < 2; i++)
            look[i] += (aim[i] - look[i]) * (reduced ? 0 : 1 - Math.exp(-dt * 3));
          jiggle *= Math.exp(-dt * 1.8);
          scene.set({
            params: { time: now, look, dark, jiggle: reduced ? 0 : jiggle, ...uniforms() },
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
          let drawn = -1;
          const id = setInterval(() => {
            const mark = live.current.kick * 2 + isDark(canvas);
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
    <div className="tea-scene" data-ready={ready || undefined} aria-hidden="true">
      <img className="tea-still" src={still} alt="" />
      <canvas ref={canvasRef} className="tea-canvas" />
    </div>
  );
}
