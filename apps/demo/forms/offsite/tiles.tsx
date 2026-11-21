import { useFieldValue } from '@open-form-build/core';
import type { ReactNode } from 'react';

const ORDER = ['attending', 'name', 'guests', 'travel', 'room', 'diet', 'activities', 'notes'];

function filled(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  return value !== undefined && value !== null && value !== '';
}

function useAnswers(): boolean[] {
  return [
    useFieldValue('attending'),
    useFieldValue('name'),
    useFieldValue('guests'),
    useFieldValue('travel'),
    useFieldValue('room'),
    useFieldValue('diet'),
    useFieldValue('activities'),
    useFieldValue('notes'),
  ].map(filled);
}

export function Tile({ name, children }: { name: string; children: ReactNode }) {
  const answers = useAnswers();
  const index = ORDER.indexOf(name);
  const done = answers[index];
  const next = answers.indexOf(false) === index;
  return (
    <div className="bn-tile" data-tile={name} data-next={next ? '' : undefined}>
      <div className="bn-n" aria-hidden="true">
        <b className="bn-k">{index + 1}</b>
        {done ? (
          <span className="bn-ok">✓ Done</span>
        ) : (
          next && <span className="bn-tag">Next</span>
        )}
      </div>
      {children}
    </div>
  );
}

export function Tally() {
  const answers = useAnswers();
  const count = answers.filter(Boolean).length;
  const percent = Math.round((count / answers.length) * 100);
  return (
    <div className="bn-tally" role="status">
      <span
        className="bn-ring"
        style={{ '--bn-fill': `${percent}%` } as React.CSSProperties}
        aria-hidden="true"
      >
        <b>{percent}%</b>
      </span>
      <span className="bn-count">
        {count} of {answers.length} answered
      </span>
    </div>
  );
}
