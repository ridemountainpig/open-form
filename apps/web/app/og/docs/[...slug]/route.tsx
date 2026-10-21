import { notFound } from 'next/navigation';
import { renderOgImage } from '@/lib/og';
import { headline } from '@/lib/shared';
import { getPageImage, source } from '@/lib/source';

export const revalidate = false;

export async function GET(_req: Request, { params }: RouteContext<'/og/docs/[...slug]'>) {
  const { slug } = await params;
  const page = source.getPage(slug.slice(0, -1));
  if (!page) notFound();

  return renderOgImage({
    title: page.data.title,
    description: page.data.description ?? headline.join(' '),
    eyebrow: 'Docs',
    footer: ['docs', ...page.slugs].join(' / '),
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({
    slug: getPageImage(page).segments,
  }));
}
