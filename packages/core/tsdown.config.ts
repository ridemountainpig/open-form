import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'schema/index': 'src/schema/index.ts',
    'server/index': 'src/server/index.ts',
    'sqlite/index': 'src/sqlite/index.ts',
    'postgres/index': 'src/postgres/index.ts',
    'node/index': 'src/node/index.ts',
    'vite/index': 'src/vite/index.ts',
    'next/index': 'src/next/index.ts',
    'cli/bin': 'src/cli/bin.ts',
  },
  format: 'esm',
  fixedExtension: false,
  target: 'node22',
  platform: 'node',
  clean: true,
  dts: true,
  shims: false,
  deps: { neverBundle: ['vite', 'react', 'react-dom', 'react-router-dom', 'pg', /^node:/] },
});
