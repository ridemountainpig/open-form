import type { ReactNode } from 'react';
import { AgentLogos } from './agents';
import { FormAnatomy } from './form-anatomy';
import { Container, SectionHeading } from './frame';
import { PromptComposer } from './prompt-composer';
import { CommentVisual } from './visuals';

const mono = 'font-[family-name:var(--font-mono)] text-[13px] text-[color:var(--color-text)]';

export function Features() {
  return (
    <section id="features">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading
          number="03"
          label="Authoring"
          title="Written by your agent. Reviewed by you."
          lead="A form is one React component in your repo. Your agent drafts it, Studio previews it, and your notes go back into the file."
        />

        <div
          data-reveal
          className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-rule)] lg:grid-cols-2"
        >
          <FeatureCell
            wide
            number="3.1"
            title="One file holds the whole form."
            body="Fields, pages, conditions and submission rules are components in one .tsx file. Open Form renders it once on the server to learn its fields, so the browser and the API enforce the same rules."
            visual={<FormAnatomy />}
          />

          <FeatureCell
            number="3.2"
            title={
              <>
                <span className={mono}>/create-form</span> writes the first draft.
              </>
            }
            body="It asks what it needs, proposes three visual directions for your audience, then writes the form and checks it."
            visual={<PromptComposer />}
          />

          <FeatureCell
            number="3.3"
            title="Works with the agent you already use."
            body="Forms are plain .tsx files and the skills are Markdown, so any agent that edits code can write one."
            visual={<AgentLogos />}
          />

          <FeatureCell
            wide
            side
            number="3.4"
            title="Mark it up like a paper form."
            body={
              <>
                Select anything in Studio&apos;s Edit mode and leave a note. It lands in the source
                as a comment, and <span className={mono}>/apply-comments</span> makes the change.
              </>
            }
            visual={<CommentVisual />}
          />
        </div>
      </Container>
    </section>
  );
}

function FeatureCell({
  number,
  title,
  body,
  visual,
  wide = false,
  side = false,
}: {
  number: string;
  title: ReactNode;
  body: ReactNode;
  visual: ReactNode;
  wide?: boolean;
  side?: boolean;
}) {
  return (
    <article
      className={`flex flex-col bg-[color:var(--color-panel)] ${wide ? 'lg:col-span-2' : ''} ${
        side ? 'lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]' : ''
      }`}
    >
      <div
        className={`flex flex-1 items-center justify-center bg-[color:var(--color-panel-hi)] p-6 sm:p-8 ${
          side ? 'lg:order-2' : ''
        }`}
      >
        <div className="w-full">{visual}</div>
      </div>
      <div
        className={`flex flex-col gap-2 px-6 py-5 sm:px-7 sm:py-6 ${side ? 'lg:justify-center lg:py-10' : ''}`}
      >
        <span className="font-[family-name:var(--font-mono)] text-[11.5px] text-[color:var(--color-muted)]">
          {number}
        </span>
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
