import type { ComponentType } from 'react';
import {
  type FormConfig,
  type FormSchema,
  localeProblem,
  parseDuration,
  resolveProtection,
  schemaVersion,
  submissionWindow,
  timeZoneProblem,
  translationProblems,
} from '../schema/index.ts';
import { type CollectedForm, collectFormSchema } from './collect.tsx';
import * as dsl from './index.ts';

export type FormModule = {
  default?: ComponentType;
  config?: FormConfig;
};

export type LoadedFormDefinition = CollectedForm & {
  id: string;
  version: string;
  config: FormConfig;
};

// TypeScript can't tie `uniqueBy` to field names or check date strings, so a
// typo would otherwise surface only as a policy that silently never applies.
function assertValidConfig(id: string, config: FormConfig, schema: FormSchema): void {
  const problems: string[] = [];
  const locale = localeProblem(config.locale);
  if (locale) problems.push(locale);
  const timeZone = timeZoneProblem(config.timeZone);
  if (timeZone) problems.push(timeZone);
  problems.push(...translationProblems(config));
  const uniqueBy = config.submissions?.uniqueBy;
  if (uniqueBy && uniqueBy !== 'device' && !schema.fields.some((f) => f.name === uniqueBy)) {
    const names = [...new Set(schema.fields.map((f) => f.name))].join(', ');
    problems.push(
      `submissions.uniqueBy is "${uniqueBy}", which is not a field. Use 'device' or one of: ${names}.`,
    );
  }
  try {
    submissionWindow(config.submissions, { timeZone: timeZone ? undefined : config.timeZone });
  } catch (err) {
    problems.push(`submissions: ${(err as Error).message}`);
  }
  try {
    resolveProtection(config.protection);
  } catch (err) {
    problems.push(`protection: ${(err as Error).message}`);
  }
  try {
    if (typeof config.drafts === 'object' && config.drafts.expires !== undefined) {
      parseDuration(config.drafts.expires);
    }
  } catch (err) {
    problems.push(`drafts: ${(err as Error).message}`);
  }
  if (problems.length) {
    throw new Error(`forms/${id}: invalid config\n  - ${problems.join('\n  - ')}`);
  }
}

/** Turn an imported `forms/<id>/index.tsx` module into what the server needs. */
export function toFormDefinition(id: string, mod: FormModule): LoadedFormDefinition {
  if (typeof mod.default !== 'function') {
    throw new Error(
      `forms/${id}/index.tsx must \`export default\` a component that renders <Form>.`,
    );
  }
  // `function Form() { return <Form>…</Form> }` renders itself, not Open Form's
  // <Form>, and would keep rendering until the process runs out of memory.
  const { name } = mod.default;
  if (/^[A-Z]\w+$/.test(name) && Object.hasOwn(dsl, name)) {
    throw new Error(
      `forms/${id}: the default export is named \`${name}\` like an Open Form component, so it would render itself. Give it another name, such as \`ContactForm\`.`,
    );
  }
  const config = mod.config ?? {};
  const { schema, validators, texts, components } = collectFormSchema(mod.default, {
    id,
    config,
  });
  assertValidConfig(id, config, schema);
  return { id, schema, validators, texts, components, config, version: schemaVersion(schema) };
}
