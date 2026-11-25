// Renders forms/dark-sky-camp/theme/still.png (and still-dark.png) with vgpu
// in Node: the picture the form shows where WebGPU isn't available. Run after
// editing the shader: node scripts/render-sky-still.mjs
// (needs a WebGPU adapter: `npx vgpu doctor`)
import { readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { effect, init, target } from 'vgpu/node';
import { SITES, shapeUniforms, WEEKENDS } from '../forms/dark-sky-camp/sky.ts';

const W = Number(process.env.W ?? 960);
const H = Number(process.env.H ?? 1000);
const dir = new URL('../forms/dark-sky-camp/theme/', import.meta.url);
const shader = prepareShader(readFileSync(new URL('scene.wgsl', dir), 'utf8'));
const still = { weekend: 'perseids', site: 'lake', tents: 2, sign: 'leo' };
const shots = process.env.SKY_SHOTS
  ? JSON.parse(process.env.SKY_SHOTS)
  : { 'still.png': { ...still, dark: 0 }, 'still-dark.png': { ...still, dark: 1 } };

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (bytes) => {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc(body), body.length + 4);
  return out;
};
const png = (rgba) => {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 3; c++) raw[y * (W * 3 + 1) + 1 + x * 3 + c] = rgba[(y * W + x) * 4 + c];
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0);
  head.writeUInt32BE(H, 4);
  head[8] = 8;
  head[9] = 2;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const gpu = await init();
const frame = target(gpu, { size: [W, H], format: 'rgba8unorm' });
for (const [file, shot] of Object.entries(shots)) {
  const weekend = WEEKENDS[shot.weekend ?? 'perseids'];
  const scene = effect(gpu, shader, {
    set: {
      params: {
        time: shot.time ?? 40,
        aspect: W / H,
        dark: shot.dark ?? 0,
        site: SITES[shot.site ?? 'lake'].index,
        milky: weekend.milky,
        meteors: weekend.meteors,
        tents: shot.tents ?? 0,
        reveal: shot.sign ? 1 : 0,
        fireball: shot.fireball ?? 0,
        look: [0, 0],
        ...shapeUniforms(shot.sign),
      },
    },
  });
  scene.draw(frame);
  writeFileSync(new URL(file, dir), png(await frame.color.read({ mipLevel: 0, region: 'all' })));
  console.log(file);
}
gpu.dispose();
