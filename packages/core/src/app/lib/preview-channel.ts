import { type RefObject, useEffect, useState } from 'react';
import type {
  FormRuntime,
  NavigationInfo,
  PreviewCommand,
  PreviewNotice,
} from '../../react/index.ts';

// Studio ↔ preview iframe: Studio sends commands, the preview reports where it is.
const COMMAND_MESSAGE = 'open-form:preview-command';
const NAV_MESSAGE = 'open-form:preview-nav';

export type PreviewNav = {
  /** The step's index among all of the form's steps. */
  step: number;
  /** Its position among the steps shown, from 0. */
  position: number;
  total: number;
  inspecting: boolean;
  done: boolean;
  /** The unavailable state whose screen is showing. */
  notice: PreviewNotice['state'] | null;
};

const NOTICE_STATES: ReadonlyArray<PreviewNotice['state']> = [
  'closed',
  'not-open',
  'full',
  'duplicate',
];

const fromStudio = (event: MessageEvent) =>
  event.source === window.parent && event.origin === window.location.origin;

export function parseCommand(data: unknown): PreviewCommand | null {
  const command = (data as { type?: string; command?: Partial<PreviewCommand> })?.command;
  if ((data as { type?: string })?.type !== COMMAND_MESSAGE || !command) return null;
  if (command.type === 'done') return { type: 'done' };
  if (
    command.type === 'notice' &&
    NOTICE_STATES.includes(command.state as PreviewNotice['state'])
  ) {
    return command.state === 'not-open' && typeof command.opensAt === 'string'
      ? { type: 'notice', state: 'not-open', opensAt: command.opensAt }
      : { type: 'notice', state: command.state as PreviewNotice['state'] };
  }
  if (command.type === 'goto' && typeof command.step === 'number') {
    return {
      type: 'goto',
      step: command.step,
      labels: command.labels,
      quiet: command.quiet === true,
    };
  }
  return null;
}

/**
 * In the preview: commands from the Studio page embedding it. `resume` names a
 * step to return to when the form remounts after its source changed; a closed
 * screen Studio asked for comes back as it was.
 */
export function previewChannel(
  resume?: () => number | null,
): NonNullable<FormRuntime['previewControl']> {
  let quiet = false;
  let notice: PreviewCommand | null = null;
  return {
    subscribe(listener) {
      const onMessage = (event: MessageEvent) => {
        if (!fromStudio(event)) return;
        const command = parseCommand(event.data);
        if (!command) return;
        if (command.type === 'goto') quiet = Boolean(command.quiet);
        notice = command.type === 'notice' ? command : null;
        listener(command);
      };
      window.addEventListener('message', onMessage);
      const step = resume?.();
      if (notice) listener(notice);
      else if (step) listener({ type: 'goto', step, quiet });
      return () => window.removeEventListener('message', onMessage);
    },
  };
}

/** In the preview: tell Studio which step is showing. */
export function reportPreviewNav(nav: NavigationInfo) {
  const report: PreviewNav = {
    step: nav.step,
    position: nav.stepNumber - 1,
    total: nav.totalSteps,
    inspecting: Boolean(nav.inspecting),
    done: Boolean(nav.done),
    notice: nav.notice ?? null,
  };
  window.parent.postMessage({ type: NAV_MESSAGE, nav: report }, window.location.origin);
}

/** In Studio: send a command to a preview frame. */
export function sendPreviewCommand(frame: HTMLIFrameElement | null, command: PreviewCommand) {
  frame?.contentWindow?.postMessage({ type: COMMAND_MESSAGE, command }, window.location.origin);
}

/** In Studio: where a preview frame is, as it reports it. */
export function usePreviewNav(frame: RefObject<HTMLIFrameElement | null>): PreviewNav | null {
  const [nav, setNav] = useState<PreviewNav | null>(null);
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data as { type?: string; nav?: PreviewNav };
      if (data?.type === NAV_MESSAGE && typeof data.nav?.step === 'number') setNav(data.nav);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame]);
  return nav;
}

// Studio's Edit mode: the preview says when it can listen; Studio switches
// picking on and off and says what is selected; the preview reports what the
// user clicks, and when Escape (with nothing selected) should leave Edit mode.
const READY_MESSAGE = 'open-form:inspect-ready';
const INSPECT_MESSAGE = 'open-form:inspect';
const SELECT_MESSAGE = 'open-form:inspect-select';
const PICK_MESSAGE = 'open-form:inspect-pick';
const MISSING_MESSAGE = 'open-form:inspect-missing';

/** Each JSX element in the form's source, by loc: its tag and, for fields, its name. */
export type ElementNames = Record<string, { tag: string; name?: string }>;

/** Something in the preview, as both sides can find it again after a reload. */
export type InspectTarget = {
  /** The element as written: `forms/meetup/index.tsx:12:7`. */
  loc: string;
  /** A part of it, by its text in the form's own language — the form's title inside `<Form>`. */
  text?: string;
  /** …or, for a part without text, by child positions under the element's box. */
  path?: number[];
};

export type InspectPick = InspectTarget & {
  file: string;
  line: number;
  column: number;
  /** The field's name, when a field was picked. */
  field?: string;
  /** The picked part: its tag, and its text as shown. */
  part?: { tag: string; shown?: string };
  /** The written elements around it, outermost first. */
  ancestors: string[];
  /** The language the preview is showing. */
  locale?: string;
};

export function parseLoc(loc: string): Pick<InspectPick, 'file' | 'line' | 'column'> | null {
  const match = /^(.+):(\d+):(\d+)$/.exec(loc);
  return match
    ? { file: match[1] as string, line: Number(match[2]), column: Number(match[3]) }
    : null;
}

export const sameTarget = (a: InspectTarget | null, b: InspectTarget | null) =>
  a?.loc === b?.loc && a?.text === b?.text && a?.path?.join() === b?.path?.join();

/** Move locs at or after `line` in `file` down one line, after a note took a line there. */
export function shiftLoc(loc: string, file: string, line: number): string {
  const at = parseLoc(loc);
  if (!at || at.file !== file || at.line < line) return loc;
  return `${file}:${at.line + 1}:${at.column}`;
}

export function shiftPick(pick: InspectPick, file: string, line: number): InspectPick {
  return {
    ...pick,
    loc: shiftLoc(pick.loc, file, line),
    line: pick.file === file && pick.line >= line ? pick.line + 1 : pick.line,
    ancestors: pick.ancestors.map((loc) => shiftLoc(loc, file, line)),
  };
}

const toFrame = (frame: HTMLIFrameElement | null, message: unknown) =>
  frame?.contentWindow?.postMessage(message, window.location.origin);

/** In Studio: turn picking on or off in a preview frame. */
export function sendInspect(frame: HTMLIFrameElement | null, on: boolean, names?: ElementNames) {
  toFrame(frame, { type: INSPECT_MESSAGE, on, names });
}

/** In Studio: outline `target` in a preview frame, or nothing. */
export function sendInspectSelect(frame: HTMLIFrameElement | null, target: InspectTarget | null) {
  toFrame(frame, { type: SELECT_MESSAGE, target });
}

/** In the preview: Studio's Edit-mode switch, and what it says is selected. */
export function onInspect(handlers: {
  toggle(on: boolean, names: ElementNames): void;
  select(target: InspectTarget | null): void;
}): () => void {
  const onMessage = (event: MessageEvent) => {
    if (!fromStudio(event)) return;
    const data = event.data as { type?: string; on?: unknown; names?: unknown; target?: unknown };
    if (data?.type === INSPECT_MESSAGE) {
      const names = data.names && typeof data.names === 'object' ? data.names : {};
      handlers.toggle(data.on === true, names as ElementNames);
    } else if (data?.type === SELECT_MESSAGE) {
      const target = data.target as InspectTarget | null;
      handlers.select(typeof target?.loc === 'string' ? target : null);
    }
  };
  window.addEventListener('message', onMessage);
  return () => window.removeEventListener('message', onMessage);
}

/** In the preview: Edit mode can start; Studio answers with its state. */
export function reportInspectReady() {
  window.parent.postMessage({ type: READY_MESSAGE }, window.location.origin);
}

/** In the preview: report a pick, `null` when the selection was cleared, or `'exit'`. */
export function reportPick(pick: InspectPick | null | 'exit') {
  window.parent.postMessage(
    pick === 'exit' ? { type: PICK_MESSAGE, exit: true } : { type: PICK_MESSAGE, pick },
    window.location.origin,
  );
}

/** In the preview: what Studio asked to select isn't on the page. */
export function reportMissing(target: InspectTarget) {
  window.parent.postMessage({ type: MISSING_MESSAGE, target }, window.location.origin);
}

/** In Studio: a preview frame's readiness, its picks, its requests to leave Edit mode, and selections it can't find. */
export function usePreviewPicks(
  frame: RefObject<HTMLIFrameElement | null>,
  handlers: {
    onReady(): void;
    onPick(pick: InspectPick | null): void;
    onExit(): void;
    onMissing(target: InspectTarget): void;
  },
) {
  const { onReady, onPick, onExit, onMissing } = handlers;
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      if (event.origin !== window.location.origin) return;
      const data = event.data as {
        type?: string;
        pick?: InspectPick | null;
        exit?: boolean;
        target?: InspectTarget;
      };
      if (data?.type === READY_MESSAGE) return onReady();
      if (data?.type === MISSING_MESSAGE) {
        if (typeof data.target?.loc === 'string') onMissing(data.target);
        return;
      }
      if (data?.type !== PICK_MESSAGE) return;
      if (data.exit) onExit();
      else onPick(data.pick ?? null);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [frame, onReady, onPick, onExit, onMissing]);
}
