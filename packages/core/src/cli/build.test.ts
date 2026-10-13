import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertReplaceable, BUILD_MARKER } from './build.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-build-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const put = (file: string) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), '');
};

describe('assertReplaceable', () => {
  it("won't empty folders an earlier build didn't write, inside the project too", () => {
    put('src/server/entry.js');
    put('src/server/actions.ts');
    expect(() => assertReplaceable(root, path.join(root, 'src'))).toThrow(
      /isn't from an Open Form build/,
    );
    put('out/client/index.html');
    expect(() => assertReplaceable(root, path.join(root, 'out'))).toThrow(/client/);
    expect(() => assertReplaceable(root, root)).not.toThrow();
    put('server/db.ts');
    expect(() => assertReplaceable(root, root)).toThrow(/server/);
  });

  it('replaces the default dist, empty folders and its own output', () => {
    put('dist/server/notes.txt');
    expect(() => assertReplaceable(root, path.join(root, 'dist'))).not.toThrow();
    mkdirSync(path.join(root, 'build', 'server'), { recursive: true });
    expect(() => assertReplaceable(root, path.join(root, 'build'))).not.toThrow();
    put('build/server/entry.js');
    put(`build/${BUILD_MARKER}`);
    expect(() => assertReplaceable(root, path.join(root, 'build'))).not.toThrow();
    expect(() => assertReplaceable(root, path.join(os.tmpdir(), 'nope-open-form'))).not.toThrow();
  });
});
