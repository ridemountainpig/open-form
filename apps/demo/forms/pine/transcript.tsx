import { useFieldValue, useFormNav } from '@open-form-build/core';
import { useEffect } from 'react';
import { SCRIPT, type Turn } from './script.ts';

function Said({ turn, onEdit }: { turn: Turn; onEdit: () => void }) {
  const value = useFieldValue<string>(turn.name);
  const text = turn.options?.find((option) => option.value === value)?.label ?? value;
  return (
    <>
      <p className="pn-bubble pn-bot">{turn.ask}</p>
      <p className="pn-bubble pn-me" data-skipped={text ? undefined : ''}>
        <span>{text || turn.skipped}</span>
        <button type="button" className="pn-edit" onClick={onEdit}>
          Edit
        </button>
      </p>
    </>
  );
}

export function Transcript() {
  const nav = useFormNav();
  const done = nav.position;

  useEffect(() => {
    if (done === 0) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: reduce ? 'auto' : 'smooth',
    });
  }, [done]);

  if (done === 0) return null;
  return (
    <div className="pn-transcript">
      {SCRIPT.slice(0, done).map((turn, index) => (
        <Said key={turn.name} turn={turn} onEdit={() => nav.goTo(index)} />
      ))}
    </div>
  );
}
