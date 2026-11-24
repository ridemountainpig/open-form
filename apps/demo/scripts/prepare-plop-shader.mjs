// Prepares forms/plop/theme/plop.wgsl for vgpu at build time, so the browser
// never loads the WGSL parser (Open Form's Vite setup takes no loader plugins).
// Run after editing the shader: node scripts/prepare-plop-shader.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { prepareShader } from '@vgpu/wgsl/prepare';

const dir = new URL('../forms/plop/theme/', import.meta.url);
const source = prepareShader(readFileSync(new URL('plop.wgsl', dir), 'utf8'));
writeFileSync(new URL('plop-shader.json', dir), `${JSON.stringify(source)}\n`);
console.log(`plop-shader.json: ${source.wgsl.length} chars of WGSL`);
