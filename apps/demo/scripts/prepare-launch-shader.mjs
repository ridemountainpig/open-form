// Prepares forms/launch-rsvp/theme/scene.wgsl for vgpu at build time, so the browser
// never loads the WGSL parser (Open Form's Vite setup takes no loader plugins).
// Run after editing the shader: node scripts/prepare-launch-shader.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { prepareShader } from '@vgpu/wgsl/prepare';

const dir = new URL('../forms/launch-rsvp/theme/', import.meta.url);
const source = prepareShader(readFileSync(new URL('scene.wgsl', dir), 'utf8'));
writeFileSync(new URL('scene-shader.json', dir), `${JSON.stringify(source)}\n`);
console.log(`scene-shader.json: ${source.wgsl.length} chars of WGSL`);
