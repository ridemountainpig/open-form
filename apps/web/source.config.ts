import { metaSchema, pageSchema } from 'fumadocs-core/source/schema';
import { defineConfig, defineDocs } from 'fumadocs-mdx/config';
import { ADD, EXEC, type PackageManager, RUN } from '../../packages/core/src/cli/package-managers';

export const docs = defineDocs({
  dir: 'content/docs',
  docs: {
    // `seoTitle` names the page in search results; `title` stays short for the sidebar.
    schema: pageSchema.extend({ seoTitle: pageSchema.shape.title.optional() }),
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

const ENV_PREFIX = /^(\s*(?:[A-Z_][A-Z0-9_]*=(?:'[^']*'|"[^"]*"|\S*)\s+)*)(.*)$/;

const RULES: [RegExp, (m: RegExpExecArray, pm: PackageManager) => string][] = [
  [/^npx (open-form\b.*)$/, (m, pm) => `${EXEC[pm]} ${m[1]}`],
  [/^npm run (\S.*)$/, (m, pm) => `${RUN[pm]} ${m[1]}`],
  [/^npm start\b(.*)$/, (m, pm) => `${RUN[pm]} start${m[1]}`],
  [/^npm install (\S.*)$/, (m, pm) => `${ADD[pm]} ${m[1]}`],
  // `create` fetches the newest scaffolder in every manager; only npm takes `@latest`.
  [/^npm create (\S+?)(?:@latest)?(\s.*)?$/, (m, pm) => `${pm} create ${m[1]}${m[2] ?? ''}`],
];

function convertLine(line: string, pm: PackageManager): string {
  if (pm === 'npm') return line;
  const [, env = '', cmd = line] = ENV_PREFIX.exec(line) ?? [];
  for (const [pattern, to] of RULES) {
    const m = pattern.exec(cmd);
    if (m) return env + to(m, pm);
  }
  return line;
}

/** Lines whose trailing comments were aligned stay aligned after the command changes length. */
function alignComments(lines: string[]): string[] {
  const parts = lines.map((line) => /^(.*?\S)\s{2,}(#.*)$/.exec(line));
  const commented = parts.filter((p) => p !== null);
  if (commented.length < 2) return lines;
  const width = Math.max(...commented.map((p) => p[1].length));
  return lines.map((line, i) => {
    const p = parts[i];
    return p ? `${p[1].padEnd(width + 2)}${p[2]}` : line;
  });
}

function command(pm: PackageManager) {
  return (code: string) =>
    alignComments(code.split('\n').map((l) => convertLine(l, pm))).join('\n');
}

export default defineConfig({
  mdxOptions: {
    remarkNpmOptions: {
      persist: { id: 'package-manager' },
      packageManagers: (['npm', 'pnpm', 'yarn', 'bun'] as const).map((name) => ({
        name,
        command: command(name),
      })),
    },
  },
});
