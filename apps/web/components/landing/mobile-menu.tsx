'use client';

import Link from 'next/link';
import { useEffect, useId, useState } from 'react';
import { demoUrl, repoUrl } from '@/lib/shared';
import { ThemeToggle } from './theme-toggle';

const rowClass =
  'flex h-12 items-center justify-between border-b border-[color:var(--color-rule-soft)] text-[15px] font-medium text-[color:var(--color-text)]';

export function MobileMenu({ githubStars }: { githubStars?: string | null }) {
  const id = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((o) => !o)}
        className="pressable inline-flex size-9 items-center justify-center rounded-full text-[color:var(--color-text)] hover:bg-[color:var(--color-panel-hi)]"
      >
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d={open ? 'M6 6l12 12M18 6L6 18' : 'M4 9h16M4 15h16'}
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open ? (
        <div
          id={id}
          className="menu-in absolute inset-x-0 top-full border-b border-[color:var(--color-rule)] bg-[color:var(--color-ink)] px-6 pt-1 pb-5 shadow-[0_16px_32px_-24px_rgb(0_0_0/0.4)]"
        >
          <nav aria-label="Main">
            <Link href="/docs" onClick={close} className={rowClass}>
              Docs
            </Link>
            <a
              href={demoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className={rowClass}
            >
              Demo
              <span aria-hidden="true" className="text-[color:var(--color-muted)]">
                ↗
              </span>
            </a>
            <Link href="#compare" onClick={close} className={rowClass}>
              Compare
            </Link>
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className={rowClass}
            >
              GitHub
              <span className="font-[family-name:var(--font-mono)] text-[12px] text-[color:var(--color-muted)]">
                {githubStars ? (
                  <>
                    <span aria-hidden="true">★ {githubStars}</span>
                    <span className="sr-only">{githubStars} stars</span>
                  </>
                ) : (
                  <span aria-hidden="true">↗</span>
                )}
              </span>
            </a>
          </nav>
          <div className="flex items-center justify-between pt-4">
            <span className="caption">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      ) : null}
    </div>
  );
}
