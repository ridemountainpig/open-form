import type { RegisteredField } from './context.ts';

export function scrollBehavior(): ScrollBehavior {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
}

/** The field that comes first on the page, which isn't always the first to mount. */
export function firstOnPage(fields: Iterable<RegisteredField>): RegisteredField | undefined {
  let first: { field: RegisteredField; element: HTMLElement | null } | undefined;
  for (const field of fields) {
    const element = field.element();
    if (!first) first = { field, element };
    else if (
      element &&
      (!first.element ||
        first.element.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING)
    ) {
      first = { field, element };
    }
  }
  return first?.field;
}

/** Whether a scrolling panel the row sits in (a layout's own column) hides part of it. */
function clipped(row: HTMLElement, box: DOMRect): boolean {
  for (let parent = row.parentElement; parent; parent = parent.parentElement) {
    if (parent.scrollHeight <= parent.clientHeight) continue;
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === 'visible') continue;
    const panel = parent.getBoundingClientRect();
    if (box.top < panel.top || box.bottom > panel.bottom) return true;
  }
  return false;
}

/**
 * Focuses a field and scrolls it to the middle of the screen with its label
 * and error, unless it's already in full view. Plain `focus()` scrolls only
 * until the control's edge shows, which can leave the question under a
 * sticky header or off screen.
 */
export function revealField(field: RegisteredField): boolean {
  const element = field.element();
  if (!element) return false;
  element.focus({ preventScroll: true });
  const row = element.closest<HTMLElement>('.of-field') ?? element;
  const box = row.getBoundingClientRect();
  const height = window.innerHeight || document.documentElement.clientHeight;
  if (box.top >= 0 && box.bottom <= height && !clipped(row, box)) return true;
  // A row taller than the screen (a long list of choices) starts at its label.
  row.scrollIntoView({
    block: box.height < height ? 'center' : 'start',
    behavior: scrollBehavior(),
  });
  return true;
}
