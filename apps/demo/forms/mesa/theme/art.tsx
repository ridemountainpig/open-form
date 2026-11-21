import type { ReactNode } from 'react';

// Line drawings and a one-line note for the occasion tiles, keyed by option value.

function Plate({ children }: { children: ReactNode }) {
  return (
    <svg className="ms-art" viewBox="0 0 100 105" aria-hidden="true">
      {children}
    </svg>
  );
}

export const TILES: Record<string, { art: ReactNode; note: string }> = {
  date: {
    note: 'A quiet corner table',
    art: (
      <Plate>
        <path className="ms-l" d="M32 38h16c0 12-3 18-8 20-5-2-8-8-8-20zM40 58v20M32 78h16" />
        <path
          className="ms-w"
          d="M33.5 46h13c-.6 6-2.800 9.500-6.500 11-3.700-1.500-5.900-5-6.500-11z"
        />
        <path
          className="ms-l"
          d="M54 34l15 5c-3 11-8 16-13 16-4-3-5-10-2-21zM56 55l-6 19M43 72l15 5"
        />
        <path
          className="ms-w"
          d="M53.800 42.500l12.400 4c-2.400 5.500-5.600 8-9.200 8.200-2.600-2.200-3.600-6.400-3.200-12.200z"
        />
        <circle className="ms-g" cx="72" cy="26" r="2.500" />
        <circle className="ms-g" cx="26" cy="28" r="1.800" />
      </Plate>
    ),
  },
  birthday: {
    note: 'We bring the candle',
    art: (
      <Plate>
        <path
          className="ms-l"
          d="M26 80h48M30 80V60h40v20M36 60V48h28v12M30 68c5 4 8 4 13 0s8-4 14 0 8 4 13 0"
        />
        <path className="ms-l" d="M50 48V38" />
        <path className="ms-g" d="M50 28c3 4 3 7 0 9-3-2-3-5 0-9z" />
      </Plate>
    ),
  },
  family: {
    note: 'Big plates to share',
    art: (
      <Plate>
        <circle className="ms-l" cx="50" cy="60" r="22" />
        <circle className="ms-l" cx="50" cy="60" r="13" />
        <path
          className="ms-l"
          d="M18 40v40M14 40v10c0 4 8 4 8 0V40M82 40c-5 4-6 14-4 20h4zM82 60v20"
        />
        <circle className="ms-g" cx="50" cy="60" r="5" />
      </Plate>
    ),
  },
  hungry: {
    note: 'No reason needed',
    art: (
      <Plate>
        <path className="ms-l" d="M26 58h48c0 14-10 22-24 22s-24-8-24-22zM40 80h20" />
        <path className="ms-l" d="M38 48c-4-5 4-7 0-13M50 48c-4-5 4-7 0-13M62 48c-4-5 4-7 0-13" />
        <path className="ms-g" d="M30 61h40c-1 9-8 15-20 15s-19-6-20-15z" opacity=".9" />
      </Plate>
    ),
  },
};
