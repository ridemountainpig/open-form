import type { ReactNode } from 'react';
import { AgentLogos } from './agents';
import { FormAnatomy } from './form-anatomy';
import { Container, SectionHeading } from './frame';
import { PromptComposer } from './prompt-composer';
import { CommentVisual, PipelineVisual, ResponsesVisual, ThemesVisual } from './visuals';

const mono = 'font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-text)]';

export function Features() {
  return (
    <section id="features">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading
          eyebrow="Features"
          title="Just React. And everything around it."
          lead="No builder, no schema to keep in sync. A form is a component in your repo — the runtime, the API, the database and the dashboard come with it."
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <FeatureCard
            wide
            title="A form is a file."
            body="Fields, pages and conditions are components in one .tsx file. Open Form renders it once on the server to learn its fields, so the browser and the API enforce the same rules."
            visual={<FormAnatomy />}
          />

          <FeatureCard
            title="Prompt to form."
            body={
              <>
                <span className={mono}>/create-form</span> asks what it needs, proposes three visual
                directions for your audience, then writes and checks the form.
              </>
            }
            visual={<PromptComposer />}
          />

          <FeatureCard
            title="Bring your own agent."
            body="Forms are plain .tsx files and the skills are Markdown, so any agent that edits code already works."
            visual={<AgentLogos />}
          />

          <FeatureCard
            title="The backend is included."
            body="Server validation, honeypot, signed timing token, rate limits, response caps and one-per-email — stored in SQLite with no infrastructure to run."
            visual={<PipelineVisual />}
          />

          <FeatureCard
            title="Responses, not a database."
            body="Studio lists every response with search, detail and delete. Export to Excel, CSV or JSON, or send each one to a webhook."
            visual={<ResponsesVisual />}
          />

          <FeatureCard
            title="Comment. The agent applies."
            body={
              <>
                Select anything in Studio&apos;s Edit mode and leave a note. It lands in the source;{' '}
                <span className={mono}>/apply-comments</span> makes the change.
              </>
            }
            visual={<CommentVisual />}
          />

          <FeatureCard
            title="Designed, not defaulted."
            body={
              <>
                Five starters to start from. Each form keeps its own copy of its theme, so the look
                is yours to change. Or have <span className={mono}>/create-theme</span> match your
                design system.
              </>
            }
            visual={<ThemesVisual />}
          />
        </div>
      </Container>
    </section>
  );
}

function FeatureCard({
  title,
  body,
  visual,
  wide = false,
}: {
  title: string;
  body: ReactNode;
  visual: ReactNode;
  wide?: boolean;
}) {
  return (
    <article
      data-reveal
      className={`flex flex-col overflow-hidden rounded-2xl border border-[color:var(--color-rule-soft)] bg-[color:var(--color-panel)] transition-colors duration-300 hover:border-[color:var(--color-rule)] ${
        wide ? 'lg:col-span-2' : ''
      }`}
    >
      <div className="flex flex-1 items-center justify-center bg-[color:var(--color-panel-hi)] p-6 sm:p-8">
        <div className="w-full">{visual}</div>
      </div>
      <div className="flex flex-col gap-1.5 px-6 py-5 sm:px-7 sm:py-6">
        <h3 className="text-[17px] font-medium leading-[1.3] tracking-[-0.015em] text-[color:var(--color-text)]">
          {title}
        </h3>
        <p className="max-w-[56ch] text-pretty text-[14.5px] leading-[1.55] text-[color:var(--color-muted)]">
          {body}
        </p>
      </div>
    </article>
  );
}
