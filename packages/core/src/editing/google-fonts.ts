import { FontInstallError, installThemeFont, type ThemeFont } from './theme-fonts.ts';

// The Google Fonts catalog, for picking a family and copying it into a theme.
// Only Studio (in dev) and the CLI talk to Google; a form never does.

const CATALOG_URL = 'https://fonts.google.com/metadata/fonts';
const CSS_URL = 'https://fonts.googleapis.com/css2';
const CATALOG_TTL = 60 * 60 * 1000;
// css2 answers a current browser with woff2 split into unicode-range subsets.
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const CJK_SUBSETS = new Set([
  'chinese-traditional',
  'chinese-simplified',
  'chinese-hongkong',
  'japanese',
  'korean',
]);

export const FONT_CATEGORIES = [
  'Sans Serif',
  'Serif',
  'Display',
  'Handwriting',
  'Monospace',
] as const;

export type GoogleFont = {
  family: string;
  category: string;
  /** Upright weights, e.g. [400, 700]. */
  weights: number[];
  /** The weight axis, for variable families. */
  axis?: { min: number; max: number };
  italicOnly: boolean;
  subsets: string[];
  /** Covers Chinese, Japanese or Korean: hundreds of slices, megabytes on disk. */
  cjk: boolean;
  popularity: number;
};

type RawFamily = {
  family: string;
  category?: string;
  subsets?: string[];
  fonts?: Record<string, unknown>;
  axes?: Array<{ tag: string; min: number; max: number }>;
  popularity?: number;
};

function toFont(raw: RawFamily): GoogleFont {
  const variants = Object.keys(raw.fonts ?? {});
  const weights = variants
    .filter((v) => /^\d+$/.test(v))
    .map(Number)
    .sort((a, b) => a - b);
  const wght = raw.axes?.find((a) => a.tag === 'wght');
  const subsets = (raw.subsets ?? []).filter((s) => s !== 'menu');
  return {
    family: raw.family,
    category: raw.category ?? 'Sans Serif',
    weights,
    ...(wght ? { axis: { min: wght.min, max: wght.max } } : {}),
    italicOnly: weights.length === 0 && variants.length > 0,
    subsets,
    cjk: subsets.some((s) => CJK_SUBSETS.has(s)),
    popularity: typeof raw.popularity === 'number' ? raw.popularity : Number.MAX_SAFE_INTEGER,
  };
}

let cache: { at: number; fonts: GoogleFont[] } | null = null;
let inflight: Promise<GoogleFont[]> | null = null;

async function catalog(): Promise<GoogleFont[]> {
  if (cache && Date.now() - cache.at < CATALOG_TTL) return cache.fonts;
  inflight ??= (async () => {
    const res = await fetchOk(CATALOG_URL);
    const text = await res.text();
    // The JSON may carry an XSSI guard like `)]}'` in front.
    const data = JSON.parse(text.slice(text.indexOf('{'))) as { familyMetadataList?: RawFamily[] };
    const fonts = (data.familyMetadataList ?? []).map(toFont);
    cache = { at: Date.now(), fonts };
    return fonts;
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export type FontQuery = { q?: string; category?: string; cjk?: boolean; limit?: number };

/** Most popular first, filtered by name, category or CJK coverage. */
export async function searchGoogleFonts(query: FontQuery = {}): Promise<GoogleFont[]> {
  const q = query.q?.trim().toLowerCase() ?? '';
  return (await catalog())
    .filter(
      (f) =>
        (!q || f.family.toLowerCase().includes(q)) &&
        (!query.category || f.category === query.category) &&
        (!query.cjk || f.cjk),
    )
    .sort((a, b) => a.popularity - b.popularity)
    .slice(0, Math.min(Math.max(query.limit ?? 40, 1), 100));
}

export async function findGoogleFont(family: string): Promise<GoogleFont> {
  const name = family.trim().toLowerCase();
  const font = (await catalog()).find((f) => f.family.toLowerCase() === name);
  if (!font) throw new FontInstallError(`Google Fonts has no family "${family}".`);
  return font;
}

/**
 * The weights forms need: a variable family's whole axis (one file covers it),
 * or the static weights from 400 to 700 — the runtime uses 400–650.
 */
export function cssRequestUrl(font: GoogleFont): string {
  const family = encodeURIComponent(font.family).replace(/%20/g, '+');
  let spec: string;
  if (font.italicOnly) spec = 'ital@1';
  else if (font.axis) spec = `wght@${font.axis.min}..${font.axis.max}`;
  else {
    const mid = font.weights.filter((w) => w >= 400 && w <= 700);
    const nearest = [...font.weights].sort((a, b) => Math.abs(a - 400) - Math.abs(b - 400));
    spec = `wght@${(mid.length ? mid : nearest.slice(0, 1)).join(';')}`;
  }
  return `${CSS_URL}?family=${family}:${spec}&display=swap`;
}

async function fetchOk(url: string, init?: RequestInit): Promise<Response> {
  const { host } = new URL(url);
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch (err) {
    throw new Error(unreachable(host, err));
  }
  if (!res.ok) throw new Error(`${host}: HTTP ${res.status}.`);
  return res;
}

// Node's fetch only goes through HTTPS_PROXY when NODE_USE_ENV_PROXY is set.
function unreachable(host: string, err: unknown): string {
  const cause = err instanceof Error && err.cause instanceof Error ? err.cause.message : '';
  const proxied =
    (process.env.HTTPS_PROXY || process.env.https_proxy) && !process.env.NODE_USE_ENV_PROXY;
  return [
    `Couldn't reach ${host}${cause ? ` (${cause})` : ''}.`,
    proxied
      ? 'HTTPS_PROXY is set: run again with NODE_USE_ENV_PROXY=1 so Node uses it.'
      : 'Check the network connection and try again.',
  ].join(' ');
}

const MAX_FONT_FILE_BYTES = 5 * 1024 * 1024;

async function downloadFontFile(url: string): Promise<Uint8Array> {
  // The URL was checked to be on fonts.gstatic.com; a redirect could leave it.
  const res = await fetchOk(url, { redirect: 'error' });
  if (Number(res.headers.get('content-length') ?? 0) > MAX_FONT_FILE_BYTES) {
    throw new Error(`${new URL(url).host}: font file too large.`);
  }
  const data = new Uint8Array(await res.arrayBuffer());
  if (data.byteLength > MAX_FONT_FILE_BYTES) throw new Error('Font file too large.');
  return data;
}

/** Download a Google Fonts family into a theme's `fonts/` folder and import it. */
export async function addGoogleFont(opts: {
  themeFile: string;
  projectRoot: string;
  family: string;
}): Promise<ThemeFont> {
  const font = await findGoogleFont(opts.family);
  const css = await (
    await fetchOk(cssRequestUrl(font), { headers: { 'user-agent': BROWSER_UA } })
  ).text();
  return installThemeFont({
    themeFile: opts.themeFile,
    projectRoot: opts.projectRoot,
    family: font.family,
    category: font.category,
    css,
    download: downloadFontFile,
  });
}
