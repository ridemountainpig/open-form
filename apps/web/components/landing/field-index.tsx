'use client';

import type { FormTheme, FormValues } from '@open-form-build/core';
import Link from 'next/link';
import { type KeyboardEvent, useId, useRef, useState } from 'react';
import { CodeLines } from './code-lines';
import { ink, starters } from './demo-forms';
import { StoredContext, specimenConfig, specimens } from './field-specimens';
import { Container, SectionHeading } from './frame';
import { LiveForm } from './live-form';
import { SWATCHES } from './visuals';

const MONO = 'font-[family-name:var(--font-mono)]';
const LAST = specimens.length - 1;

const sameValue = (
  <span className="ml-auto hidden shrink-0 text-[color:var(--color-muted)] sm:inline">
    Same code · same stored value
  </span>
);

/** Every look in the same card: only the fields change, not the layout. */
function asCard(theme: FormTheme): FormTheme {
  return { ...theme, layout: 'card', components: { ...theme.components, Layout: undefined } };
}

const looks = [
  { id: 'ink', label: 'Ink', theme: asCard(ink), colors: ['#ffffff', '#0a0a0a'] },
  ...['editorial', 'terminal', 'brutalist', 'conversational'].map((id) => {
    const starter = starters.find((s) => s.id === id);
    const swatch = SWATCHES.find((s) => s.id === id);
    if (!starter || !swatch) throw new Error(`Unknown starter: ${id}`);
    return {
      id,
      label: starter.label,
      theme: asCard(starter.theme),
      colors: [swatch.card, swatch.accent],
    };
  }),
];

export function FieldIndex() {
  const baseId = useId();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [run, setRun] = useState(0);
  const [lookIndex, setLookIndex] = useState(0);
  const [stored, setStored] = useState<FormValues | null>(null);
  const spec = specimens[index];
  const look = looks[lookIndex];

  const select = (i: number) => {
    setIndex(i);
    setRun((r) => r + 1);
    setStored(null);
  };

  // Keeps the answer and what was stored: only the look changes.
  const selectLook = (i: number) => {
    if (i === lookIndex) return;
    setLookIndex(i);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    cardRef.current?.animate(
      [
        { opacity: 0, filter: 'blur(2px)', transform: 'translateY(4px)' },
        { opacity: 1, filter: 'blur(0)', transform: 'none' },
      ],
      { duration: 320, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    let next: number | null = null;
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = index === LAST ? 0 : index + 1;
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = index === 0 ? LAST : index - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = LAST;
    if (next === null) return;
    e.preventDefault();
    select(next);
    tabRefs.current[next]?.focus();
  };

  return (
    <section id="fields">
      <Container className="pb-24 sm:pb-32">
        <SectionHeading
          number="04"
          label="Fields"
          title="Thirteen fields. Then your own."
          lead={
            <>
              Each one is checked in the browser and on the server, and stored as its own column in
              Responses. Your theme can restyle or replace each one to match your design, and what
              it stores stays the same. When none fits,{' '}
              <span className={`${MONO} text-[14px] text-[color:var(--color-text)]`}>useField</span>{' '}
              turns any React input into one.
            </>
          }
        />

        <div
          data-reveal
          className="grid grid-cols-1 overflow-hidden rounded-md border border-[color:var(--color-rule)] bg-[color:var(--color-panel)] lg:grid-cols-[300px_minmax(0,1fr)]"
        >
          <div className="border-b border-[color:var(--color-rule)] lg:border-r lg:border-b-0">
            <div className="caption hidden h-11 items-center justify-between border-b border-[color:var(--color-rule-soft)] px-4 lg:flex">
              <span>Field index</span>
              <span className={MONO}>13 + yours</span>
            </div>
            <div
              role="tablist"
              aria-label="Field"
              onKeyDown={onKeyDown}
              className="flex gap-1.5 overflow-x-auto p-3 [scrollbar-width:none] lg:flex-col lg:gap-0 lg:overflow-visible lg:p-0"
            >
              {specimens.map((s, i) => {
                const selected = i === index;
                return (
                  <button
                    key={s.name}
                    ref={(el) => {
                      tabRefs.current[i] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${i}`}
                    aria-selected={selected}
                    aria-controls={`${baseId}-panel`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => select(i)}
                    className={`flex h-8 shrink-0 items-center gap-3 rounded-full border px-3 text-left transition-colors duration-200 lg:h-10 lg:w-full lg:justify-between lg:rounded-none lg:border-0 lg:border-b lg:border-[color:var(--color-rule-soft)] lg:px-4 lg:last:border-b-0 ${
                      selected
                        ? 'border-[color:var(--color-text)] bg-[color:var(--color-text)] text-[color:var(--color-ink)] lg:bg-[color:var(--color-panel-hi)] lg:text-[color:var(--color-text)] lg:shadow-[inset_2px_0_0_var(--color-text)]'
                        : 'border-[color:var(--color-rule)] text-[color:var(--color-text-soft)] hover:text-[color:var(--color-text)] lg:hover:bg-[color:var(--color-panel-hi)]'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={`nums hidden w-5 text-[11px] text-[color:var(--color-muted)] lg:inline ${MONO}`}
                      >
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span className={`text-[12.5px] lg:text-[13px] ${MONO}`}>{s.name}</span>
                    </span>
                    <span
                      className={`hidden text-[11.5px] text-[color:var(--color-muted)] lg:inline ${MONO}`}
                    >
                      {s.stored}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            id={`${baseId}-panel`}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${index}`}
            className="flex min-w-0 flex-col"
          >
            <div
              className={`flex h-11 shrink-0 items-center gap-3 border-b border-[color:var(--color-rule-soft)] px-4 text-[12px] text-[color:var(--color-muted)] ${MONO}`}
            >
              <span className="min-w-0 flex-1 truncate">
                <span className="text-[color:var(--color-text)]">&lt;{spec.name}&gt;</span> · stored
                as {spec.stored}
              </span>
              <div
                role="toolbar"
                aria-label="Look"
                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-[color:var(--color-panel-hi)] p-0.5 font-[family-name:var(--font-sans)] font-medium"
              >
                {looks.map((l, i) => {
                  const selected = i === lookIndex;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={selected}
                      title={l.label}
                      onClick={() => selectLook(i)}
                      className={`pressable inline-flex h-6 items-center gap-1.5 rounded-full px-[7px] xl:px-2.5 ${
                        selected
                          ? 'bg-[color:var(--color-panel)] text-[color:var(--color-text)] shadow-[var(--shadow-edge)]'
                          : 'text-[color:var(--color-muted)] hover:text-[color:var(--color-text)]'
                      }`}
                    >
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-full shadow-[0_0_0_1px_var(--color-rule)]"
                        style={{
                          background: `linear-gradient(135deg, ${l.colors[0]} 50%, ${l.colors[1]} 50%)`,
                        }}
                      />
                      <span className="sr-only xl:not-sr-only">{l.label}</span>
                    </button>
                  );
                })}
              </div>
              <Link
                href={spec.docs}
                className="shrink-0 transition-colors hover:text-[color:var(--color-text)]"
              >
                Docs ↗
              </Link>
            </div>
            <div className="field-stage flex min-h-[300px] flex-1 flex-col">
              <div ref={cardRef} className="flex-1 px-4 pt-6 pb-5 sm:px-8">
                <StoredContext.Provider value={setStored}>
                  <LiveForm
                    key={`${spec.name}-${run}`}
                    form={spec.form}
                    config={specimenConfig}
                    theme={look.theme}
                    themeId={look.id}
                    className="panel-in"
                  />
                </StoredContext.Provider>
              </div>
              <div
                aria-live="polite"
                className={`flex h-10 shrink-0 items-center gap-3 border-t border-dashed border-[color:var(--color-rule)] px-4 text-[12px] ${MONO}`}
              >
                <span
                  aria-hidden
                  className={`size-1.5 shrink-0 rounded-full transition-colors duration-300 ${
                    stored ? 'bg-[#16a34a]' : 'bg-[color:var(--color-rule)]'
                  }`}
                />
                <span className="caption -ml-1 shrink-0">Stored</span>
                {stored ? (
                  <>
                    <span key={run} className="panel-in min-w-0 truncate">
                      {Object.keys(stored).length === 0 ? (
                        <span className="text-[color:var(--color-muted)]">
                          Nothing. Empty answers are left out.
                        </span>
                      ) : (
                        Object.entries(stored).map(([key, value], i) => (
                          <span key={key}>
                            {i > 0 && <span className="text-[color:var(--color-muted)]">, </span>}
                            <span className="text-[color:var(--color-muted)]">{key}: </span>
                            <span className="text-[color:var(--color-text)]">
                              {JSON.stringify(value)}
                            </span>
                          </span>
                        ))
                      )}
                    </span>
                    {sameValue}
                    <button
                      type="button"
                      onClick={() => select(index)}
                      className="ml-auto shrink-0 text-[color:var(--color-muted)] transition-colors hover:text-[color:var(--color-text)] sm:ml-0"
                    >
                      Reset
                    </button>
                  </>
                ) : (
                  <>
                    <span className="truncate text-[color:var(--color-muted)]">
                      Submit to see the value.
                    </span>
                    {sameValue}
                  </>
                )}
              </div>
            </div>
            <div className="border-t border-[color:var(--color-rule-soft)] px-4 py-4 sm:px-5">
              <p
                key={spec.name}
                className="panel-in mb-2.5 text-[13.5px] text-[color:var(--color-text-soft)]"
              >
                {spec.note}
              </p>
              <pre
                className={`-mx-2 overflow-x-auto px-2 text-[12px] leading-[1.7] [scrollbar-width:none] ${MONO}`}
              >
                <CodeLines lines={spec.code} />
              </pre>
            </div>
          </div>
        </div>

        <p className="mt-4 text-[13px] text-[color:var(--color-muted)]">
          Plus four layouts: the default card, <span className={MONO}>StepperLayout</span>,{' '}
          <span className={MONO}>SplitLayout</span> and <span className={MONO}>FocusLayout</span>.{' '}
          <Link
            href="/docs/components/layouts#built-in-layouts"
            className="font-medium text-[color:var(--color-text-soft)] underline decoration-[color:var(--color-rule)] underline-offset-4 hover:text-[color:var(--color-text)]"
          >
            Layouts
          </Link>
        </p>
      </Container>
    </section>
  );
}
