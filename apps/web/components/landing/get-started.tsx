import type { ReactNode } from 'react';
import { initCommand } from '@/lib/shared';
import { AgentIconList } from './agent-icon-list';
import { ButtonLink } from './button';
import { CopyCommand } from './copy-command';
import { Container, SectionHeading } from './frame';
import { TickBox } from './tick-box';

const steps: { title: string; body: string; prompt: string; line: string; tail?: ReactNode }[] = [
  {
    title: 'Scaffold a workspace',
    body: 'forms/, themes/, the agent skills and Studio. No database to set up.',
    prompt: '$',
    line: `${initCommand} my-forms`,
  },
  {
    title: 'Ask your agent',
    body: 'It proposes three visual directions, then writes the form as one small file.',
    prompt: '›',
    line: '/create-form RSVP for our meetup',
    tail: <AgentIconList />,
  },
  {
    title: 'Ship one server',
    body: 'Build and start it. Responses land in SQLite; set OPEN_FORM_ADMIN_PASSWORD to read them in Studio.',
    prompt: '$',
    line: 'npm run build && npm start',
  },
];

export function GetStarted() {
  return (
    <section id="install">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading
          number="08"
          label="Get started"
          title="Sign here."
          lead="Three steps from an empty folder to your first response. Free and open source under the MIT license."
        />

        <ol data-reveal="stagger" className="border-t border-[color:var(--color-rule)]">
          {steps.map((s, i) => (
            <li
              key={s.title}
              className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-4 border-b border-[color:var(--color-rule)] py-6 sm:gap-x-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,460px)] lg:items-center"
            >
              <TickBox index={i} />
              <div className="flex flex-col gap-1">
                <h3 className="flex items-baseline gap-3 text-[17px] font-medium tracking-[-0.015em] text-[color:var(--color-text)]">
                  <span className="font-[family-name:var(--font-mono)] text-[12px] font-normal text-[color:var(--color-muted)]">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.title}
                </h3>
                <p className="text-pretty text-[14.5px] leading-[1.55] text-[color:var(--color-muted)]">
                  {s.body}
                </p>
              </div>
              <div className="col-start-2 flex flex-col gap-2 lg:col-start-3">
                <code className="flex h-10 items-center gap-2.5 overflow-x-auto rounded-[4px] bg-[color:var(--color-panel-hi)] px-3.5 font-[family-name:var(--font-mono)] text-[12.5px] whitespace-nowrap [scrollbar-width:none] text-[color:var(--color-text-soft)]">
                  <span aria-hidden="true" className="text-[color:var(--color-muted)]">
                    {s.prompt}
                  </span>
                  {s.line}
                </code>
                {s.tail ? <div className="pl-1">{s.tail}</div> : null}
              </div>
            </li>
          ))}
        </ol>

        <div
          data-reveal
          className="mt-10 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end"
        >
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <ButtonLink href="/docs/getting-started" size="lg">
              Read the docs
            </ButtonLink>
            <CopyCommand command={initCommand} size="lg" />
          </div>
          <span className="eyebrow">OF-01 · MIT</span>
        </div>
      </Container>
    </section>
  );
}
