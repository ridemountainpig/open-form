import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from '../schema/index.ts';
import { defaultComponents, type LayoutUIProps, useFormComponents } from './components.tsx';
import { useFormMessages } from './hooks.ts';

// Ready-made layouts. Use one with `components: { Layout: SplitLayout }` in a
// theme or on <Form>, or copy one as the starting point for your own.

/** A brand panel (title, progress, aside) beside the questions. Stacks on small screens. */
export function SplitLayout({
  state,
  banner,
  header,
  progress,
  intro,
  content,
  alert,
  actions,
  aside,
}: LayoutUIProps) {
  return (
    <div className="of-split" data-state={state}>
      <section className="of-split-brand">
        <div className="of-split-brand-inner">
          {header}
          {progress}
          {aside && <div className="of-split-aside">{aside}</div>}
        </div>
      </section>
      <section className="of-split-main" role={state === 'form' ? undefined : 'status'}>
        <div className={state === 'success' ? 'of-split-content of-success' : 'of-split-content'}>
          {banner}
          {intro}
          {content}
          {alert}
          {actions}
        </div>
      </section>
    </div>
  );
}

/** A card with a clickable list of steps beside the questions. */
export function StepperLayout(props: LayoutUIProps) {
  const { state, nav, banner, header, intro, content, alert, actions, aside } = props;
  if (state !== 'form' || nav.total < 2) return <defaultComponents.Layout {...props} />;
  return (
    <div className="of-form of-stepper">
      {banner}
      {header}
      <div className="of-stepper-body">
        <nav className="of-stepper-rail">
          <ol>
            {nav.steps.map((step) => (
              <li key={step.index} data-state={step.state}>
                <button
                  type="button"
                  disabled={!step.reachable || step.state === 'current'}
                  aria-current={step.state === 'current' ? 'step' : undefined}
                  onClick={() => nav.goTo(step.position)}
                >
                  <span className="of-stepper-dot" aria-hidden="true">
                    {step.state === 'done' ? '✓' : step.position + 1}
                  </span>
                  <span className="of-stepper-title">{step.title}</span>
                </button>
              </li>
            ))}
          </ol>
          {aside && <div className="of-stepper-aside">{aside}</div>}
        </nav>
        <div className="of-stepper-main">
          {intro}
          {content}
          {alert}
          {actions}
        </div>
      </div>
    </div>
  );
}

/**
 * One step per screen, large type, keyboard first — a conversational form.
 * Put one question in each `<Page>` for the full effect. The form's title and
 * description open on their own welcome screen; pass `cover={false}` from a
 * wrapper layout to show them above the first question instead.
 */
export function FocusLayout({
  state,
  nav,
  banner,
  header,
  title,
  description,
  intro,
  content,
  alert,
  actions,
  cover = true,
}: LayoutUIProps & { cover?: boolean }) {
  const messages = useFormMessages();
  const { Button } = useFormComponents();
  const inForm = state === 'form';
  const root = useRef<HTMLDivElement>(null);
  const hasCover = cover && Boolean(title || description);
  // Once past the welcome screen, going back to the first question doesn't reopen it.
  const [started, setStarted] = useState(() => !hasCover || nav.position > 0);
  const onCover = inForm && hasCover && !started && nav.isFirst && !nav.inspecting;

  const start = useCallback(() => {
    setStarted(true);
    requestAnimationFrame(() =>
      root.current?.querySelector<HTMLElement>('.of-step')?.focus({ preventScroll: true }),
    );
  }, []);

  // Enter moves on from a textarea too, like Typeform; Shift+Enter adds a line.
  // Phones have no Shift, so their Return key keeps making new lines.
  useEffect(() => {
    const el = root.current;
    if (!el || !inForm) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== 'Enter' || target?.tagName !== 'TEXTAREA') return;
      if (event.isComposing || event.keyCode === 229 || event.shiftKey || event.altKey) return;
      const shortcut = event.metaKey || event.ctrlKey;
      if (!shortcut && window.matchMedia('(hover: none)').matches) return;
      event.preventDefault();
      (target as HTMLTextAreaElement).form?.requestSubmit();
    };
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [inForm]);

  useEffect(() => {
    if (!onCover) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.defaultPrevented) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('button, a, input, textarea, select')) return;
      event.preventDefault();
      start();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCover, start]);

  return (
    <div className="of-focus" data-state={state} data-cover={onCover || undefined} ref={root}>
      {inForm && nav.total > 1 && !onCover && (
        <div className="of-focus-bar" aria-hidden="true">
          <span style={{ width: `${((nav.position + 1) / nav.total) * 100}%` }} />
        </div>
      )}
      <div className={state === 'success' ? 'of-focus-inner of-success' : 'of-focus-inner'}>
        {banner}
        {onCover ? (
          <div className="of-focus-cover">
            {header}
            <div className="of-focus-actions">
              <Button type="button" variant="primary" onClick={start}>
                {messages.start}
              </Button>
              <p className="of-focus-hint">{messages.pressEnter}</p>
            </div>
          </div>
        ) : (
          <>
            {inForm && !hasCover && nav.isFirst && header}
            {inForm && nav.total > 1 && (
              <p className="of-focus-count">
                <span className="of-focus-current">{nav.position + 1}</span>
                <span aria-hidden="true"> / </span>
                <span className="of-focus-total">{nav.total}</span>
                <span className="of-sr-only">
                  {format(messages.stepOf, { current: nav.position + 1, total: nav.total })}
                </span>
              </p>
            )}
            {intro}
            {content}
            {alert}
            {inForm ? (
              <div className="of-focus-actions">
                {actions}
                <p className="of-focus-hint">
                  {messages.pressEnter}
                  <span className="of-focus-newline"> · {messages.newline}</span>
                </p>
              </div>
            ) : (
              actions
            )}
          </>
        )}
      </div>
    </div>
  );
}
