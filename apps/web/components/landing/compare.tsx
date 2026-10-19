import { Container, SectionHeading } from './frame';

const columns = [
  { name: 'Hosted builders', examples: 'Typeform, Tally, Google Forms' },
  { name: 'Form libraries', examples: 'React Hook Form, Formik' },
  { name: 'Open Form', examples: 'npm create open-form' },
];

const OURS = columns.length - 1;
/** Phones read Open Form first, then the two alternatives. */
const MOBILE_ORDER = [OURS, 0, 1];

const rows: [string, string, string, string][] = [
  ['The form is', 'A document in their app', 'Code in your repo', 'Code in your repo'],
  ['Who writes it', 'You, in their editor', 'You, in code', 'Your agent, with built-in skills'],
  [
    'Validation',
    'Theirs',
    'In the browser; the server is yours to write',
    'One set of rules, run in the browser and on the server',
  ],
  ['Submission API', 'Theirs', 'You build it', 'Included'],
  ['Spam and limits', 'Theirs', 'You build it', 'Honeypot, timing token, rate limits, caps'],
  ['Responses', 'Their dashboard', 'You build it', 'Studio, with Excel, CSV and JSON export'],
  ['Where answers live', 'Their servers', 'Wherever you put them', 'A SQLite file on your server'],
  ['Changes reviewed in', 'Their editor', 'Pull requests', 'Pull requests'],
];

export function Compare() {
  return (
    <section id="compare">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading
          number="06"
          label="Compare"
          title="Not a builder. Not just a library."
          lead="Builders keep the form and the answers in their product. Libraries stop at the browser. Open Form keeps the form in your repo and brings the backend with it."
        />

        <div
          data-reveal
          className="divide-y divide-[color:var(--color-rule-soft)] rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-panel)] md:hidden"
        >
          {rows.map(([aspect, ...cells]) => (
            <div key={aspect} className="px-4 py-4">
              <p className="caption mb-2.5 font-medium">{aspect}</p>
              <dl className="grid gap-1">
                {MOBILE_ORDER.map((i) => {
                  const ours = i === OURS;
                  return (
                    <div
                      key={columns[i].name}
                      className={`-mx-2 grid grid-cols-[7.25rem_minmax(0,1fr)] gap-3 rounded-[5px] px-2 py-1.5 text-[14px] leading-[1.45] ${
                        ours ? 'bg-[color:var(--color-panel-hi)]' : ''
                      }`}
                    >
                      <dt
                        className={`pt-px font-[family-name:var(--font-mono)] text-[11.5px] ${
                          ours
                            ? 'text-[color:var(--color-text)]'
                            : 'text-[color:var(--color-muted)]'
                        }`}
                      >
                        {columns[i].name}
                      </dt>
                      <dd
                        className={
                          ours
                            ? 'font-medium text-[color:var(--color-text)]'
                            : 'text-[color:var(--color-text-soft)]'
                        }
                      >
                        {cells[i]}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ))}
        </div>

        <div
          data-reveal
          className="hidden overflow-x-auto rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-panel)] md:block"
        >
          <table className="w-full min-w-[680px] table-fixed border-collapse text-left text-[14px]">
            <caption className="sr-only">
              Open Form compared with hosted builders and libraries
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-[19%] border-b border-[color:var(--color-rule)] p-4">
                  <span className="sr-only">Aspect</span>
                </th>
                {columns.map((c, i) => {
                  const ours = i === OURS;
                  return (
                    <th
                      key={c.name}
                      scope="col"
                      className={`border-b border-l border-[color:var(--color-rule)] px-5 py-4 align-bottom font-normal ${
                        ours
                          ? 'bg-[color:var(--color-text)] text-[color:var(--color-ink)]'
                          : 'text-[color:var(--color-text)]'
                      }`}
                    >
                      <span className="block text-[15px] font-medium tracking-[-0.01em]">
                        {c.name}
                      </span>
                      <span
                        className={`mt-1 block font-[family-name:var(--font-mono)] text-[11.5px] ${
                          ours ? 'opacity-70' : 'text-[color:var(--color-muted)]'
                        }`}
                      >
                        {c.examples}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map(([aspect, ...cells]) => (
                <tr
                  key={aspect}
                  className="border-b border-[color:var(--color-rule-soft)] last:border-0"
                >
                  <th scope="row" className="caption p-4 align-top font-medium">
                    {aspect}
                  </th>
                  {cells.map((cell, i) => {
                    const ours = i === OURS;
                    return (
                      <td
                        key={`${aspect}-${columns[i].name}`}
                        className={`border-l border-[color:var(--color-rule)] px-5 py-4 align-top leading-[1.5] ${
                          ours
                            ? 'bg-[color:var(--color-panel-hi)] font-medium text-[color:var(--color-text)]'
                            : 'text-[color:var(--color-text-soft)]'
                        }`}
                      >
                        {cell}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </section>
  );
}
