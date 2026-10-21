import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { appName, siteUrl } from './shared';

// Mirrors the landing page: a neutral paper surface and ink, no brand hue.
const PAPER = '#FFFFFF';
const INK = '#0A0A0A';
const INK_SOFT = '#424242';
const MUTED = '#696969';
const DIM = '#A4A4A4';
const RULE = '#E1E1E1';

export const ogSize = { width: 1200, height: 630 };

const geistDir = path.join(process.cwd(), 'node_modules/geist/dist/fonts');
// Satori needs static TTFs, so Newsreader (the landing's display face) is vendored
// as its opsz-72 instances; next/font only ships it as a variable woff2.
const newsreaderDir = path.join(process.cwd(), 'assets/fonts');

async function loadAssets() {
  const [regular, mono, display, displayItalic, logo] = await Promise.all([
    readFile(path.join(geistDir, 'geist-sans/Geist-Regular.ttf')),
    readFile(path.join(geistDir, 'geist-mono/GeistMono-Medium.ttf')),
    readFile(path.join(newsreaderDir, 'Newsreader-Regular.ttf')),
    readFile(path.join(newsreaderDir, 'Newsreader-Italic.ttf')),
    readFile(path.join(process.cwd(), 'public/open-form.svg')),
  ]);
  return {
    logoSrc: `data:image/svg+xml;base64,${logo.toString('base64')}`,
    fonts: [
      { name: 'Geist', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Geist Mono', data: mono, weight: 500 as const, style: 'normal' as const },
      { name: 'Newsreader', data: display, weight: 400 as const, style: 'normal' as const },
      { name: 'Newsreader', data: displayItalic, weight: 400 as const, style: 'italic' as const },
    ],
  };
}

type OgContent = {
  title: string;
  /** A second title line in italic, like the landing headline. */
  emphasis?: string;
  description?: string;
  /** Beside the logo, e.g. `Docs`. */
  eyebrow: string;
  /** Bottom-left caption, e.g. the page's path. */
  footer: string;
};

export async function renderOgImage(content: OgContent) {
  const { logoSrc, fonts } = await loadAssets();
  return new ImageResponse(<Frame {...content} logoSrc={logoSrc} />, { ...ogSize, fonts });
}

function Frame({
  title,
  emphasis,
  description,
  eyebrow,
  footer,
  logoSrc,
}: OgContent & { logoSrc: string }) {
  const titleSize = Math.max(title.length, emphasis?.length ?? 0) > 30 ? 80 : 96;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        backgroundColor: PAPER,
        fontFamily: 'Geist',
        color: INK,
        padding: '64px 80px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <img src={logoSrc} width={48} height={48} alt="" />
        <div
          style={{
            fontFamily: 'Geist Mono',
            fontSize: 18,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: MUTED,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ color: INK }}>{appName}</span>
          <span style={{ color: DIM }}>·</span>
          <span>{eyebrow}</span>
        </div>
      </div>

      <div style={{ height: 1, width: '100%', backgroundColor: RULE, marginTop: 32 }} />

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 40, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Newsreader',
            fontSize: titleSize,
            lineHeight: 1,
            letterSpacing: '-0.022em',
            color: INK,
            maxHeight: titleSize * 2,
            overflow: 'hidden',
          }}
        >
          <div style={{ display: 'flex' }}>{title}</div>
          {emphasis ? (
            <div style={{ display: 'flex', fontStyle: 'italic', letterSpacing: '-0.03em' }}>
              {emphasis}
            </div>
          ) : null}
        </div>

        {description ? (
          <div
            style={{
              display: 'block',
              lineClamp: 2,
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: INK_SOFT,
              maxWidth: 980,
            }}
          >
            {description}
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 'auto',
          paddingTop: 24,
          borderTop: `1px solid ${RULE}`,
          fontFamily: 'Geist Mono',
          fontSize: 18,
          color: MUTED,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ width: 8, height: 8, backgroundColor: INK, borderRadius: 999 }} />
          <span>{footer}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: INK }}>{new URL(siteUrl).host}</span>
          <span style={{ color: RULE }}>↗</span>
        </div>
      </div>
    </div>
  );
}
