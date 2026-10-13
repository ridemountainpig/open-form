// Just enough color science to check theme contrast: parse CSS colors
// (hex, rgb, hsl, oklch, oklab) to sRGB and compute WCAG 2 contrast ratios.

export type Rgb = [number, number, number];

const NAMED: Record<string, Rgb> = { white: [1, 1, 1], black: [0, 0, 0] };

const clamp = (n: number) => Math.min(1, Math.max(0, n));

function numbers(body: string): string[] {
  return body
    .replace(/\/.*$/, '')
    .split(/[\s,]+/)
    .filter(Boolean);
}

function channel(token: string, scale: number): number {
  return token.endsWith('%') ? Number.parseFloat(token) / 100 : Number.parseFloat(token) / scale;
}

function hue(token: string): number {
  const n = Number.parseFloat(token);
  if (token.endsWith('turn')) return n * 360;
  if (token.endsWith('rad')) return (n * 180) / Math.PI;
  return n;
}

function encode(linear: number): number {
  return clamp(linear <= 0.0031308 ? 12.92 * linear : 1.055 * linear ** (1 / 2.4) - 0.055);
}

function oklabToRgb(l: number, a: number, b: number): Rgb {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    encode(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_),
    encode(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_),
    encode(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_),
  ];
}

function hslToRgb(h: number, s: number, l: number): Rgb {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return [f(0), f(8), f(4)];
}

/** sRGB in 0–1, or null for values this can't resolve (var(), color-mix(), …). */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase();
  if (NAMED[value]) return NAMED[value];

  const hex = /^#([0-9a-f]{3,8})$/.exec(value)?.[1];
  if (hex) {
    const full =
      hex.length <= 4
        ? hex
            .slice(0, 3)
            .split('')
            .map((c) => c + c)
            .join('')
        : hex.slice(0, 6);
    if (full.length !== 6) return null;
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16) / 255) as Rgb;
  }

  const fn = /^([a-z]+)\((.*)\)$/.exec(value);
  if (!fn) return null;
  const [, name, body = ''] = fn;
  const parts = numbers(body);
  if (parts.length < 3) return null;
  const [p0 = '', p1 = '', p2 = ''] = parts;

  switch (name) {
    case 'rgb':
    case 'rgba':
      return [channel(p0, 255), channel(p1, 255), channel(p2, 255)].map(clamp) as Rgb;
    case 'hsl':
    case 'hsla':
      return hslToRgb(hue(p0), channel(p1, 100), channel(p2, 100));
    case 'oklch': {
      const l = channel(p0, 1);
      const c = p1.endsWith('%') ? (Number.parseFloat(p1) / 100) * 0.4 : Number.parseFloat(p1);
      const h = (hue(p2) * Math.PI) / 180;
      return oklabToRgb(l, c * Math.cos(h), c * Math.sin(h));
    }
    case 'oklab': {
      const ab = (t: string) =>
        t.endsWith('%') ? (Number.parseFloat(t) / 100) * 0.4 : Number.parseFloat(t);
      return oklabToRgb(channel(p0, 1), ab(p1), ab(p2));
    }
    default:
      return null;
  }
}

export function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(clamp(c) * 255)
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function contrast(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
