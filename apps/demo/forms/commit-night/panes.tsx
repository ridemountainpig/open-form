import { useFormValues } from '@open-form-build/core';

const TALKS: Array<{ time: string; title: string; by?: string; topic?: string }> = [
  { time: '19:00', title: 'Doors, pizza, name tags' },
  {
    time: '19:30',
    title: 'Agents that open their own PRs',
    by: 'Yun Chen · AI agents',
    topic: 'agents',
  },
  {
    time: '20:00',
    title: 'A Rust allocator in 200 lines',
    by: 'Kai Wu · Systems & Rust',
    topic: 'systems',
  },
  {
    time: '20:30',
    title: 'Tokens are not a design system',
    by: 'Emi Sato · Design systems',
    topic: 'design',
  },
  {
    time: '21:00',
    title: 'Evals you will actually run',
    by: 'Jo Park · AI agents',
    topic: 'agents',
  },
  { time: '21:30', title: 'Open table: bring a laptop' },
];

const ROLES: Record<string, string> = {
  engineer: 'Engineer',
  designer: 'Designer',
  student: 'Student',
  other: 'Other',
};

function picked(values: Record<string, unknown>): string[] {
  return Array.isArray(values.topics) ? (values.topics as string[]) : [];
}

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '—';
}

/** What they have told us so far. */
export function You() {
  const values = useFormValues();
  const rows: Array<[string, string]> = [
    ['name', text(values.name)],
    ['email', text(values.email)],
    ['role', ROLES[String(values.role)] ?? '—'],
    ['org', text(values.role === 'student' ? values.school : values.company)],
    ['exp', text(values.experience)],
    ['topics', `${picked(values).length} of 3`],
  ];
  return (
    <section className="cn-pane cn-you" aria-label="You">
      <span className="cn-legend">YOU</span>
      <dl>
        {rows.map(([key, value]) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd data-set={value !== '—' || undefined}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="cn-comment">
        # draft saved in this browser —
        <br /># close the tab, come back later
      </p>
    </section>
  );
}

/** The evening's talks; the ones matching their topics get a star. */
export function Agenda() {
  const topics = picked(useFormValues());
  const hits = TALKS.filter((talk) => talk.topic && topics.includes(talk.topic)).length;
  return (
    <section className="cn-pane cn-agenda" aria-label="Agenda">
      <span className="cn-legend">AGENDA</span>
      {hits > 0 && <span className="cn-legend cn-legend-end">★ {hits} picked for you</span>}
      <ol>
        {TALKS.map((talk) => {
          const hit = Boolean(talk.topic && topics.includes(talk.topic));
          return (
            <li key={talk.time} data-hit={hit || undefined}>
              <time>{talk.time}</time>
              <span aria-hidden="true">{hit ? '★' : '·'}</span>
              <div>
                <b>{talk.title}</b>
                {talk.by && <small>{talk.by}</small>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function Seats() {
  return (
    <section className="cn-pane cn-seats" aria-label="Seats">
      <span className="cn-legend">SEATS</span>
      <span className="cn-legend cn-legend-end">closes Jan 14</span>
      <div className="cn-meter" aria-hidden="true" />
      <p>
        <b>100</b> seats · free entry
      </p>
    </section>
  );
}
