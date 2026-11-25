// The weekends, the sites and the star signs, and what each does to the sky.

export const WEEKENDS = {
  perseids: { name: 'Perseids', dates: 'Aug 13–15', milky: 1, meteors: 1.1 },
  orionids: { name: 'Orionids', dates: 'Oct 22–24', milky: 0.6, meteors: 0.55 },
  geminids: { name: 'Geminids', dates: 'Dec 12–14', milky: 0.3, meteors: 1.4 },
} as const;

export const SITES = {
  dunes: { name: 'Desert ridge', detail: 'Bortle 1 · no water, no shade', index: 0 },
  lake: { name: 'Alpine lake', detail: 'Bortle 2 · the lake mirrors the sky', index: 1 },
  cliffs: { name: 'Sea cliffs', detail: 'Bortle 3 · sleep to the waves', index: 2 },
} as const;

type Shape = { stars: [number, number][]; lines: [number, number][] };

// Simplified figures, drawn the way they are usually joined up.
export const SIGNS: Record<string, { name: string; from: [number, number]; shape: Shape }> = {
  capricorn: {
    name: 'Capricornus',
    from: [12, 22],
    shape: {
      stars: [
        [-0.45, 0.25],
        [-0.3, -0.05],
        [0, -0.3],
        [0.4, 0.2],
        [0.1, 0.15],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 0],
      ],
    },
  },
  aquarius: {
    name: 'Aquarius',
    from: [1, 20],
    shape: {
      stars: [
        [-0.4, 0.3],
        [-0.15, 0.2],
        [0.05, 0.3],
        [0.15, 0.05],
        [0, -0.2],
        [0.3, -0.35],
        [0.4, 0.15],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [3, 6],
      ],
    },
  },
  pisces: {
    name: 'Pisces',
    from: [2, 19],
    shape: {
      stars: [
        [-0.45, -0.3],
        [-0.2, -0.12],
        [0.05, -0.02],
        [0.3, -0.25],
        [0.42, -0.05],
        [-0.08, 0.28],
        [-0.3, 0.42],
      ],
      lines: [
        [4, 3],
        [3, 2],
        [2, 1],
        [1, 0],
        [2, 5],
        [5, 6],
      ],
    },
  },
  aries: {
    name: 'Aries',
    from: [3, 21],
    shape: {
      stars: [
        [-0.42, 0.05],
        [-0.12, 0.18],
        [0.12, 0.16],
        [0.38, -0.02],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
      ],
    },
  },
  taurus: {
    name: 'Taurus',
    from: [4, 20],
    shape: {
      stars: [
        [-0.45, 0.38],
        [-0.18, 0.08],
        [0, -0.02],
        [0.1, 0.06],
        [0.42, 0.32],
        [0.12, -0.3],
        [-0.05, -0.1],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [2, 6],
        [6, 5],
      ],
    },
  },
  gemini: {
    name: 'Gemini',
    from: [5, 21],
    shape: {
      stars: [
        [-0.25, 0.45],
        [-0.28, 0.1],
        [-0.3, -0.3],
        [0.05, 0.42],
        [0.05, 0.05],
        [0.08, -0.35],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [3, 4],
        [4, 5],
        [0, 3],
        [1, 4],
      ],
    },
  },
  cancer: {
    name: 'Cancer',
    from: [6, 21],
    shape: {
      stars: [
        [0, 0.05],
        [-0.05, 0.4],
        [0.35, -0.3],
        [-0.35, -0.3],
      ],
      lines: [
        [0, 1],
        [0, 2],
        [0, 3],
      ],
    },
  },
  leo: {
    name: 'Leo',
    from: [7, 23],
    shape: {
      stars: [
        [-0.3, -0.12],
        [-0.3, 0.06],
        [-0.18, 0.18],
        [-0.22, 0.33],
        [-0.36, 0.4],
        [0.12, 0.16],
        [0.42, 0.02],
        [0.12, -0.04],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [2, 5],
        [5, 6],
        [6, 7],
        [7, 0],
      ],
    },
  },
  virgo: {
    name: 'Virgo',
    from: [8, 23],
    shape: {
      stars: [
        [-0.45, 0.2],
        [-0.2, 0.15],
        [0, 0],
        [0.2, 0.1],
        [0.4, 0.3],
        [0.05, -0.35],
        [0.3, -0.25],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [2, 5],
        [3, 6],
      ],
    },
  },
  libra: {
    name: 'Libra',
    from: [9, 23],
    shape: {
      stars: [
        [0, 0.35],
        [-0.3, 0.05],
        [0.3, 0.05],
        [-0.25, -0.3],
        [0.28, -0.32],
      ],
      lines: [
        [0, 1],
        [0, 2],
        [1, 2],
        [1, 3],
        [2, 4],
      ],
    },
  },
  scorpio: {
    name: 'Scorpius',
    from: [10, 23],
    shape: {
      stars: [
        [-0.45, 0.35],
        [-0.3, 0.25],
        [-0.15, 0.15],
        [0, -0.05],
        [0.08, -0.25],
        [0.25, -0.35],
        [0.42, -0.25],
        [0.4, -0.05],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 4],
        [4, 5],
        [5, 6],
        [6, 7],
      ],
    },
  },
  sagittarius: {
    name: 'Sagittarius',
    from: [11, 22],
    shape: {
      stars: [
        [-0.3, -0.2],
        [0.05, -0.2],
        [0.05, 0.1],
        [-0.25, 0.1],
        [0.2, 0.3],
        [0.35, 0.05],
        [-0.45, 0],
      ],
      lines: [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [2, 4],
        [1, 5],
        [3, 6],
        [0, 6],
      ],
    },
  },
};

// The sign whose dates the birthday falls in (dates as YYYY-MM-DD).
export function signFor(birthday: unknown) {
  if (typeof birthday !== 'string') return undefined;
  const m = /^\d{4}-(\d{2})-(\d{2})$/.exec(birthday);
  if (!m) return undefined;
  const month = Number(m[1]);
  const day = Number(m[2]);
  const starts = (m: number) => Object.keys(SIGNS).find((key) => SIGNS[key]?.from[0] === m);
  const current = starts(month);
  const from = current ? SIGNS[current]?.from[1] : undefined;
  return from !== undefined && day >= from ? current : starts(month === 1 ? 12 : month - 1);
}

export function shapeUniforms(sign: string | undefined) {
  const shape = sign ? SIGNS[sign]?.shape : undefined;
  const stars = Array.from({ length: 8 }, (_, i) => {
    const s = shape?.stars[i];
    return s ? [s[0], s[1], 0.8 + ((i * 37) % 5) * 0.12, 0] : [0, 0, 0, 0];
  });
  const lines = Array.from({ length: 8 }, (_, i) => {
    const l = shape?.lines[i];
    const a = l && shape?.stars[l[0]];
    const b = l && shape?.stars[l[1]];
    return a && b ? [a[0], a[1], b[0], b[1]] : [0, 0, 0, 0];
  });
  return { stars, lines };
}

export function pick<T extends object>(table: T, value: unknown): keyof T | undefined {
  return typeof value === 'string' && value in table ? (value as keyof T) : undefined;
}
