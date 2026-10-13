import type { ReactNode } from 'react';
import { AgentIconList } from './agent-icon-list';
import { Container, SectionHeading } from './frame';

type Step = {
  num: string;
  title: string;
  body: string;
  code: {
    prompt: string;
    line: string;
    tail: ReactNode;
  };
};

const steps: Step[] = [
  {
    num: '01',
    title: 'Spin up a workspace',
    body: 'One command scaffolds forms/, themes/, the agent skills and Studio. No database to provision.',
    code: {
      prompt: '$',
      line: 'npx @open-form-build/cli init my-forms',
      tail: '✓ studio on :3000',
    },
  },
  {
    num: '02',
    title: 'Ask your agent',
    body: 'It proposes three visual directions, then writes the questions and logic as one small file.',
    code: {
      prompt: '›',
      line: '/create-form RSVP for our meetup',
      tail: <AgentIconList />,
    },
  },
  {
    num: '03',
    title: 'Share it, collect responses',
    body: 'Build and start one Node server. Responses land in SQLite and show up in Studio.',
    code: {
      prompt: '$',
      line: 'pnpm build && pnpm start',
      tail: '✓ responses in sqlite',
    },
  },
];

const SLASH_COMMAND = /\/[a-z][a-z-]*/g;

function renderLine(line: string) {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const match of line.matchAll(SLASH_COMMAND)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(line.slice(last, start));
    parts.push(
      <span key={`cmd-${start}`} className="font-medium text-[color:var(--color-text)]">
        {match[0]}
      </span>,
    );
    last = start + match[0].length;
  }
  if (last < line.length) parts.push(line.slice(last));
  return <>{parts}</>;
}

export function HowItWorks() {
  return (
    <section id="how-it-works">
      <Container className="py-24 sm:py-32">
        <SectionHeading
          eyebrow="How it works"
          title="Three steps to live responses."
          lead="Scaffold once, prompt your agent, then ship one server. No builder, no backend to write."
        />

        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <li
              key={s.num}
              data-reveal
              className="flex flex-col gap-6 rounded-2xl border border-[color:var(--color-rule-soft)] bg-[color:var(--color-panel)] p-6 transition-colors duration-300 hover:border-[color:var(--color-rule)] sm:p-7"
            >
              <span className="inline-flex size-7 items-center justify-center rounded-full bg-[color:var(--color-panel-hi)] font-[family-name:var(--font-mono)] text-[11px] text-[color:var(--color-text-soft)]">
                {s.num}
              </span>

              <div>
                <h3 className="text-[18px] font-medium leading-[1.3] tracking-[-0.02em] sm:text-[19px]">
                  {s.title}
                </h3>
                <p className="mt-2 max-w-[36ch] text-[14.5px] leading-[1.6] text-[color:var(--color-muted)]">
                  {s.body}
                </p>
              </div>

              <div className="mt-auto rounded-xl bg-[color:var(--color-panel-hi)] px-4 py-3.5 font-[family-name:var(--font-mono)] text-[13px]">
                <div className="flex items-center gap-2">
                  <span className="text-[color:var(--color-muted)]">{s.code.prompt}</span>
                  <span className="truncate text-[color:var(--color-text-soft)]">
                    {renderLine(s.code.line)}
                  </span>
                </div>
                <div className="mt-3 text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
                  {s.code.tail}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}
