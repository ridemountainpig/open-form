import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadDotEnv } from './run.ts';

describe('loadDotEnv', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'open-form-env-'));
  afterEach(() => {
    delete process.env.OF_TEST_FROM_FILE;
    delete process.env.OF_TEST_FROM_SHELL;
  });

  it('fills in variables from .env without overriding the environment', () => {
    writeFileSync(path.join(dir, '.env'), 'OF_TEST_FROM_FILE=file\nOF_TEST_FROM_SHELL=file\n');
    process.env.OF_TEST_FROM_SHELL = 'shell';
    loadDotEnv(dir);
    expect(process.env.OF_TEST_FROM_FILE).toBe('file');
    expect(process.env.OF_TEST_FROM_SHELL).toBe('shell');
    rmSync(path.join(dir, '.env'));
  });

  it('does nothing without a .env file', () => {
    expect(() => loadDotEnv(dir)).not.toThrow();
    expect(process.env.OF_TEST_FROM_FILE).toBeUndefined();
  });
});
