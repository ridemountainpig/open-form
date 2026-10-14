import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { assertWorkspace, isWorkspace, loadUserConfig } from './project.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-config-'));
  // An ESM-only dependency, like `open-form` itself.
  const dep = path.join(root, 'node_modules', 'esm-only');
  mkdirSync(dep, { recursive: true });
  writeFileSync(
    path.join(dep, 'package.json'),
    JSON.stringify({ name: 'esm-only', type: 'module', exports: { import: './index.js' } }),
  );
  writeFileSync(path.join(dep, 'index.js'), "export const timeZone = 'Asia/Taipei';\n");
  writeFileSync(
    path.join(root, 'open-form.config.ts'),
    "import { timeZone } from 'esm-only';\nexport default { timeZone: timeZone as string };\n",
  );
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('loadUserConfig', () => {
  it('loads an ESM config in a package that is "type": "module"', async () => {
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    expect(await loadUserConfig(root)).toEqual({ timeZone: 'Asia/Taipei' });
  });

  it('loads an ESM config in a package that is not "type": "module"', async () => {
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'legacy-app' }));
    expect(await loadUserConfig(root)).toEqual({ timeZone: 'Asia/Taipei' });
  });

  it('leaves NODE_ENV as it found it, so a later build is a production build', async () => {
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ type: 'module' }));
    vi.stubEnv('NODE_ENV', undefined);
    try {
      expect(Object.hasOwn(process.env, 'NODE_ENV')).toBe(false);
      await loadUserConfig(root);
      expect(Object.hasOwn(process.env, 'NODE_ENV')).toBe(false);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('returns an empty config without a file', async () => {
    rmSync(path.join(root, 'open-form.config.ts'));
    expect(await loadUserConfig(root)).toEqual({});
  });
});

describe('isWorkspace', () => {
  it('needs open-form.config.ts or a dependency on open-form', () => {
    expect(isWorkspace(root)).toBe(true);
    rmSync(path.join(root, 'open-form.config.ts'));
    expect(isWorkspace(root)).toBe(false);
    expect(() => assertWorkspace(root, 'dev')).toThrow(/npm create open-form@latest/);
    writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'blog' }));
    expect(isWorkspace(root)).toBe(false);
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ devDependencies: { '@open-form-build/core': '^0.1.0' } }),
    );
    expect(isWorkspace(root)).toBe(true);
  });

  it('is not fooled by a broken package.json', () => {
    rmSync(path.join(root, 'open-form.config.ts'));
    writeFileSync(path.join(root, 'package.json'), '{ "dependencies": { "@open-form-build/core": ');
    expect(isWorkspace(root)).toBe(false);
  });
});
