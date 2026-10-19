import Link from 'next/link';
import { appName, demoUrl, repoUrl } from '@/lib/shared';
import { ButtonLink } from './button';
import { MobileMenu } from './mobile-menu';
import { ThemeToggle } from './theme-toggle';

const linkClass =
  'rounded-full px-3 py-1.5 text-[13.5px] font-medium text-[color:var(--color-text-soft)] transition-colors hover:bg-[color:var(--color-panel-hi)] hover:text-[color:var(--color-text)]';

export function Nav({ githubStars }: { githubStars?: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[color:var(--color-rule-soft)] bg-[color:var(--color-ink)]/80 backdrop-blur-md">
      <div className="relative mx-auto flex h-[60px] w-full max-w-[1200px] items-center justify-between px-6 sm:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-[14px] font-medium tracking-[-0.01em]"
        >
          <img src="/open-form.svg" alt="" width={24} height={24} className="block size-6" />
          <span className="text-[color:var(--color-text)]">{appName}</span>
        </Link>

        <nav
          aria-label="Main"
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 md:flex"
        >
          <Link href="/docs" className={linkClass}>
            Docs
          </Link>
          <a href={demoUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Demo
          </a>
          <a href="#compare" className={linkClass}>
            Compare
          </a>
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={`${linkClass} inline-flex items-center gap-2`}
          >
            <span>GitHub</span>
            {githubStars ? (
              <span className="font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-muted)]">
                <span aria-hidden="true">★ {githubStars}</span>
                <span className="sr-only">{githubStars} stars</span>
              </span>
            ) : null}
          </a>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <div className="hidden md:block">
            <ThemeToggle />
          </div>
          <ButtonLink href="/docs/getting-started">Get started</ButtonLink>
          <MobileMenu githubStars={githubStars} />
        </div>
      </div>
      <span
        aria-hidden="true"
        className="read-progress absolute inset-x-0 -bottom-px h-px bg-[color:var(--color-text)]"
      />
    </header>
  );
}
