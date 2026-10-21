import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertReplaceable, BUILD_MARKER, unloadableThemes } from './build.ts';

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

describe('unloadableThemes', () => {
  it('names the references that fail to load, so the build can leave them out', async () => {
    const write = (file: string, source: string) => {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), source);
    };
    write('themes/good/index.ts', "export default { radius: '8px' };\n");
    write('themes/broken/index.ts', 'export default {\n');
    write('themes/bare/index.ts', 'export const radius = 8;\n');
    const broken = await unloadableThemes(root, {});
    expect(broken.map((theme) => theme.id).sort()).toEqual(['bare', 'broken']);
    expect(broken.find((theme) => theme.id === 'bare')?.error).toMatch(/no default export/);
  }, 30_000);

  it('leaves NODE_ENV as it found it, so the build after compiles for production', async () => {
    mkdirSync(path.join(root, 'themes', 'good'), { recursive: true });
    writeFileSync(path.join(root, 'themes', 'good', 'index.ts'), 'export default {};\n');
    const nodeEnv = process.env.NODE_ENV;
    delete process.env.NODE_ENV;
    try {
      await unloadableThemes(root, {});
      expect(process.env.NODE_ENV).toBeUndefined();
    } finally {
      process.env.NODE_ENV = nodeEnv;
    }
  }, 30_000);
});
