'use client';

import {
  defineForm,
  Email,
  Form,
  type FormValues,
  Page,
  RadioGroup,
  Submit,
  Text,
} from '@open-form-build/core';
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { CheckGlyph } from './copy-command';
import { ink } from './demo-forms';
import { fakeSubmit, LiveForm } from './live-form';

const MONO = 'font-[family-name:var(--font-mono)]';
const FLIP_MS = 1100;
const FIRST_NUMBER = 129;

const intakeConfig = defineForm({
  title: 'What are you building?',
  description: 'Two short steps. Your answer shows up in Studio.',
  success: { title: 'Response received', message: 'Opening it in Studio…' },
});

const KINDS = ['Event sign-ups', 'Feedback', 'Applications', 'Something else'];

const SubmitContext = createContext<(values: FormValues) => Promise<void>>(fakeSubmit);

function IntakeForm() {
  const onSubmit = useContext(SubmitContext);
  return (
    <Form onSubmit={onSubmit}>
      <Page title="Your form">
        <RadioGroup
          name="kind"
          label="What will it collect?"
          required
          variant="cards"
          options={KINDS}
        />
      </Page>
      <Page title="About you">
        <Text name="name" label="Name" required autoComplete="name" />
        <Email
          name="email"
          label="Email"
          required
          placeholder="you@example.com"
          description="Try a typo. The server runs this same check."
        />
      </Page>
      <Submit>Submit response</Submit>
    </Form>
  );
}

type Answer = { number: number; name: string; kind: string };
type View = 'form' | 'studio';

const SEEDED = [
  { number: 128, name: 'Kenji Mori', kind: 'Feedback', when: '4m ago' },
  { number: 127, name: 'Priya Shah', kind: 'Event sign-ups', when: '18m ago' },
  { number: 126, name: 'Tom Becker', kind: 'Applications', when: '1h ago' },
  { number: 125, name: 'Ana Souza', kind: 'Feedback', when: '3h ago' },
];

/**
 * The hero's own form, on the real runtime. Submitting it keeps the answer in
 * this component's state only and flips to a Studio responses view.
 */
export function HeroForm() {
  const [view, setView] = useState<View>('form');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [run, setRun] = useState(0);
  const flip = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(flip.current), []);

  const onSubmit = useCallback(async (values: FormValues) => {
    await fakeSubmit();
    setAnswers((prev) => [
      {
        number: FIRST_NUMBER + prev.length,
        name: String(values.name ?? ''),
        kind: String(values.kind ?? ''),
      },
      ...prev,
    ]);
    window.clearTimeout(flip.current);
    flip.current = window.setTimeout(() => setView('studio'), FLIP_MS);
  }, []);

  const fillAgain = () => {
    if (answers.length > 0) setRun((r) => r + 1);
    setView('form');
  };

  return (
    <div className="overflow-hidden rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-panel)] shadow-[var(--shadow-lift)]">
      <div className="flex h-11 items-center gap-3 border-b border-[color:var(--color-rule-soft)] pr-1.5 pl-4">
        <span
          className={`min-w-0 flex-1 truncate text-[12px] text-[color:var(--color-muted)] ${MONO}`}
        >
          {view === 'form' ? 'localhost:3000/f/intake' : 'localhost:3000/studio'}
        </span>
        <div
          role="toolbar"
          aria-label="Show"
          className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--color-panel-hi)] p-0.5 text-[12px] font-medium"
        >
          {(['form', 'studio'] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={`pressable inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 ${
                view === v
                  ? 'bg-[color:var(--color-panel)] text-[color:var(--color-text)] shadow-[var(--shadow-edge)]'
                  : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
              }`}
            >
              {v === 'form' ? 'Form' : 'Studio'}
              {v === 'studio' && answers.length > 0 ? (
                <span
                  key={answers.length}
                  className={`swap-in nums rounded-full bg-[color:var(--color-text)] px-1.5 text-[10.5px] leading-[16px] text-[color:var(--color-ink)] ${MONO}`}
                >
                  {answers.length}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="relative h-[500px] [--frame-min:488px] max-sm:h-auto max-sm:min-h-[500px]">
        <div
          hidden={view !== 'form'}
          className="demo-frame absolute inset-0 overflow-y-auto overscroll-contain px-2 pt-3 max-sm:static max-sm:overflow-visible sm:px-4 [&_.of-root]:bg-transparent"
        >
          <SubmitContext.Provider value={onSubmit}>
            <LiveForm key={run} form={IntakeForm} config={intakeConfig} theme={ink} themeId="ink" />
          </SubmitContext.Provider>
        </div>
        {view === 'studio' ? <StudioView answers={answers} onFillAgain={fillAgain} /> : null}
      </div>

      <div
        className={`flex h-9 items-center justify-between border-t border-[color:var(--color-rule-soft)] px-4 text-[11px] tracking-[0.08em] text-[color:var(--color-muted)] uppercase ${MONO}`}
      >
        <span>Demo · nothing leaves your browser</span>
        <span className="hidden sm:inline">Real runtime</span>
      </div>
    </div>
  );
}

function StudioView({ answers, onFillAgain }: { answers: Answer[]; onFillAgain: () => void }) {
  const latest = answers[0];
  const rows = [
    ...answers.map((a) => ({ ...a, when: 'just now', fresh: true })),
    ...SEEDED.map((s) => ({ ...s, fresh: false })),
  ].slice(0, 5);
  const trail: [string, string][] = [
    ['Checked in the browser', 'required · email'],
    ['POST /api/forms/intake/submissions', '201'],
    ['Checked again on the server', 'same rules'],
    ['Stored in .open-form/open-form.db', latest ? `#${latest.number}` : ''],
  ];

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
        <span className="flex items-baseline gap-2 text-[14px] font-medium text-[color:var(--color-text)]">
          intake
          <span className="text-[12px] font-normal text-[color:var(--color-muted)]">
            <span className="nums">{SEEDED[0].number + answers.length}</span> responses
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {['xlsx', 'csv', 'json'].map((f) => (
            <span
              key={f}
              className={`rounded-[4px] border border-[color:var(--color-rule)] px-1.5 py-0.5 text-[10.5px] text-[color:var(--color-text-soft)] uppercase ${MONO}`}
            >
              {f}
            </span>
          ))}
        </span>
      </div>

      <table className="w-full shrink-0 table-fixed text-left text-[13px]">
        <thead>
          <tr className="caption h-8 border-y border-[color:var(--color-rule-soft)]">
            <th className="w-14 pl-4 font-medium">#</th>
            <th className="font-medium">Name</th>
            <th className="hidden font-medium sm:table-cell">Collecting</th>
            <th className="w-24 pr-4 text-right font-medium">Submitted</th>
          </tr>
        </thead>
        <tbody>
          {answers.length === 0 ? (
            <tr className="h-10 border-b border-[color:var(--color-rule-soft)]">
              <td colSpan={4} className="px-4">
                <button
                  type="button"
                  onClick={onFillAgain}
                  className="flex h-7 w-full items-center justify-center rounded-[4px] border border-dashed border-[color:var(--color-dim)] text-[12.5px] text-[color:var(--color-muted)] transition-colors hover:text-[color:var(--color-text)]"
                >
                  Your response lands here. Fill in the form →
                </button>
              </td>
            </tr>
          ) : null}
          {rows.map((r) => (
            <tr
              key={r.number}
              className={`h-10 border-b border-[color:var(--color-rule-soft)] ${r.fresh ? 'row-in' : ''}`}
            >
              <td className={`nums pl-4 text-[color:var(--color-muted)] ${MONO}`}>{r.number}</td>
              <td className="truncate pr-3 text-[color:var(--color-text)]">{r.name}</td>
              <td className="hidden truncate pr-3 text-[color:var(--color-text-soft)] sm:table-cell">
                {r.kind}
              </td>
              <td className="pr-4 text-right text-[color:var(--color-muted)]">{r.when}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-auto flex flex-col gap-3 border-t border-[color:var(--color-rule-soft)] px-4 py-4">
        <span className="caption">{latest ? `What happened to #${latest.number}` : 'Waiting'}</span>
        <ol className={`flex flex-col gap-1.5 text-[12px] ${MONO}`}>
          {trail.map(([step, value], i) => (
            <li key={step} className="flex items-center gap-2.5">
              <span className="inline-flex size-4 shrink-0 items-center justify-center">
                {latest ? (
                  <CheckGlyph
                    key={latest.number}
                    className="tick-in size-3.5 text-[color:var(--color-success)]"
                    style={{ animationDelay: `${150 + i * 140}ms` }}
                  />
                ) : (
                  <span className="size-1 rounded-full bg-[color:var(--color-dim)]" />
                )}
              </span>
              <span
                className={`truncate ${latest ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)]'}`}
              >
                {step}
              </span>
              <span className="ml-auto shrink-0 text-[color:var(--color-muted)]">
                {latest ? value : ''}
              </span>
            </li>
          ))}
        </ol>
        {latest ? (
          <button
            type="button"
            onClick={onFillAgain}
            className="self-start text-[12.5px] font-medium text-[color:var(--color-text-soft)] underline decoration-[color:var(--color-rule)] underline-offset-4 transition-colors hover:text-[color:var(--color-text)]"
          >
            Fill it in again
          </button>
        ) : null}
      </div>
    </div>
  );
}
