import { useFieldValue, useTranslate } from '@open-form-build/core';

type Slot = { time: string; title: string; topics?: string[]; aside?: boolean };

const AGENDA: Slot[] = [
  { time: '19:00', title: 'Doors open · pizza & stickers', aside: true },
  { time: '19:30', title: 'Agents that open their own PRs', topics: ['AI agents'] },
  { time: '19:55', title: 'One button, forty themes', topics: ['Design systems', 'Frontend'] },
  { time: '20:20', title: 'Break', aside: true },
  { time: '20:35', title: 'Postgres at 3 a.m.', topics: ['Backend', 'DevOps'] },
  { time: '21:00', title: 'Lightning talks · 5 × 5 min' },
  { time: '21:30', title: 'Drinks next door', aside: true },
];

/** `meetup agenda`: tonight's run of show, marking the talks that match the topics picked. Display only. */
export function Agenda({ final = false }: { final?: boolean }) {
  const tr = useTranslate();
  const interests = useFieldValue('interests');
  const picked = Array.isArray(interests) ? interests.map(String) : [];
  const tag = (topic: string) => tr(topic).toLowerCase().replace(/\s+/g, '-');
  const talks = AGENDA.filter((slot) => slot.topics);
  const matches = talks.filter((slot) => slot.topics?.some((t) => picked.includes(t))).length;

  return (
    <section className="mt-agenda" data-final={final || undefined} aria-label={tr('Tonight')}>
      <p className="mt-cmd" aria-hidden="true">
        <span className="tm-accent">$</span> meetup agenda
        {picked.length > 0 && (
          <span className="tm-accent"> --mark {picked.map(tag).join(',')}</span>
        )}
      </p>
      <ol>
        {AGENDA.map((slot) => {
          const hit = slot.topics?.some((t) => picked.includes(t));
          return (
            <li
              key={slot.time}
              data-hit={hit || undefined}
              data-dim={slot.aside || (picked.length > 0 && slot.topics && !hit) || undefined}
            >
              <span className="mt-time">{slot.time}</span>
              <span className="mt-mark" aria-hidden="true">
                {hit ? '★' : slot.aside ? '·' : '○'}
              </span>
              <span className="mt-talk">
                {tr(slot.title)}
                {slot.topics?.map((topic) => (
                  <span
                    key={topic}
                    className="mt-tag"
                    data-hit={picked.includes(topic) || undefined}
                  >
                    #{tag(topic)}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="mt-foot">
        <span aria-hidden="true"># </span>
        {picked.length === 0
          ? tr('Pick topics in step 2 to mark your talks.')
          : tr('{n} of {total} talks match your topics.', { n: matches, total: talks.length })}
      </p>
    </section>
  );
}
