import type { ObjectExpression, Program } from '@babel/types';
import type { FormOverrides } from '../schema/index.ts';
import { constInit, dropIfEmpty, resolveObject, setPath } from './source-object.ts';

// Writes Studio's schedule edits into `export const config = defineForm({ … })`
// in a form's index file, so the code stays the one source of truth in dev.

function configObject(program: Program): ObjectExpression {
  const object = resolveObject(program, constInit(program, 'config'));
  if (!object) {
    throw new Error(
      'Could not find `export const config = defineForm({ … })` in this form — add one, or edit the dates by hand.',
    );
  }
  return object;
}

const KEYS = ['opensAt', 'closesAt', 'maxResponses', 'closed'] as const;

/** Apply schedule changes to a form's source. `null` (and `closed: false`) remove the setting. */
export function writeScheduleChanges(source: string, changes: FormOverrides): string {
  let next = changes.timeZone
    ? setPath(source, configObject, ['timeZone'], changes.timeZone)
    : source;
  const submissions = changes.submissions ?? {};
  for (const key of KEYS) {
    if (!(key in submissions)) continue;
    const value = submissions[key];
    next = setPath(
      next,
      configObject,
      ['submissions', key],
      value === undefined || value === false ? null : value,
    );
  }
  return dropIfEmpty(next, configObject, ['submissions']);
}
