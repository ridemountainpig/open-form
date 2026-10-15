import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveSecret } from './secret.ts';

let root: string;
const mode = (file: string) => statSync(file).mode & 0o777;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-secret-'));
  vi.stubEnv('OPEN_FORM_SECRET', '');
  vi.stubEnv('OPEN_FORM_DB', '');
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

  it('keeps the secret next to a database outside .open-form', () => {
    const database = path.join(root, 'volume', 'forms.db');
    const secret = resolveSecret(root, database);
    expect(readFileSync(path.join(root, 'volume', 'secret'), 'utf8').trim()).toBe(secret);
    expect(existsSync(path.join(root, '.open-form'))).toBe(false);
  });

  it('follows OPEN_FORM_DB when no database path is given', () => {
    vi.stubEnv('OPEN_FORM_DB', 'volume/forms.db');
    const secret = resolveSecret(root);
    expect(readFileSync(path.join(root, 'volume', 'secret'), 'utf8').trim()).toBe(secret);
  });

  it('carries the secret over from .open-form when the database lives elsewhere', () => {
    mkdirSync(path.join(root, '.open-form'));
    writeFileSync(path.join(root, '.open-form', 'secret'), 'an-earlier-secret-0123456789\n');
    const database = path.join(root, 'volume', 'forms.db');
    expect(resolveSecret(root, database)).toBe('an-earlier-secret-0123456789');
    expect(mode(path.join(root, 'volume', 'secret'))).toBe(0o600);
  });

  it('prefers OPEN_FORM_SECRET and writes nothing', () => {
    vi.stubEnv('OPEN_FORM_SECRET', 'from-the-environment-0123456789');
    expect(resolveSecret(root, path.join(root, 'volume', 'forms.db'))).toBe(
      'from-the-environment-0123456789',
    );
    expect(existsSync(path.join(root, 'volume'))).toBe(false);
  });
});
