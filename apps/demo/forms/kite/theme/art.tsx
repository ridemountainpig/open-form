import type { ReactNode } from 'react';

// Four small landscapes for the picture choices, keyed by option value. They are
// drawn in the theme's own sky, sea and hill colors so they follow dark mode.

function Scene({ children }: { children: ReactNode }) {
  return (
    <svg
      className="kt-art"
      viewBox="0 0 100 92"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const ART: Record<string, ReactNode> = {
  beach: (
    <Scene>
      <circle className="kt-sun" cx="68" cy="34" r="15" />
      <rect className="kt-sea" y="52" width="100" height="40" />
      <path className="kt-sun" d="M0 60h36v2H0zM50 68h50v2H50zM14 76h40v2H14z" opacity=".55" />
      <path className="kt-hill" d="M0 92V74c18-8 34-6 52 4s34 8 48 2v12z" />
      <path className="kt-deep" d="M22 78c-1-14 0-26 4-36l2 1c-3 10-4 22-3 35z" />
      <path
        className="kt-deep"
        d="M27 42c-8-6-16-5-21 1 8-2 14-1 21-1zm0 0c2-9 9-13 17-11-7 2-12 6-17 11zm0 0c9-3 17 0 20 7-6-4-12-6-20-7zm0 0c-9 0-14 5-15 12 4-6 9-9 15-12z"
      />
    </Scene>
  ),
  mountains: (
    <Scene>
      <circle className="kt-sun" cx="28" cy="24" r="11" />
      <path className="kt-sea" d="M0 92V62l24-30 18 22 14-16 44 44v10z" />
      <path className="kt-sun" d="M24 32l8 10-6-3-4 5-5-3z" opacity=".8" />
      <path className="kt-hill" d="M0 92V74l30-24 22 18 20-22 28 26v20z" />
      <path className="kt-deep" d="M0 92V84c20-10 40-8 58-2s30 4 42-2v12z" />
    </Scene>
  ),
  city: (
    <Scene>
      <circle className="kt-sun" cx="74" cy="26" r="13" />
      <path
        className="kt-sea"
        d="M6 92V44h16v48zM26 92V28h18v64zM48 92V50h14v42zM66 92V36h20v56z"
      />
      <path
        className="kt-hill"
        d="M0 92V60h12v32zM16 92V52h14v40zM40 92V62h16v30zM60 92V56h12v36zM78 92V64h22v28z"
      />
      <path
        className="kt-sun"
        d="M30 34h3v4h-3zm6 0h3v4h-3zm-6 9h3v4h-3zm40-1h3v4h-3zm6 0h3v4h-3zM20 58h3v4h-3zm24 10h3v4h-3z"
        opacity=".8"
      />
      <rect className="kt-deep" y="84" width="100" height="8" />
    </Scene>
  ),
  countryside: (
    <Scene>
      <circle className="kt-sun" cx="50" cy="40" r="16" />
      <path className="kt-sea" d="M0 92V56c20-12 44-12 62-2s28 8 38 0v38z" />
      <path className="kt-hill" d="M0 92V70c22-10 40-6 56 2s30 6 44-2v22z" />
      <path className="kt-deep" d="M66 66h14v12H66zM64 66l9-8 9 8z" />
      <path className="kt-sun" d="M71 71h4v7h-4z" />
      <path
        className="kt-deep"
        d="M22 76a6 6 0 1112 0zM27 76h2v8h-2zM86 72a5 5 0 1110 0zM90 72h2v8h-2z"
      />
    </Scene>
  ),
};
