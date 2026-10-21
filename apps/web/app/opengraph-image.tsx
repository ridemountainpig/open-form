import { renderOgImage } from '@/lib/og';
import { appName, headline, initCommand } from '@/lib/shared';

export const alt = `${appName} — ${headline.join(' ')}`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function Image() {
  const [title, emphasis] = headline;
  return renderOgImage({
    title,
    emphasis,
    description: 'One React file becomes a form, a submission API and a dashboard.',
    eyebrow: 'Open-source form framework',
    footer: initCommand,
  });
}
