'use client';

import type { FormAvailability, FormConfig, NavigationInfo } from '@open-form-build/core';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import {
  type ComponentType,
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useId,
  useRef,
  useState,
} from 'react';
import { CodeLines } from './code-lines';
import {
  BetaForm,
  betaConfig,
  ink,
  LaunchForm,
  launchConfig,
  RoleForm,
  roleConfig,
  TalkForm,
  talkConfig,
} from './demo-forms';
import { LiveForm } from './live-form';

type PolicyState = 'open' | 'full' | 'closed';

type Tab = {
  id: string;
  label: string;
  docs: string;
  docsLabel: string;
  file: string;
  lines: string[];
  form: ComponentType;
  config: FormConfig;
  caption: string;
  /** Source line of each field, highlighted while it has focus. */
  fieldLines: Record<string, number>;
};

const BETA_LINES = [
  "import { defineForm, Email, Form, Select, Submit, Text } from '@open-form-build/core';",
  '',
  "export const config = defineForm({ title: 'Join the beta' });",
  '',
  'export default function Beta() {',
  '  return (',
  '    <Form>',
  '      <Text name="name" label="Name" required />',
  '      <Email name="email" label="Work email" required />',
  '      <Select name="team" label="Team size" options={sizes} />',
  '      <Submit>Request access</Submit>',
  '    </Form>',
  '  );',
  '}',
];

const ROLE_LINES = [
  "import { defineForm, Email, Form, RadioGroup, Submit, Text, When } from '@open-form-build/core';",
  '',
  "export const config = defineForm({ title: 'Workshop sign-up' });",
  '',
  'export default function Workshop() {',
  '  return (',
  '    <Form>',
  '      <Email name="email" label="Email" required />',
  "      <RadioGroup name=\"role\" label=\"Role\" options={['Student', 'Engineer', 'Designer']} />",
  '      <When field="role" equals="Student">',
  '        <Text name="school" label="School" required />',
  '      </When>',
  '      <Submit>Sign up</Submit>',
  '    </Form>',
  '  );',
  '}',
];
const WHEN_LINES = [9, 10, 11];

const TALK_LINES = [
  "import { defineForm, Email, Form, Page, Submit, Text, Textarea } from '@open-form-build/core';",
  '',
  "export const config = defineForm({ title: 'Call for speakers' });",
  '',
  'export default function Speakers() {',
  '  return (',
  '    <Form>',
  '      <Page title="About you">',
  '        <Text name="name" label="Name" required />',
  '        <Email name="email" label="Email" required />',
  '      </Page>',
  '      <Page title="Your talk">',
  '        <Text name="talkTitle" label="Talk title" required maxLength={80} />',
  '        <Textarea name="abstract" label="Abstract" maxLength={400} />',
  '      </Page>',
  '      <Submit>Apply</Submit>',
  '    </Form>',
  '  );',
  '}',
];
const PAGE_LINES = [7, 11];
const SUBMIT_LINE = 15;

const LAUNCH_LINES = [
  "import { defineForm, Email, Form, Submit, Text } from '@open-form-build/core';",
  "import { LaunchClosed } from './closed';",
  '',
  'export const config = defineForm({',
  "  title: 'Launch party',",
  '  submissions: {',
  '    maxResponses: 100,',
  "    uniqueBy: 'email',",
  "    closesAt: '2026-10-30',",
  "    fullMessage: 'All 100 spots are taken.',",
  "    closedMessage: 'Sign-ups closed on Oct 30.',",
  '  },',
  '});',
  '',
  'export default function Launch() {',
  '  return (',
  '    <Form components={{ Notice: LaunchClosed }}>',
  '      <Text name="name" label="Name" required />',
  '      <Email name="email" label="Email" required />',
  '      <Submit>Save my spot</Submit>',
  '    </Form>',
  '  );',
  '}',
];
const POLICY_LINES: Record<PolicyState, number[]> = {
  open: [7],
  full: [1, 6, 9, 16],
  closed: [1, 8, 10, 16],
};

const TABS: Tab[] = [
  {
    id: 'fields',
    label: 'Fields',
    docs: '/docs/components/fields',
    docsLabel: 'Fields',
    file: 'forms/beta/index.tsx',
    lines: BETA_LINES,
    form: BetaForm,
    config: betaConfig,
    caption:
      'Each field brings its label, validation and ARIA. Submit it empty: the browser shows the same errors the server would return.',
    fieldLines: { name: 7, email: 8, team: 9 },
  },
  {
    id: 'when',
    label: 'When',
    docs: '/docs/components/when',
    docsLabel: 'When',
    file: 'forms/workshop/index.tsx',
    lines: ROLE_LINES,
    form: RoleForm,
    config: roleConfig,
    caption:
      'Pick Student and the follow-up appears. Hidden answers are dropped on the server, so required means required when shown.',
    fieldLines: { email: 7, role: 8, school: 10 },
  },
  {
    id: 'page',
    label: 'Page',
    docs: '/docs/components/page',
    docsLabel: 'Page',
    file: 'forms/speakers/index.tsx',
    lines: TALK_LINES,
    form: TalkForm,
    config: talkConfig,
    caption:
      'Two pages and you get progress, Back and Next, and validation per step. Wrap a Page in When to skip it.',
    fieldLines: { name: 8, email: 9, talkTitle: 12, abstract: 13 },
  },
  {
    id: 'policy',
    label: 'Policy',
    docs: '/docs/core-feature/submissions',
    docsLabel: 'Submissions',
    file: 'forms/launch/index.tsx',
    lines: LAUNCH_LINES,
    form: LaunchForm,
    config: launchConfig,
    caption:
      'Limits, deadlines and one response per email are checked inside the server’s database transaction. The closed screen is yours to design: switch states to see it.',
    fieldLines: { name: 17, email: 18 },
  },
];

const MAX_LINES = Math.max(...TABS.map((t) => t.lines.length));

export function FormAnatomy() {
  const baseId = useId();
  const reduced = useReducedMotion();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const tab = TABS[index];

  const select = (i: number) => setIndex(i);
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = TABS.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Form anatomy"
          onKeyDown={onKeyDown}
          className="inline-flex items-center gap-0.5 rounded-lg bg-[color:var(--color-panel)] p-1 shadow-[var(--shadow-edge)]"
        >
          {TABS.map((t, i) => {
            const selected = i === index;
            return (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                type="button"
                role="tab"
                id={`${baseId}-tab-${t.id}`}
                aria-selected={selected}
                aria-controls={`${baseId}-panel`}
                tabIndex={selected ? 0 : -1}
                onClick={() => select(i)}
                className={`relative h-8 rounded-md px-3.5 text-[13px] font-medium transition-colors duration-200 ${
                  selected
                    ? 'text-[color:var(--color-text)]'
                    : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                }`}
              >
                {selected ? (
                  <motion.span
                    layoutId={`${baseId}-pill`}
                    className="absolute inset-0 rounded-md"
                    style={{ background: 'color-mix(in oklab, var(--color-text) 6%, transparent)' }}
                    transition={
                      reduced ? { duration: 0 } : { type: 'spring', bounce: 0.15, duration: 0.45 }
                    }
                  />
                ) : null}
                <span className="relative">{t.label}</span>
              </button>
            );
          })}
        </div>

        <Link
          href={tab.docs}
          className="group inline-flex items-center gap-1.5 text-[13px] font-medium text-[color:var(--color-muted)] transition-colors hover:text-[color:var(--color-text)]"
        >
          {tab.docsLabel} docs
          <span
            aria-hidden="true"
            className="transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          >
            ↗
          </span>
        </Link>
      </div>

      <motion.div
        key={tab.id}
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${tab.id}`}
        initial={reduced ? false : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
      >
        <Panel tab={tab} />
      </motion.div>
    </div>
  );
}

function Panel({ tab }: { tab: Tab }) {
  const [focused, setFocused] = useState<string | null>(null);
  const [student, setStudent] = useState(false);
  const [step, setStep] = useState<NavigationInfo | null>(null);
  const [policy, setPolicy] = useState<PolicyState>('open');
  const [run, setRun] = useState(0);

  const onNavigate = useCallback((info: NavigationInfo) => setStep(info), []);

  const live: number[] = [];
  if (focused && tab.fieldLines[focused] !== undefined) live.push(tab.fieldLines[focused]);
  if (tab.id === 'when' && student) live.push(...WHEN_LINES);
  if (tab.id === 'page' && step) live.push(step.done ? SUBMIT_LINE : (PAGE_LINES[step.step] ?? 0));
  if (tab.id === 'policy') live.push(...POLICY_LINES[policy]);

  const availability: FormAvailability | undefined =
    tab.id === 'policy' && policy !== 'open' ? { state: policy } : undefined;

  const onFocus = (e: FocusEvent<HTMLDivElement>) => {
    const name = (e.target as HTMLInputElement).name;
    setFocused(name || null);
  };
  // Radio inputs report their group's name; the When condition follows the checked one.
  const onChange = (e: { target: EventTarget }) => {
    const input = e.target as HTMLInputElement;
    if (input.name === 'role') setStudent(input.value === 'Student' && input.checked);
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <CodeWindow file={tab.file} lines={tab.lines} live={live} />
      <OutputWindow
        caption={tab.caption}
        controls={
          tab.id === 'policy' ? (
            <StateSwitch
              value={policy}
              onChange={(next) => {
                setPolicy(next);
                setRun((r) => r + 1);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setRun((r) => r + 1);
                setStudent(false);
                setStep(null);
              }}
              className="rounded-full px-2 py-0.5 normal-case tracking-normal text-[color:var(--color-muted)] transition-colors hover:bg-[color:var(--color-panel-hi)] hover:text-[color:var(--color-text)]"
            >
              Reset
            </button>
          )
        }
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: listens to the form inside, it is not a control itself */}
        <div onFocus={onFocus} onBlur={() => setFocused(null)} onChange={onChange}>
          <LiveForm
            key={run}
            form={tab.form}
            config={tab.config}
            theme={ink}
            themeId="ink"
            availability={availability}
            onNavigate={tab.id === 'page' ? onNavigate : undefined}
          />
        </div>
      </OutputWindow>
    </div>
  );
}

function StateSwitch({
  value,
  onChange,
}: {
  value: PolicyState;
  onChange: (next: PolicyState) => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Form state"
      className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--color-panel-hi)] p-0.5 normal-case tracking-normal"
    >
      {(['open', 'full', 'closed'] as const).map((s) => (
        <button
          key={s}
          type="button"
          aria-pressed={value === s}
          onClick={() => onChange(s)}
          className={`h-6 rounded-full px-2.5 text-[11.5px] font-medium capitalize transition-colors ${
            value === s
              ? 'bg-[color:var(--color-panel)] text-[color:var(--color-text)] shadow-[var(--shadow-edge)]'
              : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
          }`}
        >
          {s}
        </button>
      ))}
    </div>
  );
}

function CodeWindow({ file, lines, live }: { file: string; lines: string[]; live: number[] }) {
  return (
    <div className="overflow-hidden rounded-lg bg-[color:var(--color-panel)] shadow-[var(--shadow-window)]">
      <div className="flex h-10 items-center justify-between border-b border-[color:var(--color-rule-soft)] px-4 font-[family-name:var(--font-mono)] text-[12px] text-[color:var(--color-muted)] sm:h-11 sm:px-5">
        <span>{file}</span>
        <span className="hidden tracking-[0.08em] uppercase sm:inline">
          tsx · {lines.length} lines
        </span>
      </div>
      <pre className="overflow-x-auto p-4 font-[family-name:var(--font-mono)] text-[12px] leading-[1.7] sm:p-5 sm:text-[12.5px]">
        <CodeLines lines={lines} live={live} minLines={MAX_LINES} />
      </pre>
    </div>
  );
}

function OutputWindow({
  caption,
  controls,
  children,
}: {
  caption: string;
  controls?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-lg bg-[color:var(--color-panel)] p-4 shadow-[var(--shadow-window)] sm:p-5">
      <div className="mb-4 flex h-6 items-center justify-between font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-muted)]">
        <span className="flex items-center gap-2">
          <span className="relative flex size-1.5 items-center justify-center">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-[color:var(--color-success)] opacity-60 motion-reduce:animate-none" />
            <span className="relative inline-flex size-1.5 rounded-full bg-[color:var(--color-success)]" />
          </span>
          live form
        </span>
        {controls}
      </div>
      <div className="relative min-h-[380px] flex-1 overflow-hidden rounded-[6px] border border-[color:var(--color-rule)]">
        <div className="absolute inset-0 overflow-y-auto overscroll-contain p-5 sm:p-6 [&_.of-root]:bg-transparent">
          {children}
        </div>
      </div>
      <p className="mt-4 text-pretty text-[13px] leading-[1.5] text-[color:var(--color-muted)]">
        {caption}
      </p>
    </div>
  );
}
