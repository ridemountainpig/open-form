import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { isFileLoadingAllowed, normalizePath, type ResolvedConfig, resolveConfig } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createViteConfig, devServerDeny } from './config.ts';

let root: string;
let config: ResolvedConfig;
const at = (...parts: string[]) => normalizePath(path.join(root, ...parts));

beforeAll(async () => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form deny (1)-'));
  config = await resolveConfig(
    {
      root,
      configFile: false,
      logLevel: 'silent',
      server: {
        fs: { allow: [root], deny: devServerDeny(path.join(root, 'data', 'responses[1].db')) },
      },
    },
    'serve',
  );
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('devServerDeny', () => {
  it('keeps responses and the secret out of the dev server', () => {
    for (const file of [
      at('.open-form', 'secret'),
      at('.open-form', 'open-form.db'),
      at('.open-form', 'open-form.db-wal'),
      at('data', 'responses[1].db'),
      at('data', 'responses[1].db-shm'),
    ]) {
      expect(isFileLoadingAllowed(config, file), file).toBe(false);
    }
  });

  it('keeps other secrets, databases and exported responses out', () => {
    for (const file of [
      at('.envrc'),
      at('.dev.vars'),
      at('id_ed25519'),
      at('data', 'other.db'),
      at('data', 'cache.sqlite-wal'),
      at('responses.xlsx'),
      at('exports', 'meetup-responses-2026-10-11.csv'),
    ]) {
      expect(isFileLoadingAllowed(config, file), file).toBe(false);
    }
  });

  it("keeps Vite's own rules and still serves the project", () => {
    expect(isFileLoadingAllowed(config, at('.env'))).toBe(false);
    expect(isFileLoadingAllowed(config, at('.git', 'config'))).toBe(false);
    expect(isFileLoadingAllowed(config, at('forms', 'meetup', 'index.tsx'))).toBe(true);
    expect(isFileLoadingAllowed(config, at('data', 'cities.json'))).toBe(true);
  });
});

describe('createViteConfig', () => {
  it('serves forms the same runtime as the app, never a pre-bundled copy', async () => {
    const vite = await createViteConfig({ userCwd: root, config: {} });
    expect(vite.optimizeDeps?.exclude).toContain('@open-form-build/core');
  });
});
