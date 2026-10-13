import { renderOgImage } from '@/lib/og';
import { initCommand, tagline } from '@/lib/shared';

export const alt = 'Open Form — the form framework built for agents';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  return renderOgImage({
    title: tagline,
    description: 'Your agent writes the questions. Open Form does the rest.',
    eyebrow: 'Forms as code',
    footer: initCommand,
  });
}
