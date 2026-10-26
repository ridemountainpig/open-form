import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RegisteredField } from './context.ts';
import { firstOnPage, revealField } from './reveal.ts';

type Box = { top: number; bottom: number; height: number };

function fakeElement(position: number, box: Box = { top: 0, bottom: 40, height: 40 }) {
  const element = {
    position,
    focus: vi.fn(),
    scrollIntoView: vi.fn(),
    getBoundingClientRect: () => box,
    closest: () => null,
    compareDocumentPosition: (other: { position: number }) => (other.position < position ? 2 : 4),
  };
  return element;
}

function fakeField(name: string, element: unknown): RegisteredField {
  return {
    name,
    page: 0,
    getSchema: () => ({ name, type: 'text' }),
    getValidator: () => undefined,
    getDefault: () => undefined,
    element: () => element as HTMLElement | null,
  };
}

let reducedMotion = false;

beforeEach(() => {
  reducedMotion = false;
  vi.stubGlobal('Node', { DOCUMENT_POSITION_PRECEDING: 2 });
  vi.stubGlobal('document', { documentElement: { clientHeight: 800 } });
  vi.stubGlobal('window', {
    innerHeight: 800,
    matchMedia: () => ({ matches: reducedMotion }),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('firstOnPage', () => {
  it('picks the field that comes first on the page, not the first to mount', () => {
    const later = fakeField('later', fakeElement(2));
    const earlier = fakeField('earlier', fakeElement(1));
    expect(firstOnPage([later, earlier])?.name).toBe('earlier');
  });

  it('prefers a field it can find over one with no element', () => {
    const missing = fakeField('missing', null);
    const found = fakeField('found', fakeElement(5));
    expect(firstOnPage([missing, found])?.name).toBe('found');
    expect(firstOnPage([])).toBeUndefined();
  });
});

describe('revealField', () => {
  it('focuses without the browser jump and centers a field that is off screen', () => {
    const element = fakeElement(1, { top: 1400, bottom: 1440, height: 40 });
    expect(revealField(fakeField('email', element))).toBe(true);
    expect(element.focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('jumps instead of animating when the visitor prefers reduced motion', () => {
    reducedMotion = true;
    const element = fakeElement(1, { top: -300, bottom: -260, height: 40 });
    revealField(fakeField('email', element));
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'instant' });
  });

  it('leaves the page alone when the field is already in view', () => {
    const element = fakeElement(1, { top: 200, bottom: 240, height: 40 });
    revealField(fakeField('email', element));
    expect(element.focus).toHaveBeenCalled();
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });

  it('scrolls a row hidden by a scrolling panel even when it is inside the window', () => {
    const panel = {
      parentElement: null,
      scrollHeight: 2000,
      clientHeight: 400,
      getBoundingClientRect: () => ({ top: 0, bottom: 400 }),
    };
    vi.stubGlobal('getComputedStyle', () => ({ overflowY: 'auto' }));
    const element = {
      ...fakeElement(1, { top: 500, bottom: 540, height: 40 }),
      parentElement: panel,
    };
    revealField(fakeField('email', element));
    expect(element.scrollIntoView).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' });
  });

  it('scrolls the whole question row, from its top when it is taller than the screen', () => {
    const row = {
      getBoundingClientRect: () => ({ top: 900, bottom: 2100, height: 1200 }),
      scrollIntoView: vi.fn(),
    };
    const element = { ...fakeElement(1), closest: () => row };
    revealField(fakeField('topics', element));
    expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'start', behavior: 'smooth' });
    expect(element.scrollIntoView).not.toHaveBeenCalled();
  });

  it('reports a field with nothing to focus', () => {
    expect(revealField(fakeField('ghost', null))).toBe(false);
  });
});
