import { describe, expect, it } from 'vitest';
import { type InspectPick, parseCommand, sameTarget, shiftPick } from './preview-channel.ts';

const message = (command: unknown) => ({ type: 'open-form:preview-command', command });

describe('preview commands', () => {
  it('reads a jump to a step, quiet only when asked', () => {
    expect(parseCommand(message({ type: 'goto', step: 2 }))).toEqual({
      type: 'goto',
      step: 2,
      labels: undefined,
      quiet: false,
    });
    expect(parseCommand(message({ type: 'goto', step: 0, quiet: true }))).toMatchObject({
      quiet: true,
    });
  });

  it('reads a jump to the success screen', () => {
    expect(parseCommand(message({ type: 'done' }))).toEqual({ type: 'done' });
  });

  it('reads a jump to a closed screen', () => {
    expect(parseCommand(message({ type: 'notice', state: 'closed' }))).toEqual({
      type: 'notice',
      state: 'closed',
    });
    expect(
      parseCommand(message({ type: 'notice', state: 'not-open', opensAt: '2026-11-01T01:00:00Z' })),
    ).toEqual({ type: 'notice', state: 'not-open', opensAt: '2026-11-01T01:00:00Z' });
    expect(parseCommand(message({ type: 'notice', state: 'full', opensAt: 'x' }))).toEqual({
      type: 'notice',
      state: 'full',
    });
  });

  it('ignores anything else', () => {
    expect(parseCommand(message({ type: 'notice', state: 'not-found' }))).toBeNull();
    expect(parseCommand(message({ type: 'notice' }))).toBeNull();
    expect(parseCommand(message({ type: 'goto', step: '2' }))).toBeNull();
    expect(parseCommand(message({ type: 'submit' }))).toBeNull();
    expect(parseCommand({ type: 'open-form:theme-draft', command: { type: 'done' } })).toBeNull();
    expect(parseCommand(null)).toBeNull();
  });
});

describe('Edit mode selections', () => {
  it('match by element, text and path', () => {
    const loc = 'forms/meetup/index.tsx:12:7';
    expect(sameTarget({ loc, text: 'Name' }, { loc, text: 'Name' })).toBe(true);
    expect(sameTarget({ loc, path: [0, 1] }, { loc, path: [0, 1] })).toBe(true);
    expect(sameTarget({ loc }, { loc, text: 'Name' })).toBe(false);
    expect(sameTarget({ loc, path: [0, 1] }, { loc, path: [1] })).toBe(false);
    expect(sameTarget({ loc }, { loc: 'forms/survey/index.tsx:12:7' })).toBe(false);
    expect(sameTarget({ loc }, null)).toBe(false);
    expect(sameTarget(null, null)).toBe(true);
  });

  it('move down with a note inserted above them in the same file', () => {
    const pick: InspectPick = {
      loc: 'forms/meetup/index.tsx:12:7',
      file: 'forms/meetup/index.tsx',
      line: 12,
      column: 7,
      ancestors: ['forms/meetup/index.tsx:4:5', 'forms/meetup/index.tsx:12:5'],
    };
    expect(shiftPick(pick, 'forms/meetup/index.tsx', 12)).toEqual({
      ...pick,
      loc: 'forms/meetup/index.tsx:13:7',
      line: 13,
      ancestors: ['forms/meetup/index.tsx:4:5', 'forms/meetup/index.tsx:13:5'],
    });
    expect(shiftPick(pick, 'forms/meetup/index.tsx', 13)).toEqual(pick);
    expect(shiftPick(pick, 'forms/meetup/fields.tsx', 1)).toEqual(pick);
  });
});
