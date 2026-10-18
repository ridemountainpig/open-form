import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/shared';
import { source } from '@/lib/source';

const cwd = process.cwd();
const docsRoot = path.resolve(cwd, 'content/docs');
const homePath = path.resolve(cwd, 'app/(home)/page.tsx');

function resolvePagePath(slugs: readonly string[]): string | null {
  const candidates =
    slugs.length === 0
      ? [path.join(docsRoot, 'index.mdx')]
      : [`${path.join(docsRoot, ...slugs)}.mdx`, path.join(docsRoot, ...slugs, 'index.mdx')];
  return candidates.find((c) => existsSync(c)) ?? null;
}

function git(args: string[]): string | null {
  try {
    return execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return null;
  }
}

// A build without history (no .git, or a shallow clone) would stamp every page
// with the same date, which teaches search engines to ignore lastmod; leave it out.
const hasHistory = git(['rev-parse', '--is-shallow-repository']) === 'false';

function gitMtime(file: string | null): Date | undefined {
  if (!hasHistory || !file) return undefined;
  const stdout = git(['log', '-1', '--format=%cI', '--', file]);
  const d = stdout ? new Date(stdout) : null;
  return d && !Number.isNaN(d.getTime()) ? d : undefined;
}

export default function sitemap(): MetadataRoute.Sitemap {
  const docs: MetadataRoute.Sitemap = source.getPages().map((page) => {
    return {
      url: `${siteUrl}${page.url}`,
      lastModified: gitMtime(resolvePagePath(page.slugs)),
      changeFrequency: 'weekly',
      priority: 0.7,
    };
  });

  return [
    {
      url: siteUrl,
      lastModified: gitMtime(existsSync(homePath) ? homePath : null),
      changeFrequency: 'weekly',
      priority: 1,
    },
    ...docs,
  ];
}
