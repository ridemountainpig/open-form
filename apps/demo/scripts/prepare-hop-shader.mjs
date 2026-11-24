// Prepares forms/hop/theme/hop.wgsl for vgpu at build time, so the browser
// never loads the WGSL parser (Open Form's Vite setup takes no loader plugins).
// Run after editing the shader: node scripts/prepare-hop-shader.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { prepareShader } from '@vgpu/wgsl/prepare';

const dir = new URL('../forms/hop/theme/', import.meta.url);
const source = prepareShader(readFileSync(new URL('hop.wgsl', dir), 'utf8'));
writeFileSync(new URL('hop-shader.json', dir), `${JSON.stringify(source)}\n`);
console.log(`hop-shader.json: ${source.wgsl.length} chars of WGSL`);
