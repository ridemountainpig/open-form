import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizePath } from 'vite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serverEntryModule, themesModule } from './forms-plugin.ts';
import { locPlugin } from './loc-plugin.ts';
import { projectPaths } from './project.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-entry-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('serverEntryModule', () => {
  it('imports open-form.config.ts so process.env is read when the server starts', async () => {
    const file = path.join(root, 'open-form.config.ts');
    writeFileSync(
      file,
      `export default { webhooks: [{ url: process.env.HOOK_URL ?? 'https://hooks.example/inlined' }] };\n`,
    );
    const code = await serverEntryModule(projectPaths(root, {}));
    expect(code).toContain(
      `export { default as config } from ${JSON.stringify(normalizePath(file))};`,
    );
    expect(code).not.toContain('hooks.example');
  });

  it('exports an empty config without a config file', async () => {
    expect(await serverEntryModule(projectPaths(root, {}))).toContain('export const config = {};');
  });

  it('carries the folders manifest for signed-in Studio', async () => {
    mkdirSync(path.join(root, 'forms'), { recursive: true });
    writeFileSync(
      path.join(root, 'forms', '.folders.json'),
      JSON.stringify({
        folders: [{ id: 'f-12345678', name: 'Events', icon: { type: 'emoji', value: '🎉' } }],
        assignments: {},
      }),
    );
    expect(await serverEntryModule(projectPaths(root, {}))).toContain('"name":"Events"');
  });
});

describe('themes are references', () => {
  it('builds each theme and its THEME.md for Studio, in dev and production', async () => {
    const dir = path.join(root, 'themes', 'brand');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'index.ts'), 'export default {};\n');
    writeFileSync(
      path.join(dir, 'THEME.md'),
      '---\nname: Brand\ndescription: Ours.\n---\n\n# Brand\n',
    );
    const paths = projectPaths(root, {});
    const prod = await themesModule(paths, false);
    expect(prod).toContain('"name":"Brand","description":"Ours."');
    expect(prod).toContain('"file":"themes/brand/index.ts"');
    expect(prod).toContain(`import(${JSON.stringify(path.join(dir, 'index.ts'))})`);
    expect(prod).not.toContain('import.meta.hot');
    expect(await themesModule(paths, true)).toContain('"name":"Brand"');
    const skipped = await themesModule(paths, false, ['brand']);
    expect(skipped).toContain('export const themes = [];');
    expect(skipped).not.toContain('import(');
  });

  it("doesn't tag a form's own theme for Edit mode", () => {
    const paths = projectPaths(root, {});
    const plugin = locPlugin(paths) as { transform: (code: string, id: string) => unknown };
    const code = 'export default function A() { return <div>Hi</div>; }\n';
    const tagged = plugin.transform(code, path.join(paths.formsRoot, 'meetup', 'index.tsx'));
    expect(JSON.stringify(tagged)).toContain('data-of-loc');
    expect(plugin.transform(code, path.join(paths.formsRoot, 'meetup', 'theme', 'index.tsx'))).toBe(
      null,
    );
  });
});
