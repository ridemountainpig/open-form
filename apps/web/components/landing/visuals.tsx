'use client';

import { type ReactNode, useRef } from 'react';
import { CodeLines } from './code-lines';
import { CheckGlyph } from './copy-command';
import { useLoop } from './use-loop';

const MONO = 'font-[family-name:var(--font-mono)]';

function Window({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-[color:var(--color-panel)] shadow-[var(--shadow-window)]">
      <div
        className={`flex h-10 items-center justify-between gap-3 border-b border-[color:var(--color-rule-soft)] px-4 text-[12px] text-[color:var(--color-muted)] ${MONO}`}
      >
        <span className="truncate">{title}</span>
        {meta}
      </div>
      {children}
    </div>
  );
}

const CHECKS: [string, string][] = [
  ['same-origin · JSON', 'ok'],
  ['window', 'open until Oct 30'],
  ['honeypot', 'empty'],
  ['timing token', '4.2s ≥ 2s'],
  ['rate limit', '1 / 10 per 10m'],
  ['validate', '9 fields, 0 errors'],
  ['uniqueBy email', 'new'],
  ['maxResponses', '48 / 100'],
];
const CHECK_CUES = [...CHECKS.map((_, i) => 300 + i * 260), 300 + CHECKS.length * 260 + 200];
const CHECK_LOOP = 6400;

export function PipelineVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, cycle } = useLoop(ref, CHECK_CUES, CHECK_LOOP);
  const done = phase > CHECKS.length;

  return (
    <div ref={ref}>
      <Window
        title="POST /api/forms/meetup/submissions"
        meta={
          <span
            key={`${cycle}-${done}`}
            className={`swap-in shrink-0 rounded-full px-2 py-0.5 text-[11px] ${
              done
                ? 'bg-[color:color-mix(in_oklab,var(--color-success)_14%,transparent)] text-[color:var(--color-success)]'
                : 'bg-[color:var(--color-panel-hi)]'
            }`}
          >
            {done ? '201 Created' : 'pending'}
          </span>
        }
      >
        <ol className={`px-4 py-3 text-[12.5px] ${MONO}`}>
          {CHECKS.map(([label, value], i) => {
            const passed = i < phase;
            return (
              <li key={label} className="flex h-7 items-center gap-2.5">
                <span className="inline-flex size-4 items-center justify-center">
                  {passed ? (
                    <CheckGlyph
                      key={cycle}
                      className="tick-in size-3.5 text-[color:var(--color-success)]"
                    />
                  ) : (
                    <span className="size-1 rounded-full bg-[color:var(--color-dim)]" />
                  )}
                </span>
                <span
                  className={`transition-colors duration-300 ${passed ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-muted)]'}`}
                >
                  {label}
                </span>
                <span className="ml-auto truncate text-[color:var(--color-muted)]">
                  {passed ? value : ''}
                </span>
              </li>
            );
          })}
        </ol>
        <div
          className={`flex h-10 items-center justify-between border-t border-[color:var(--color-rule-soft)] px-4 text-[12px] ${MONO}`}
        >
          <span className="text-[color:var(--color-muted)]">.open-form/open-form.db</span>
          <span
            key={`${cycle}-${done}`}
            className={`swap-in ${done ? 'text-[color:var(--color-text)]' : 'text-[color:var(--color-dim)]'}`}
          >
            {done ? 'stored as response #48' : 'writing…'}
          </span>
        </div>
      </Window>
    </div>
  );
}

const RESPONSES = [
  ['47', 'Kenji Mori', 'Engineer', '2m ago'],
  ['46', 'Priya Shah', 'Designer', '9m ago'],
  ['45', 'Tom Becker', 'Product', '21m ago'],
  ['44', 'Ana Souza', 'Engineer', '1h ago'],
] as const;
const NEW_RESPONSE = ['48', 'Mei Chen', 'Student', 'just now'] as const;
const RESPONSE_CUES = [1200] as const;
const RESPONSE_LOOP = 5200;

export function ResponsesVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, cycle } = useLoop(ref, RESPONSE_CUES, RESPONSE_LOOP);
  const rows = phase > 0 ? [NEW_RESPONSE, ...RESPONSES.slice(0, 3)] : RESPONSES;

  return (
    <div ref={ref}>
      <Window
        title="Studio · meetup · Responses"
        meta={
          <span className="flex shrink-0 items-center gap-1">
            {['xlsx', 'csv', 'json'].map((f) => (
              <span
                key={f}
                className="rounded-md border border-[color:var(--color-rule)] px-1.5 py-0.5 text-[10.5px] uppercase text-[color:var(--color-text-soft)]"
              >
                {f}
              </span>
            ))}
          </span>
        }
      >
        <table className="w-full table-fixed text-left text-[12.5px]">
          <thead>
            <tr className="caption h-9 border-b border-[color:var(--color-rule-soft)]">
              <th className="w-12 pl-4 font-medium">#</th>
              <th className="font-medium">Name</th>
              <th className="hidden font-medium sm:table-cell">Role</th>
              <th className="w-24 pr-4 text-right font-medium">Submitted</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([n, name, role, when]) => (
              <tr
                key={n === '48' ? `48-${cycle}` : n}
                className={`h-10 border-b border-[color:var(--color-rule-soft)] last:border-0 ${n === '48' ? 'row-in' : ''}`}
              >
                <td className={`nums pl-4 text-[color:var(--color-muted)] ${MONO}`}>{n}</td>
                <td className="truncate text-[color:var(--color-text)]">{name}</td>
                <td className="hidden truncate text-[color:var(--color-text-soft)] sm:table-cell">
                  {role}
                </td>
                <td className="pr-4 text-right text-[color:var(--color-muted)]">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Window>
    </div>
  );
}

const COMMENT_BEFORE = [
  '<Page title="About you">',
  '  <Text name="name" label="Name" required />',
  '  <Tel name="phone" label="Phone" required />',
  '</Page>',
];
const COMMENT_MARKED = [
  '<Page title="About you">',
  '  <Text name="name" label="Name" required />',
  '  {/* @form-comment: make this optional and say why we ask */}',
  '  <Tel name="phone" label="Phone" required />',
  '</Page>',
];
const COMMENT_AFTER = [
  '<Page title="About you">',
  '  <Text name="name" label="Name" required />',
  '  <Tel name="phone" label="Phone" description="Only if the venue changes." />',
  '</Page>',
];
const COMMENT_CUES = [900, 2400, 3600] as const;
const COMMENT_LOOP = 7000;
const STAGES = [
  ['Studio', 'Edit mode · select a field'],
  ['Studio', 'Comment saved to source'],
  ['Agent', '/apply-comments'],
  ['Agent', 'Applied · marker removed'],
] as const;

export function CommentVisual() {
  const ref = useRef<HTMLDivElement>(null);
  const { phase, cycle } = useLoop(ref, COMMENT_CUES, COMMENT_LOOP);
  const lines = phase >= 3 ? COMMENT_AFTER : phase >= 1 ? COMMENT_MARKED : COMMENT_BEFORE;
  const pulse = phase >= 3 ? [2] : phase >= 1 ? [2] : [];
  const [who, what] = STAGES[Math.min(phase, STAGES.length - 1)];

  return (
    <div ref={ref}>
      <Window title="forms/meetup/index.tsx">
        <pre
          className={`overflow-x-auto px-4 py-4 text-[12px] leading-[1.7] sm:text-[12.5px] ${MONO}`}
        >
          <CodeLines
            lines={lines}
            pulse={pulse}
            pulseKey={`${cycle}-${phase}`}
            live={phase === 2 ? [2] : []}
            minLines={5}
          />
        </pre>
        <div
          className={`flex h-10 items-center gap-2.5 border-t border-[color:var(--color-rule-soft)] px-4 text-[12px] ${MONO}`}
        >
          <span className="rounded-md bg-[color:var(--color-panel-hi)] px-1.5 py-0.5 text-[10.5px] uppercase tracking-[0.06em] text-[color:var(--color-muted)]">
            {who}
          </span>
          <span
            key={`${cycle}-${phase}`}
            className={`swap-in ${phase >= 3 ? 'text-[color:var(--color-success)]' : 'text-[color:var(--color-text-soft)]'}`}
          >
            {what}
          </span>
        </div>
      </Window>
    </div>
  );
}

type Swatch = {
  id: string;
  page: string;
  card: string;
  ink: string;
  accent: string;
  accentInk: string;
  font: string;
  border?: string;
  shadow?: string;
  radius: number;
  prompt: string;
};

const SWATCHES: Swatch[] = [
  {
    id: 'classic',
    page: '#f4f4f6',
    card: '#ffffff',
    ink: '#18181b',
    accent: '#4f46e5',
    accentInk: '#ffffff',
    font: 'ui-sans-serif, system-ui, sans-serif',
    border: '1px solid #e2e2e7',
    radius: 8,
    prompt: 'Name',
  },
  {
    id: 'editorial',
    page: '#efe9df',
    card: '#f7f3ec',
    ink: '#151412',
    accent: '#151412',
    accentInk: '#f7f3ec',
    font: 'Georgia, "Times New Roman", serif',
    radius: 0,
    prompt: 'Your name',
  },
  {
    id: 'terminal',
    page: '#050706',
    card: '#0c0f0d',
    ink: '#d9e4dc',
    accent: '#5af78e',
    accentInk: '#04110a',
    font: 'ui-monospace, Menlo, monospace',
    border: '1px solid #1f2823',
    radius: 4,
    prompt: '? Name',
  },
  {
    id: 'brutalist',
    page: '#ffd84d',
    card: '#fffdf3',
    ink: '#000000',
    accent: '#ff4f9a',
    accentInk: '#000000',
    font: '"Arial Black", Helvetica, sans-serif',
    border: '2px solid #000',
    shadow: '3px 3px 0 #000',
    radius: 0,
    prompt: 'NAME',
  },
  {
    id: 'conversational',
    page: '#f8f7ff',
    card: '#ffffff',
    ink: '#1b1838',
    accent: '#5b4cf5',
    accentInk: '#ffffff',
    font: 'ui-rounded, "SF Pro Rounded", system-ui, sans-serif',
    radius: 14,
    prompt: 'Your name?',
  },
];

export function ThemesVisual() {
  return (
    <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
      {SWATCHES.map((s) => (
        <li key={s.id} className="flex min-w-0 flex-col items-center gap-2">
          <div
            aria-hidden="true"
            className="flex aspect-[3/4] w-full flex-col justify-center overflow-hidden rounded-md p-2 shadow-[var(--shadow-edge)]"
            style={{ background: s.page }}
          >
            <div
              className="flex flex-col gap-2 px-2 py-3"
              style={{
                background: s.card,
                border: s.border,
                boxShadow: s.shadow,
                borderRadius: s.radius,
                color: s.ink,
                fontFamily: s.font,
              }}
            >
              <span className="truncate text-[10px] leading-none font-semibold">{s.prompt}</span>
              <span
                className="block h-4"
                style={{
                  borderBottom: `1px solid ${s.ink}66`,
                  background:
                    s.id === 'editorial' || s.id === 'terminal' ? 'transparent' : `${s.ink}0a`,
                  borderRadius: Math.min(s.radius, 6),
                }}
              />
              <span
                className="self-start px-2 py-1 text-[8.5px] leading-none font-semibold"
                style={{
                  background: s.accent,
                  color: s.accentInk,
                  borderRadius: s.id === 'conversational' ? 999 : Math.min(s.radius, 6),
                  border: s.id === 'brutalist' ? '1.5px solid #000' : undefined,
                }}
              >
                {s.id === 'terminal' ? 'next ↵' : 'Next'}
              </span>
            </div>
          </div>
          <span
            className={`max-w-full truncate text-[11px] text-[color:var(--color-muted)] ${MONO}`}
          >
            {s.id}
          </span>
        </li>
      ))}
    </ul>
  );
}
