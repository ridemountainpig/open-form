import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDraft, draftLifetime, readDraft, sweepDrafts, writeDraft } from './drafts.ts';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => memory.set(key, value),
      removeItem: (key: string) => memory.delete(key),
      key: (i: number) => [...memory.keys()][i] ?? null,
      get length() {
        return memory.size;
      },
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
});

describe('drafts', () => {
  it('are off unless the form opts in', () => {
    expect(draftLifetime(undefined)).toBeNull();
    expect(draftLifetime(false)).toBeNull();
    expect(draftLifetime(true)).toBe(7 * 86_400_000);
    expect(draftLifetime({ expires: '2h' })).toBe(7_200_000);
  });

  it('round-trip answers and the step, then clear', () => {
    writeDraft('rsvp', { values: { name: 'Amy', tags: ['a'] }, step: 2 }, 60_000);
    expect(readDraft('rsvp', 60_000)).toEqual({ values: { name: 'Amy', tags: ['a'] }, step: 2 });
    clearDraft('rsvp');
    expect(readDraft('rsvp', 60_000)).toBeNull();
  });

  it("sweep every form's expired drafts, not only the open one", () => {
    writeDraft('old', { values: { name: 'Amy' }, step: 0 }, 60_000);
    writeDraft('fresh', { values: { name: 'Ben' }, step: 0 }, 3_600_000);
    memory.set('open-form:draft:broken', '{');
    memory.set('unrelated', 'kept');
    sweepDrafts(Date.now() + 120_000);
    expect([...memory.keys()].sort()).toEqual(['open-form:draft:fresh', 'unrelated']);
  });

  it('drop drafts that expired or look wrong', () => {
    writeDraft('rsvp', { values: { name: 'Amy' }, step: 0 }, 60_000);
    expect(readDraft('rsvp', 60_000, Date.now() + 61_000)).toBeNull();
    expect(memory.size).toBe(0);
    memory.set('open-form:draft:rsvp', JSON.stringify({ savedAt: Date.now(), values: [1] }));
    expect(readDraft('rsvp', 60_000)).toBeNull();
    memory.set('open-form:draft:rsvp', '{not json');
    expect(readDraft('rsvp', 60_000)).toBeNull();
  });

  it('survive blocked storage', () => {
    Reflect.deleteProperty(globalThis, 'localStorage');
    expect(() => writeDraft('rsvp', { values: {}, step: 0 }, 60_000)).not.toThrow();
    expect(readDraft('rsvp', 60_000)).toBeNull();
  });
});
