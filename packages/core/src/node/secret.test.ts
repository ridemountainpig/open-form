import { chmodSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSecret } from './secret.ts';

let root: string;
const mode = (file: string) => statSync(file).mode & 0o777;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-secret-'));
  vi.stubEnv('OPEN_FORM_SECRET', '');
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

describe.runIf(process.platform !== 'win32')('resolveSecret', () => {
  it('creates an owner-only secret and keeps it across calls', () => {
    const secret = resolveSecret(root);
    expect(secret).toHaveLength(64);
    expect(mode(path.join(root, '.open-form', 'secret'))).toBe(0o600);
    expect(resolveSecret(root)).toBe(secret);
  });

  it('tightens a secret file that was readable by everyone', () => {
    const file = path.join(root, '.open-form', 'secret');
    mkdirSync(path.dirname(file));
    writeFileSync(file, 'an-existing-secret-0123456789\n');
    chmodSync(file, 0o644);
    expect(resolveSecret(root)).toBe('an-existing-secret-0123456789');
    expect(mode(file)).toBe(0o600);
  });
});
