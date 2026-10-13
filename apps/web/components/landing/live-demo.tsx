'use client';

import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { CodeLines } from './code-lines';
import { MeetupConversational, MeetupForm, meetupConfig, starters } from './demo-forms';
import { Container } from './frame';
import { LiveForm } from './live-form';

function meetupSource(themeId: string): string[] {
  const head = [
    "import { defineForm, Email, Form, Page, Select, Submit, Text, When } from '@open-form-build/core';",
    `import theme from './theme/index.tsx'; // this form's copy of ${themeId}`,
    '',
    'export const config = defineForm({',
    "  title: 'Developer Meetup',",
    "  description: 'Thursday, 7 PM. Free entry, 100 seats.',",
    "  submissions: { maxResponses: 100, uniqueBy: 'email' },",
    '});',
    '',
  ];
  if (themeId === 'conversational') {
    return [
      ...head,
      '// One question per screen, as this theme asks.',
      'export default function Meetup() {',
      '  return (',
      '    <Form theme={theme}>',
      '      <Page><Text name="firstName" label="First, what\'s your name?" required /></Page>',
      '      <Page><Email name="email" label="Where should we send your ticket?" required /></Page>',
      '      <Page><RadioGroup name="role" label="What best describes you?" options={roles} /></Page>',
      '      <When field="role" equals="Student">',
      '        <Page><Text name="school" label="Which school?" required /></Page>',
      '      </When>',
      '      <Page><Rating name="excitement" label="How excited are you?" /></Page>',
      '      <Submit>Register</Submit>',
      '    </Form>',
      '  );',
      '}',
    ];
  }
  return [
    ...head,
    'export default function Meetup() {',
    '  return (',
    '    <Form theme={theme}>',
    '      <Page title="About you">',
    '        <Row>',
    '          <Text name="firstName" label="First name" required />',
    '          <Text name="lastName" label="Last name" required />',
    '        </Row>',
    '        <Email name="email" label="Email" required description="Your ticket goes here." />',
    '      </Page>',
    '      <Page title="Background">',
    '        <Select name="role" label="What best describes you?" required options={roles} />',
    '        <When field="role" equals="Student">',
    '          <Text name="school" label="School" required />',
    '        </When>',
    '        <RadioGroup name="experience" label="Years of experience" variant="cards" … />',
    '      </Page>',
    '      <Page title="Almost done">',
    '        <CheckboxGroup name="interests" label="Topics you\'re into" maxSelected={3} … />',
    '        <Rating name="excitement" label="How excited are you?" />',
    '        <Checkbox name="codeOfConduct" required>I agree to the code of conduct</Checkbox>',
    '      </Page>',
    '      <Submit>Register</Submit>',
    '    </Form>',
    '  );',
    '}',
  ];
}

const THEME_LINE = 1;
type View = 'form' | 'code';

export function LiveDemo() {
  const baseId = useId();
  const reduced = useReducedMotion();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [index, setIndex] = useState(0);
  const [view, setView] = useState<View>('form');
  const [run, setRun] = useState(0);
  const starter = starters[index];
  const conversational = starter.id === 'conversational';

  const select = (i: number) => {
    setIndex(i);
    setRun((r) => r + 1);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowRight') next = (index + 1) % starters.length;
    else if (e.key === 'ArrowLeft') next = (index - 1 + starters.length) % starters.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = starters.length - 1;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="demo" aria-labelledby="demo-heading">
      <Container className="pt-14 pb-8 sm:pt-16 sm:pb-12">
        <h2 id="demo-heading" className="sr-only">
          Live demo
        </h2>
        <div
          data-reveal
          className="rise-frame relative overflow-hidden rounded-2xl border border-[color:var(--color-rule)] bg-[color:var(--color-panel)] shadow-[var(--shadow-lift)]"
          style={{ animationDelay: '560ms' }}
        >
          <div className="flex h-11 items-center gap-3 border-b border-[color:var(--color-rule-soft)] px-4">
            <span aria-hidden="true" className="hidden gap-1.5 sm:flex">
              <i className="size-2.5 rounded-full bg-[color:var(--color-rule)]" />
              <i className="size-2.5 rounded-full bg-[color:var(--color-rule)]" />
              <i className="size-2.5 rounded-full bg-[color:var(--color-rule)]" />
            </span>
            <span className="min-w-0 flex-1 truncate text-center font-[family-name:var(--font-mono)] text-[12px] text-[color:var(--color-muted)]">
              {view === 'form' ? 'localhost:3000/f/meetup' : 'forms/meetup/index.tsx'}
            </span>
            <div
              role="toolbar"
              aria-label="Show"
              className="inline-flex items-center gap-0.5 rounded-full bg-[color:var(--color-panel-hi)] p-0.5 text-[12px] font-medium"
            >
              {(['form', 'code'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={view === v}
                  onClick={() => setView(v)}
                  className={`pressable h-6 rounded-full px-2.5 ${
                    view === v
                      ? 'bg-[color:var(--color-panel)] text-[color:var(--color-text)] shadow-[var(--shadow-edge)]'
                      : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                  }`}
                >
                  {v === 'form' ? 'Form' : 'Source'}
                </button>
              ))}
            </div>
          </div>

          <div className="relative h-[600px] sm:h-[640px]">
            {view === 'form' ? (
              <div className="demo-frame absolute inset-0 overflow-y-auto overscroll-contain">
                <LiveForm
                  key={`${starter.id}-${run}`}
                  form={conversational ? MeetupConversational : MeetupForm}
                  config={meetupConfig}
                  theme={starter.theme}
                  themeId={starter.id}
                />
              </div>
            ) : (
              <pre className="absolute inset-0 overflow-auto bg-[color:var(--color-panel)] p-5 font-[family-name:var(--font-mono)] text-[12.5px] leading-[1.7] sm:p-7 sm:text-[13px]">
                <CodeLines
                  lines={meetupSource(starter.id)}
                  pulse={[THEME_LINE]}
                  pulseKey={starter.id}
                />
              </pre>
            )}
          </div>
        </div>

        <div
          className="rise mt-4 flex flex-col-reverse items-start justify-between gap-3 sm:flex-row sm:items-center"
          style={{ animationDelay: '760ms' }}
        >
          <p className="text-[13px] text-[color:var(--color-muted)]">
            The real runtime: validation, conditions and steps all work.{' '}
            <Link
              href="/docs/core-feature/themes"
              className="font-medium text-[color:var(--color-text-soft)] underline decoration-[color:var(--color-rule)] underline-offset-4 hover:text-[color:var(--color-text)]"
            >
              Themes
            </Link>
          </p>
          <div
            role="tablist"
            aria-label="Starter theme"
            onKeyDown={onKeyDown}
            className="inline-flex max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-[color:var(--color-panel-hi)] p-0.5"
          >
            {starters.map((s, i) => {
              const selected = i === index;
              return (
                <button
                  key={s.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(i)}
                  className={`relative h-7 shrink-0 rounded-full px-3 text-[12.5px] font-medium transition-colors duration-200 ${
                    selected
                      ? 'text-[color:var(--color-text)]'
                      : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                  }`}
                >
                  {selected ? (
                    <motion.span
                      layoutId={`${baseId}-pill`}
                      className="absolute inset-0 rounded-full bg-[color:var(--color-panel)] shadow-[var(--shadow-edge)]"
                      transition={
                        reduced ? { duration: 0 } : { type: 'spring', bounce: 0.15, duration: 0.45 }
                      }
                    />
                  ) : null}
                  <span className="relative">{s.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
