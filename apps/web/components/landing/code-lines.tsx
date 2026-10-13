import type { CSSProperties } from 'react';
import { highlight } from './code-highlight';

/**
 * Highlighted source, one row per line. `pulse` lines flash once per
 * `pulseKey`; `live` lines stay marked (e.g. the field you're typing in).
 */
export function CodeLines({
  lines,
  pulse = [],
  pulseKey = 0,
  live = [],
  minLines,
}: {
  lines: string[];
  pulse?: readonly number[];
  pulseKey?: number | string;
  live?: readonly number[];
  minLines?: number;
}) {
  return (
    <code
      className="block lg:min-h-[var(--code-min)]"
      style={minLines ? ({ '--code-min': `${minLines * 1.7}em` } as CSSProperties) : undefined}
    >
      {lines.map((line, idx) => {
        const pulsing = pulse.includes(idx);
        const classes = [
          '-mx-2 rounded-[3px] px-2',
          pulsing ? 'code-pulse' : '',
          live.includes(idx) ? 'code-live' : '',
        ].join(' ');
        return (
          <div
            key={pulsing ? `${idx}-${pulseKey}` : idx}
            className={classes}
            // biome-ignore lint/security/noDangerouslySetInnerHtml: highlight() escapes the source and only adds styled spans
            dangerouslySetInnerHTML={{ __html: highlight(line) || '&nbsp;' }}
          />
        );
      })}
    </code>
  );
}
