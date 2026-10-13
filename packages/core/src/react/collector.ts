import {
  CHOICE_TYPES,
  type CustomValidator,
  configTexts,
  type FieldSchema,
  type FormConfig,
  type FormSchema,
  type PageSchema,
  patternProblem,
  stableStringify,
  validatorForFields,
} from '../schema/index.ts';
import type { Collector } from './context.ts';

export type CollectedForm = {
  schema: FormSchema;
  validators: Map<string, CustomValidator>;
  /** Every string respondents can see, in render order — what translations must cover. */
  texts: string[];
};

export type Collection = {
  collector: Collector;
  /** How many `<Form>`s rendered. */
  forms(): number;
  /** The collected form, and every reason it can't be served as written. */
  finish(id: string): { collected: CollectedForm; problems: string[] };
};

type Entry = { field: FieldSchema; validator: CustomValidator | undefined };

/**
 * What a form registers while it renders in collect mode. `dedupe` drops
 * exact repeats, for renders that may run twice (Strict Mode, a retry after
 * suspending) — the browser's own collect pass.
 */
export function createCollection(config?: FormConfig, { dedupe = false } = {}): Collection {
  const pages = new Map<number, PageSchema>();
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const texts = new Set<string>(configTexts(config));
  let forms = 0;

  const collector: Collector = {
    addPage(page) {
      pages.set(page.index, page);
    },
    addField(field, validator) {
      if (dedupe) {
        const key = stableStringify(field);
        if (seen.has(key)) return;
        seen.add(key);
      }
      entries.push({ field, validator });
    },
    markForm() {
      forms++;
      // A form that renders itself (a component named like a field it uses)
      // would otherwise recurse until the process runs out of memory.
      if (forms > 1 && !dedupe) throw new Error('render exactly one <Form> per file.');
    },
    addText(text) {
      if (text.trim()) texts.add(text);
    },
  };

  return {
    collector,
    forms: () => forms,
    finish(id) {
      const problems = new Set<string>();
      const byName = new Map<string, Entry[]>();
      for (const entry of entries) {
        const { field } = entry;
        const same = byName.get(field.name) ?? [];
        const other = same.find((e) => e.field.type !== field.type);
        if (other) {
          problems.add(
            `field "${field.name}" is declared as both ${other.field.type} and ${field.type}. Use distinct names.`,
          );
        } else if (
          same.some((e) => stableStringify(e.field.when) === stableStringify(field.when))
        ) {
          problems.add(
            `field "${field.name}" is rendered twice under the same conditions, so both copies show at once and share one answer. Use distinct names, or put each copy in its own <When> branch.`,
          );
        }
        byName.set(field.name, [...same, entry]);
        if (field.name === '__proto__') problems.add('the field name "__proto__" is reserved.');
        const pattern = field.pattern === undefined ? undefined : patternProblem(field.pattern);
        if (pattern) problems.add(`field "${field.name}": ${pattern}`);
        if (CHOICE_TYPES.has(field.type) && !field.options?.length) {
          problems.add(
            `field "${field.name}" (${field.type}) has no options. Pass \`options\` that are known when the form renders; use a text field for free-form answers.`,
          );
        }
      }

      const validators = new Map<string, CustomValidator>();
      for (const [name, list] of byName) {
        const validator = validatorForFields(
          list.map((e) => ({ when: e.field.when, validator: e.validator })),
        );
        if (validator) validators.set(name, validator);
      }

      const schema: FormSchema = {
        id,
        pages: [...pages.values()],
        fields: entries.map((e) => e.field),
      };
      if (config?.title) schema.title = config.title;
      if (config?.description) schema.description = config.description;
      return { collected: { schema, validators, texts: [...texts] }, problems: [...problems] };
    },
  };
}
