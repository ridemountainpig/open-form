// Renders forms/hop/theme/stills/<breed>.png with vgpu in Node: the picture
// the form shows where WebGPU isn't available. Run after editing the shader:
// node scripts/render-hop-stills.mjs (needs a WebGPU adapter: `npx vgpu doctor`)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import zlib from 'node:zlib';
import { prepareShader } from '@vgpu/wgsl/prepare';
import { effect, init, target } from 'vgpu/node';

const BREEDS = ['upright', 'lop', 'lionhead', 'dwarf'];
const SILVER = [0.97, 0.96, 0.95];
const W = 720;
const H = 600;
const dir = new URL('../forms/hop/theme/', import.meta.url);
const outDir = process.env.HOP_STILLS_DIR
  ? new URL(`file://${process.env.HOP_STILLS_DIR}/`)
  : new URL('stills/', dir);
const shader = prepareShader(readFileSync(new URL('hop.wgsl', dir), 'utf8'));

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
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const o = y * (W * 4 + 1) + 1 + x * 4;
      const a = rgba[i + 3];
      // the shader writes premultiplied color; PNG wants it straight
      for (let c = 0; c < 3; c++)
        raw[o + c] = a ? Math.min(255, Math.round((rgba[i + c] * 255) / a)) : 0;
      raw[o + 3] = a;
    }
  }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(W, 0);
  head.writeUInt32BE(H, 4);
  head[8] = 8;
  head[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

const gpu = await init();
const frame = target(gpu, { size: [W, H], format: 'rgba8unorm' });
mkdirSync(outDir, { recursive: true });
for (const [breed, name] of BREEDS.entries()) {
  const hop = effect(gpu, shader, {
    set: {
      params: {
        tint: SILVER,
        time: 1.3,
        look: [0, 0],
        aspect: W / H,
        jiggle: 0,
        px: 2 / H,
        blush: 1,
        breed,
        carrots: Number(process.env.HOP_CARROTS ?? 2),
      },
    },
  });
  hop.draw(frame);
  const pixels = await frame.color.read({ mipLevel: 0, region: 'all' });
  writeFileSync(new URL(`${name}.png`, outDir), png(pixels));
  console.log(`${name}.png`);
}
gpu.dispose();
