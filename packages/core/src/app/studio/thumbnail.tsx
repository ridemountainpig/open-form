import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useT } from './i18n.tsx';
import { cx } from './ui.tsx';

const FRAME_WIDTH = 1200;

/**
 * A live page rendered at desktop width and scaled into a 16:10 box. The frame
 * is inert: no pointer events, no focus, hidden from assistive tech.
 */
export function Thumbnail({
  src,
  className,
  children,
}: {
  src: string | null;
  className?: string;
  /** Shown instead of the page, e.g. a load error. */
  children?: ReactNode;
}) {
  const t = useT();
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);
  const height = FRAME_WIDTH * (10 / 16);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setScale(entry.contentRect.width / FRAME_WIDTH);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className={cx(
        'relative aspect-[16/10] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900',
        className,
      )}
    >
      {children ??
        (src && scale !== null && (
          <iframe
            src={src}
            title={t('preview.thumbnail')}
            aria-hidden="true"
            tabIndex={-1}
            scrolling="no"
            loading="lazy"
            className="pointer-events-none absolute top-0 left-0 origin-top-left border-0"
            style={{ width: FRAME_WIDTH, height, transform: `scale(${scale})` }}
          />
        ))}
    </div>
  );
}
