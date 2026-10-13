import {
  type ElementNames,
  type InspectPick,
  type InspectTarget,
  parseLoc,
  sameTarget,
} from '../lib/preview-channel.ts';

// Studio's Edit mode inside the preview frame. Hovering outlines what a click
// would select; clicking selects it and tells Studio. The dev server stamps
// `data-of-loc` on everything written in `forms/` (fields carry it on their
// control), which says which element of the source a box belongs to. What the
// runtime or the theme draws inside one — a title, a progress bar, a button —
// is picked on its own and found again by its text (or position).

const ACCENT = '#2563eb';

// A selection Studio asks for may not be drawn yet: the form is still loading,
// or a source edit is about to re-render it. It's missing once the page has
// been quiet this long without it.
const SETTLE_MS = 1200;

// A run of text: a <strong> inside a <p> picks the whole <p>.
const INLINE = new Set([
  'A',
  'ABBR',
  'B',
  'BR',
  'CODE',
  'DEL',
  'EM',
  'I',
  'INS',
  'KBD',
  'MARK',
  'S',
  'SMALL',
  'SPAN',
  'STRONG',
  'SUB',
  'SUP',
  'TIME',
  'U',
]);

type Hit = { loc: string; box: Element; field?: string; part?: Element; path?: number[] };

const shown = (element: Element) =>
  ((element as HTMLElement).innerText ?? element.textContent ?? '').replace(/\s+/g, ' ').trim();

function onlyLoc(element: Element): string | null {
  const locs = new Set<string>();
  for (const node of element.querySelectorAll('[data-of-loc]')) {
    locs.add(node.getAttribute('data-of-loc') as string);
    if (locs.size > 1) return null;
  }
  return locs.values().next().value ?? null;
}

/** The widest box around `anchor` that is only about `loc`: a field's label, help and error too. */
function widen(anchor: Element, loc: string): Element {
  let box = anchor;
  for (let parent = box.parentElement; parent && parent !== document.body; ) {
    const own = parent.getAttribute('data-of-loc');
    if ((own && own !== loc) || (!own && onlyLoc(parent) !== loc)) break;
    box = parent;
    parent = parent.parentElement;
  }
  return box;
}

/** The written element under `start`, and its box. */
function ownerOf(start: Element): { loc: string; box: Element } | null {
  let anchor: Element | null = start;
  for (; anchor && anchor !== document.documentElement; anchor = anchor.parentElement) {
    const loc =
      anchor.getAttribute('data-of-loc') ??
      (anchor instanceof HTMLLabelElement ? anchor.control?.getAttribute('data-of-loc') : null) ??
      onlyLoc(anchor);
    if (loc) return { loc, box: widen(anchor, loc) };
  }
  return null;
}

function fieldName(box: Element, loc: string): string | undefined {
  const control = box.matches('[name]')
    ? box
    : box.querySelector(`[data-of-loc="${CSS.escape(loc)}"][name]`);
  return control?.getAttribute('name') ?? undefined;
}

function inlineOnly(element: Element): boolean {
  for (const child of element.children) {
    if (!INLINE.has(child.tagName) || !inlineOnly(child)) return false;
  }
  return true;
}

const isText = (element: Element) => inlineOnly(element) && shown(element) !== '';

/** The part of `box` under `target`: its run of text, else the element itself. */
function partOf(target: Element, box: Element): Element | null {
  if (target === box || !box.contains(target)) return null;
  let text: Element | null = null;
  for (let el: Element | null = target; el && el !== box; el = el.parentElement) {
    if (isText(el)) text = el;
    else if (text) break;
  }
  const part = text ?? target;
  // A wrapper around other written elements is the owner's, not a part of it.
  return part.querySelector('[data-of-loc]') ? null : part;
}

function pathTo(box: Element, part: Element): number[] {
  const path: number[] = [];
  for (let el = part; el !== box && el.parentElement; el = el.parentElement) {
    path.unshift([...el.parentElement.children].indexOf(el));
  }
  return path;
}

function hitAt(target: EventTarget | null): Hit | null {
  if (!(target instanceof Element)) return null;
  const owner = ownerOf(target);
  if (!owner) return null;
  const field = fieldName(owner.box, owner.loc);
  // A field is picked whole: its label, help and control are edited together.
  if (field) return { ...owner, field };
  const part = partOf(target, owner.box);
  return part ? { ...owner, part, path: pathTo(owner.box, part) } : owner;
}

function ancestorsOf(box: Element, loc: string): string[] {
  const out: string[] = [];
  for (let el = box.parentElement?.closest('[data-of-loc]'); el; ) {
    const own = el.getAttribute('data-of-loc') as string;
    if (own !== loc && !out.includes(own)) out.unshift(own);
    el = el.parentElement?.closest('[data-of-loc]') ?? null;
  }
  return out;
}

function overlay(style: string): HTMLDivElement {
  const element = document.createElement('div');
  element.setAttribute('aria-hidden', 'true');
  element.dataset.ofInspector = '';
  element.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;display:none;box-sizing:border-box;${style}`;
  document.body.append(element);
  return element;
}

export type Inspector = {
  /** Outline what Studio says is selected (after a reload, or "select parent"). */
  select(target: InspectTarget | null): void;
  setNames(names: ElementNames): void;
  stop(): void;
};

/** Start Edit mode in this frame. */
export function startInspector(options: {
  names: ElementNames;
  report(pick: InspectPick | null | 'exit'): void;
  /** A selection Studio asked for isn't on the page (another form's, or gone). */
  missing(target: InspectTarget): void;
  /** The form's own-language text that `text`, as shown, was translated from. */
  toSource(text: string): string;
}): Inspector {
  let names = options.names;
  const hover = overlay(
    `border:1.5px dashed ${ACCENT};background:color-mix(in srgb,${ACCENT} 5%,transparent);border-radius:4px`,
  );
  const picked = overlay(
    `border:2px solid ${ACCENT};background:color-mix(in srgb,${ACCENT} 8%,transparent);border-radius:4px`,
  );
  const tag = overlay(
    `background:${ACCENT};color:#fff;font:500 11px/1.6 ui-sans-serif,system-ui,sans-serif;padding:1px 6px;border-radius:4px;white-space:nowrap`,
  );
  const cursor = document.createElement('style');
  cursor.textContent = '*, *::before, *::after { cursor: default !important; }';
  document.head.append(cursor);

  let current: Hit | null = null;
  let selected: { target: InspectTarget; box: Element | null } | null = null;

  const label = (hit: Hit) => {
    const info = names[hit.loc];
    const owner = info ? (info.name ? `${info.tag} · ${info.name}` : info.tag) : 'Element';
    return hit.part ? `${owner} › ${hit.part.tagName.toLowerCase()}` : owner;
  };

  /** Where `target` is drawn now; the DOM is replaced whenever the form's source changes. */
  const find = (target: InspectTarget): Element | null => {
    for (const anchor of document.querySelectorAll(`[data-of-loc="${CSS.escape(target.loc)}"]`)) {
      const box = widen(anchor, target.loc);
      if (target.text === undefined && target.path === undefined) return box;
      if (target.text !== undefined) {
        for (const el of box.querySelectorAll('*')) {
          const outer = el.parentElement !== box && el.parentElement && isText(el.parentElement);
          if (!isText(el) || outer) continue;
          if (options.toSource(shown(el)) === target.text) return el;
        }
      }
      let el: Element | undefined = box;
      for (const index of target.path ?? []) el = el?.children[index];
      if (el && el !== box) return el;
    }
    return null;
  };

  const place = (element: HTMLElement, box: Element | null) => {
    const rect = box?.isConnected ? box.getBoundingClientRect() : null;
    if (!rect || (rect.width === 0 && rect.height === 0)) {
      element.style.display = 'none';
      return null;
    }
    // Kept inside the frame, so a box as big as the page still shows its outline.
    const top = Math.max(rect.top - 3, 1);
    const left = Math.max(rect.left - 3, 1);
    const bottom = Math.min(rect.bottom + 3, window.innerHeight - 1);
    const right = Math.min(rect.right + 3, document.documentElement.clientWidth - 1);
    Object.assign(element.style, {
      display: 'block',
      top: `${top}px`,
      left: `${left}px`,
      width: `${Math.max(right - left, 0)}px`,
      height: `${Math.max(bottom - top, 0)}px`,
    });
    return rect;
  };

  let frame = 0;
  const draw = () => {
    frame = 0;
    if (selected && !selected.box?.isConnected) selected.box = find(selected.target);
    if (current && !current.box.isConnected) current = null;
    const shownBox = current?.part ?? current?.box ?? null;
    // Don't outline twice what is already selected.
    const rect = place(hover, shownBox === selected?.box ? null : shownBox);
    place(picked, selected?.box ?? null);
    if (!rect || !current) {
      tag.style.display = 'none';
      return;
    }
    const text = label(current);
    if (tag.textContent !== text) tag.textContent = text;
    // Above the box, or just inside it when there is no room above.
    Object.assign(tag.style, {
      display: 'block',
      top: `${rect.top - 23 >= 2 ? rect.top - 23 : Math.max(rect.top, 0) + 5}px`,
      left: `${Math.max(rect.left - 3, 5)}px`,
    });
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  let settle = 0;
  const watchMissing = () => {
    clearTimeout(settle);
    settle = 0;
    const target = selected?.target;
    if (!target || selected?.box?.isConnected) return;
    settle = window.setTimeout(() => {
      settle = 0;
      if (!selected || selected.target !== target) return;
      selected.box = find(target);
      if (selected.box) {
        schedule();
      } else if (!document.querySelector('[data-of-loc]')) {
        watchMissing();
      } else {
        selected = null;
        schedule();
        options.missing(target);
      }
    }, SETTLE_MS);
  };

  const onMove = (event: PointerEvent) => {
    current = hitAt(event.target);
    schedule();
  };
  const onLeave = () => {
    current = null;
    schedule();
  };
  // Swallow presses so fields don't focus and buttons don't step or submit.
  const swallow = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };
  const onClick = (event: MouseEvent) => {
    swallow(event);
    const hit = hitAt(event.target);
    const where = hit && parseLoc(hit.loc);
    if (!hit || !where) return;
    const text = hit.part && isText(hit.part) ? shown(hit.part) : undefined;
    const target: InspectTarget = {
      loc: hit.loc,
      ...(text ? { text: options.toSource(text) } : {}),
      ...(hit.path ? { path: hit.path } : {}),
    };
    selected = { target, box: hit.part ?? hit.box };
    watchMissing();
    schedule();
    options.report({
      ...target,
      ...where,
      ...(hit.field ? { field: hit.field } : {}),
      ...(hit.part
        ? { part: { tag: hit.part.tagName.toLowerCase(), ...(text ? { shown: text } : {}) } }
        : {}),
      ancestors: ancestorsOf(hit.box, hit.loc),
      locale: document.documentElement.lang || undefined,
    });
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    if (selected) {
      selected = null;
      watchMissing();
      schedule();
      options.report(null);
    } else {
      options.report('exit');
    }
  };

  // Re-find the selection when the form re-renders (an edit, a step change).
  const observer = new MutationObserver((records) => {
    if (records.every((r) => (r.target as Element).closest?.('[data-of-inspector]'))) return;
    if (settle) watchMissing();
    schedule();
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  const capture = { capture: true } as const;
  window.addEventListener('pointermove', onMove, capture);
  document.documentElement.addEventListener('pointerleave', onLeave);
  window.addEventListener('pointerdown', swallow, capture);
  window.addEventListener('mousedown', swallow, capture);
  window.addEventListener('click', onClick, capture);
  window.addEventListener('keydown', onKey, capture);
  window.addEventListener('scroll', schedule, capture);
  window.addEventListener('resize', schedule);

  return {
    select(target) {
      if (sameTarget(target, selected?.target ?? null)) return;
      selected = target ? { target, box: find(target) } : null;
      watchMissing();
      schedule();
    },
    setNames(next) {
      names = next;
      schedule();
    },
    stop() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(settle);
      window.removeEventListener('pointermove', onMove, capture);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('pointerdown', swallow, capture);
      window.removeEventListener('mousedown', swallow, capture);
      window.removeEventListener('click', onClick, capture);
      window.removeEventListener('keydown', onKey, capture);
      window.removeEventListener('scroll', schedule, capture);
      window.removeEventListener('resize', schedule);
      for (const element of [hover, picked, tag, cursor]) element.remove();
    },
  };
}
