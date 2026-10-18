import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forPackageManager, gitInit, scaffold, shellQuote } from './init.ts';

let root: string;

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'open-form-init-'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

describe('scaffold', () => {
  it('ignores runtime data, secrets and exports', async () => {
    await scaffold(root, { timeZone: 'UTC' });
    const ignored = readFileSync(path.join(root, '.gitignore'), 'utf8').split('\n');
    expect(ignored).toEqual(
      expect.arrayContaining([
        '.open-form/',
        '.env',
        '.env.*',
        '!.env.example',
        '/responses*.xlsx',
      ]),
    );
  });

  it('adds to an existing .gitignore instead of replacing it', async () => {
    writeFileSync(path.join(root, '.gitignore'), 'secrets/\nnode_modules');
    await scaffold(root, { timeZone: 'UTC' });
    const text = readFileSync(path.join(root, '.gitignore'), 'utf8');
    expect(text.startsWith('secrets/\nnode_modules\n')).toBe(true);
    expect(text).toContain('.open-form/');
    expect(text).toContain('\n.env\n');
    expect(text.match(/^node_modules$/gm)).toHaveLength(1);
  });

  it('keeps existing files and adds to an existing package.json', async () => {
    writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        scripts: { dev: 'next dev' },
        dependencies: { next: '16.0.0', '@open-form-build/core': '^0.1.0' },
        devDependencies: { react: '^18.3.0' },
      }),
    );
    writeFileSync(path.join(root, 'README.md'), '# My App\n');
    writeFileSync(path.join(root, 'CLAUDE.md'), 'my rules\n');

    const { kept, pkg } = await scaffold(root, { timeZone: 'UTC' });

    expect(kept).toEqual(['CLAUDE.md', 'README.md']);
    expect(readFileSync(path.join(root, 'README.md'), 'utf8')).toBe('# My App\n');
    expect(readFileSync(path.join(root, 'CLAUDE.md'), 'utf8')).toBe('my rules\n');
    expect(existsSync(path.join(root, 'forms/contact/index.tsx'))).toBe(true);
    expect(JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))).toEqual(pkg);
    expect(pkg.name).toBe('my-app');
    expect(pkg.type).toBeUndefined();
    expect(pkg.scripts).toMatchObject({ dev: 'next dev', build: 'open-form build' });
    expect(pkg.dependencies).toMatchObject({ next: '16.0.0', '@open-form-build/core': '^0.1.0' });
    expect(pkg.dependencies).not.toHaveProperty('react');
    expect(pkg.devDependencies).toMatchObject({ react: '^18.3.0', typescript: expect.any(String) });
  });

  it('names a new workspace after its folder', async () => {
    const target = path.join(root, 'My Forms');
    const { kept, pkg } = await scaffold(target, { timeZone: 'UTC', openFormVersion: 'link:x' });
    expect(kept).toEqual([]);
    expect(pkg).toMatchObject({ name: 'my-forms', type: 'module' });
    expect(pkg.dependencies?.['@open-form-build/core']).toBe('link:x');
  });

  it("writes the guides' commands for the workspace's package manager", async () => {
    await scaffold(root, { timeZone: 'UTC', pm: 'npm' });
    const agents = readFileSync(path.join(root, 'AGENTS.md'), 'utf8');
    expect(agents).not.toContain('pnpm');
    expect(agents).toMatch(/^npx open-form check \[id\] +# /m);
    expect(agents).toMatch(/^npm run dev +# /m);
    expect(agents).toContain('run `npm run sync:skills`');
    expect(readFileSync(path.join(root, 'README.md'), 'utf8')).not.toContain('pnpm');
    expect(readFileSync(path.join(root, 'themes/README.md'), 'utf8')).not.toContain('pnpm');
  });
});

describe('forPackageManager', () => {
  it('keeps a commands block lined up', () => {
    const text = [
      'pnpm dev                    # Studio',
      'pnpm exec open-form list    # forms',
      'pnpm exec open-form create <form> --theme <theme>   # a long one',
    ].join('\n');
    expect(forPackageManager(text, 'bun')).toBe(
      [
        'bun run dev                 # Studio',
        'bunx open-form list         # forms',
        'bunx open-form create <form> --theme <theme>   # a long one',
      ].join('\n'),
    );
    expect(forPackageManager(text, 'pnpm')).toBe(text);
  });
});

describe('gitInit', () => {
  const git = (cwd: string, ...args: string[]) =>
    execFileSync('git', args, { cwd, encoding: 'utf8', stdio: 'pipe' });

  beforeEach(() => {
    const empty = path.join(root, '.gitconfig');
    writeFileSync(empty, '');
    vi.stubEnv('GIT_CONFIG_GLOBAL', empty);
    vi.stubEnv('GIT_CONFIG_NOSYSTEM', '1');
    for (const name of ['NAME', 'EMAIL']) {
      vi.stubEnv(`GIT_AUTHOR_${name}`, undefined);
      vi.stubEnv(`GIT_COMMITTER_${name}`, undefined);
    }
    vi.stubEnv('EMAIL', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  const identity = (config: Record<string, string>) => {
    const entries = Object.entries(config);
    vi.stubEnv('GIT_CONFIG_COUNT', String(entries.length));
    entries.forEach(([key, value], i) => {
      vi.stubEnv(`GIT_CONFIG_KEY_${i}`, key);
      vi.stubEnv(`GIT_CONFIG_VALUE_${i}`, value);
    });
  };

  it('commits a new workspace', async () => {
    identity({ 'user.name': 'Test', 'user.email': 'test@example.com' });
    const ws = path.join(root, 'ws');
    mkdirSync(ws);
    writeFileSync(path.join(ws, 'a.txt'), 'a');
    expect(await gitInit(ws)).toEqual({ status: 'committed' });
    expect(git(ws, 'log', '--oneline').trim().split('\n')).toHaveLength(1);
  });

  it('leaves a workspace inside an existing repository to that repository', async () => {
    git(root, 'init', '-q');
    const ws = path.join(root, 'apps', 'forms');
    mkdirSync(ws, { recursive: true });
    expect(await gitInit(ws)).toEqual({ status: 'inside-repo' });
    expect(existsSync(path.join(ws, '.git'))).toBe(false);
  });

  it('reports a failed initial commit', async () => {
    identity({ 'user.useConfigOnly': 'true' });
    const ws = path.join(root, 'ws');
    mkdirSync(ws);
    writeFileSync(path.join(ws, 'a.txt'), 'a');
    const result = await gitInit(ws);
    expect(result.status).toBe('uncommitted');
    expect(result.status === 'uncommitted' && result.output.length > 0).toBe(true);
    expect(existsSync(path.join(ws, '.git'))).toBe(true);
  });
});

describe('shellQuote', () => {
  it('quotes only paths that need it', () => {
    expect(shellQuote('my-forms', false)).toBe('my-forms');
    expect(shellQuote('../apps/forms_v2', false)).toBe('../apps/forms_v2');
    expect(shellQuote('my 表單 forms', false)).toBe("'my 表單 forms'");
    expect(shellQuote("Amy's forms", false)).toBe("'Amy'\\''s forms'");
    expect(shellQuote('C:\\work\\forms', true)).toBe('C:\\work\\forms');
    expect(shellQuote('C:\\my forms', true)).toBe('"C:\\my forms"');
  });
});
