import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
  MarkdownCopyButton,
  ViewOptionsPopover,
} from 'fumadocs-ui/layouts/docs/page';
import { createRelativeLink } from 'fumadocs-ui/mdx';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getMDXComponents } from '@/components/mdx';
import { appName, gitConfig, repoUrl, siteUrl } from '@/lib/shared';
import { getPageImage, getPageMarkdownUrl, source } from '@/lib/source';

export default async function Page(props: PageProps<'/docs/[[...slug]]'>) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDX = page.data.body;
  const markdownUrl = getPageMarkdownUrl(page).url;
  const url = `${siteUrl}${page.url}`;
  const crumbs = [
    { name: appName, url: siteUrl },
    { name: 'Docs', url: `${siteUrl}/docs` },
    ...(page.url === '/docs' ? [] : [{ name: page.data.title, url }]),
  ];
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: crumbs.map((crumb, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: crumb.name,
        item: crumb.url,
      })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      headline: page.data.seoTitle ?? page.data.title,
      description: page.data.description,
      url,
      inLanguage: 'en',
      image: `${siteUrl}${getPageImage(page).url}`,
      author: { '@type': 'Organization', name: appName, url: siteUrl },
      publisher: { '@type': 'Organization', name: appName, url: siteUrl },
    },
  ];

  return (
    <DocsPage toc={page.data.toc} full={page.data.full}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD built from the page's own frontmatter
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }}
      />
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription className="mb-0">{page.data.description}</DocsDescription>
      <div className="flex flex-row items-center gap-2 border-b pb-6">
        <MarkdownCopyButton markdownUrl={markdownUrl} />
        <ViewOptionsPopover
          markdownUrl={markdownUrl}
          githubUrl={`${repoUrl}/blob/${gitConfig.branch}/apps/web/content/docs/${page.path}`}
        />
      </div>
      <DocsBody>
        <MDX
          components={getMDXComponents({
            a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata(props: PageProps<'/docs/[[...slug]]'>): Promise<Metadata> {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const image = getPageImage(page).url;
  const title = page.data.seoTitle ?? page.data.title;

  return {
    title,
    description: page.data.description,
    alternates: {
      canonical: page.url,
    },
    openGraph: {
      title,
      description: page.data.description,
      url: page.url,
      type: 'article',
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: page.data.description,
      images: [image],
    },
  };
}
