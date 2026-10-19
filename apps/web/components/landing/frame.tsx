import type { ReactNode } from 'react';

export function Container({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1200px] px-6 sm:px-8 ${className}`}>{children}</div>
  );
}

/** A section header ruled off like a section of a printed form. */
export function SectionHeading({
  number,
  label,
  title,
  lead,
}: {
  number: string;
  label: string;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <div
      data-reveal="stagger"
      className="mb-10 grid grid-cols-1 gap-x-16 gap-y-5 border-t border-[color:var(--color-text)] pt-5 sm:mb-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)] lg:items-end"
    >
      <div className="flex flex-col gap-6 sm:gap-8">
        <span className="eyebrow flex items-center gap-3">
          <span className="text-[color:var(--color-text)]">{number}</span>
          <span aria-hidden="true" className="h-px w-6 bg-[color:var(--color-rule)]" />
          <span>{label}</span>
        </span>
        <h2 className="display text-balance text-[38px] leading-[1.02] sm:text-[50px] lg:text-[60px]">
          {title}
        </h2>
      </div>
      {lead ? (
        <p className="max-w-[54ch] text-pretty text-[15.5px] leading-[1.6] text-[color:var(--color-text-soft)] sm:text-[16.5px] lg:pb-2">
          {lead}
        </p>
      ) : null}
    </div>
  );
}
