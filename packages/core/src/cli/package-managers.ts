// The commands `open-form init` writes into a workspace's guides, per package
// manager. The docs site's install tabs read them too, so the two always agree;
// keep this module free of imports.

export const PACKAGE_MANAGERS = ['pnpm', 'npm', 'yarn', 'bun'] as const;
export type PackageManager = (typeof PACKAGE_MANAGERS)[number];

/** Runs a dependency's binary: `pnpm exec open-form check`. */
export const EXEC: Record<PackageManager, string> = {
  pnpm: 'pnpm exec',
  npm: 'npx',
  yarn: 'yarn',
  bun: 'bunx',
};

/** Runs a `package.json` script: `pnpm dev`. */
export const RUN: Record<PackageManager, string> = {
  pnpm: 'pnpm',
  npm: 'npm run',
  yarn: 'yarn',
  bun: 'bun run',
};

/** Adds a dependency: `pnpm add`. */
export const ADD: Record<PackageManager, string> = {
  pnpm: 'pnpm add',
  npm: 'npm install',
  yarn: 'yarn add',
  bun: 'bun add',
};
