import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';
import { appName, siteUrl } from './shared';

// Mirrors the landing page: a neutral paper surface and ink, no brand hue.
const PAPER = '#FCFCFC';
const INK = '#0A0A0A';
const INK_SOFT = '#3A3A3A';
const MUTED = '#636363';
const RULE = '#E4E4E4';

export const ogSize = { width: 1200, height: 630 };

const fontsDir = path.join(process.cwd(), 'node_modules/geist/dist/fonts');

async function loadAssets() {
  const [regular, medium, mono, logo] = await Promise.all([
    readFile(path.join(fontsDir, 'geist-sans/Geist-Regular.ttf')),
    readFile(path.join(fontsDir, 'geist-sans/Geist-Medium.ttf')),
    readFile(path.join(fontsDir, 'geist-mono/GeistMono-Medium.ttf')),
    readFile(path.join(process.cwd(), 'public/open-form.svg')),
  ]);
  return {
    logoSrc: `data:image/svg+xml;base64,${logo.toString('base64')}`,
    fonts: [
      { name: 'Geist', data: regular, weight: 400 as const, style: 'normal' as const },
      { name: 'Geist', data: medium, weight: 500 as const, style: 'normal' as const },
      { name: 'Geist Mono', data: mono, weight: 500 as const, style: 'normal' as const },
    ],
  };
}

type OgContent = {
  title: string;
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

function Frame({ title, description, eyebrow, footer, logoSrc }: OgContent & { logoSrc: string }) {
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
        padding: '72px 80px',
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          bottom: 0,
          width: 6,
          backgroundColor: INK,
        }}
      />

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
          <span style={{ color: RULE }}>·</span>
          <span>{eyebrow}</span>
        </div>
      </div>

      <div style={{ height: 1, width: '100%', backgroundColor: RULE, marginTop: 32 }} />

      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 48, flex: 1 }}>
        <div
          style={{
            display: 'flex',
            fontSize: title.length > 36 ? 76 : 92,
            fontWeight: 500,
            lineHeight: 1.04,
            letterSpacing: '-0.03em',
            color: INK,
            maxHeight: 320,
            overflow: 'hidden',
          }}
        >
          {title}
        </div>

        {description ? (
          <div
            style={{
              display: 'flex',
              marginTop: 28,
              fontSize: 30,
              lineHeight: 1.4,
              color: INK_SOFT,
              maxHeight: 180,
              overflow: 'hidden',
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
