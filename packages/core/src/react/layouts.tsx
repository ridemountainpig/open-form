import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { format } from '../schema/index.ts';
import {
  defaultComponents,
  type LayoutUIProps,
  NavOrderContext,
  ScreenHeadingContext,
  useFormComponents,
} from './components.tsx';
import { useFormMessages } from './hooks.ts';

// Ready-made layouts. Use one with `components: { Layout: SplitLayout }` in a
// theme or on <Form>, or copy one as the starting point for your own.

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
const TEXT_ENTRY =
  'textarea, input:not([type="radio"], [type="checkbox"], [type="file"], [type="range"], [type="color"], [type="submit"], [type="button"], [type="reset"], [type="image"])';

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
          <ScreenHeadingContext.Provider value={header ? 'h2' : 'h1'}>
            {content}
          </ScreenHeadingContext.Provider>
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

  // Enter moves on from anywhere on the step, a textarea too, like Typeform
  // (Shift+Enter adds a line there); everywhere else Shift+Enter goes back.
  // Phones have no Shift, so their Return key keeps making new lines.
  // A React handler, so a field's own onKeyDown runs first and can claim the key.
  const { isFirst, submitting, back } = nav;
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!inForm || event.key !== 'Enter' || event.defaultPrevented) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey) return;
    if (target.closest('dialog, select, [contenteditable="true"]')) return;
    const textarea = target.tagName === 'TEXTAREA';
    const shortcut = event.metaKey || event.ctrlKey;
    if (event.shiftKey) {
      if (textarea || shortcut || isFirst || submitting) return;
      event.preventDefault();
      back();
      return;
    }
    // Inputs and buttons already act on Enter; the step itself, focused after each move, doesn't.
    if (!textarea && !target.matches('.of-step, .of-focus')) return;
    if (textarea && !shortcut && window.matchMedia('(hover: none)').matches) return;
    event.preventDefault();
    target.closest('form')?.requestSubmit();
  };

  // A step that opens with a text field puts the cursor in it, so typing just
  // works. Not on touch screens, where it would pop the keyboard over the question.
  useEffect(() => {
    const el = root.current;
    if (!el || !inForm) return;
    const onFocus = (event: FocusEvent) => {
      const step = event.target as HTMLElement;
      if (!step.matches('.of-step') || !window.matchMedia('(pointer: fine)').matches) return;
      const first = step.querySelector<HTMLElement>(FOCUSABLE);
      if (!first?.matches(TEXT_ENTRY)) return;
      first.focus({ preventScroll: true });
      if (first instanceof HTMLTextAreaElement || first instanceof HTMLInputElement) {
        try {
          first.setSelectionRange(first.value.length, first.value.length);
        } catch {
          // Email and number inputs have no caret position to set.
        }
      }
    };
    el.addEventListener('focusin', onFocus);
    return () => el.removeEventListener('focusin', onFocus);
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
    // biome-ignore lint/a11y/noStaticElementInteractions: catches Enter bubbling up from the step's own controls.
    <div
      className="of-focus"
      data-state={state}
      data-cover={onCover || undefined}
      ref={root}
      onKeyDown={onKeyDown}
    >
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
                <NavOrderContext.Provider value="next-first">{actions}</NavOrderContext.Provider>
                <p className="of-focus-hint">
                  {messages.pressEnter}
                  <span className="of-focus-newline"> · {messages.newline}</span>
                  {!nav.isFirst && <span className="of-focus-back"> · {messages.goBack}</span>}
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
