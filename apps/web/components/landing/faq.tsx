import { FaqItem } from './faq-item';
import { Container, SectionHeading } from './frame';

export type QA = { q: string; a: string };

export const faqs: QA[] = [
  {
    q: 'What is Open Form?',
    a: 'Open Form is an open-source form framework for the agent era, for sign-ups, surveys, applications and feedback. A form is a small React component in your repo — questions, conditions and submission rules. Open Form supplies the runtime around it: state, validation on the client and the server, multi-step flow, accessible responsive UI, the submission API, spam protection, SQLite storage and a Studio for previews and responses.',
  },
  {
    q: 'How is it different from Typeform, Google Forms or Tally?',
    a: 'Those are hosted form builders: the form and the answers live in someone else’s product. With Open Form the form is code in your repo — reviewed in pull requests, written by your agent — and everything is self-hosted: the responses live in a SQLite file on your own server. There is deliberately no drag-and-drop builder.',
  },
  {
    q: 'How is it different from React Hook Form or Formik?',
    a: 'Those manage form state in the browser and leave the rest to you. Open Form also ships the server side: one set of validation rules that runs in the browser and in the API, conditional fields that are dropped on the server when hidden, response limits, deadlines, rate limiting, storage, export and a dashboard.',
  },
  {
    q: 'Which coding agents work with Open Form?',
    a: 'Any agent that can edit files. Every workspace ships an AGENTS.md (with CLAUDE.md pointing to it) and five skills — create-form, form-authoring, create-theme, current-form and apply-comments — that Claude Code, Codex, Cursor, Gemini CLI, OpenCode, Windsurf and Zed can use. There is no proprietary protocol.',
  },
  {
    q: 'Where are responses stored?',
    a: 'In .open-form/open-form.db, a SQLite database created by Node’s built-in node:sqlite — no database server, no native addon. The folder is gitignored, because responses are personal data. Export to Excel, CSV or JSON from Studio or the CLI, send each new response to a webhook, or plug in your own StorageAdapter.',
  },
  {
    q: 'Can I use it inside my Next.js app?',
    a: 'Yes. @open-form-build/core/next mounts the submission and admin API as a route handler, and <FormHost> renders a form inside any React page. Validation still comes from the same form files.',
  },
  {
    q: 'Is Open Form open source?',
    a: 'Yes, under the MIT license. The whole framework is one npm package, @open-form-build/core. It needs Node.js 22.13 or later and starts with npm create open-form@latest.',
  },
];

export function FAQ() {
  return (
    <section id="faq">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading number="07" label="FAQ" title="What people ask first." />

        <dl
          data-reveal="stagger"
          className="max-w-[820px] divide-y divide-[color:var(--color-rule-soft)] border-b border-[color:var(--color-rule-soft)] lg:ml-auto"
        >
          {faqs.map((item, idx) => (
            <FaqItem key={item.q} item={item} index={idx} />
          ))}
        </dl>
      </Container>
    </section>
  );
}
