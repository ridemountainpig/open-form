import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import { type FormConfig, type FormValues, sampleAnswers } from '../schema/index.ts';
import { type CollectedForm, createCollection } from './collector.ts';
import { type Collector, CollectorContext, RuntimeContext } from './context.ts';

export type { CollectedForm } from './collector.ts';

export type CollectOptions = {
  id: string;
  config?: FormConfig;
};

/**
 * Derive the serializable schema by rendering the form once in "collect" mode:
 * every page renders, every <When> renders its children while recording its
 * condition, and every field registers itself. Custom components, `.map()`
 * and wrappers all work because this is a real React render.
 */
export function collectFormSchema(
  Component: ComponentType,
  { id, config }: CollectOptions,
): CollectedForm {
  const collection = createCollection(config);

  try {
    renderToString(
      <RuntimeContext.Provider value={{ mode: 'collect', formId: id, config }}>
        <CollectorContext.Provider value={collection.collector}>
          <Component />
        </CollectorContext.Provider>
      </RuntimeContext.Provider>,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(
      `forms/${id}: rendering failed while reading the form's fields: ${message}\n` +
        'Forms render once on the server; avoid touching `window` / `document` during render (use an effect).',
    );
  }

  const forms = collection.forms();
  if (forms === 0) throw new Error(`forms/${id}: the default export must render a <Form>.`);
  if (forms > 1)
    throw new Error(`forms/${id}: render exactly one <Form> per file (found ${forms}).`);

  const { collected, problems } = collection.finish(id);
  if (problems.length === 1) throw new Error(`forms/${id}: ${problems[0]}`);
  if (problems.length > 1) {
    throw new Error(`forms/${id}: invalid fields\n  - ${problems.join('\n  - ')}`);
  }
  return { ...collected, texts: withAnswerTexts(Component, id, config, collected) };
}

// Enough to try every option of a typical form, small enough to keep loading fast.
const MAX_ANSWER_RENDERS = 120;

/**
 * Text that shows only for some answers (`{score < 7 && <T>…</T>}`) isn't rendered
 * with an empty form, so render again with each sample answer and keep what's new.
 */
function withAnswerTexts(
  Component: ComponentType,
  id: string,
  config: FormConfig | undefined,
  collected: CollectedForm,
): string[] {
  const texts = new Set(collected.texts);
  const textOnly: Collector = {
    addPage() {},
    addField() {},
    markForm() {},
    addText: (text) => {
      if (text.trim()) texts.add(text);
    },
  };
  const { fields, pages } = collected.schema;
  const conditions = [...pages.flatMap((p) => p.when), ...fields.flatMap((f) => f.when)];
  const samples = fields.map((f) => ({ name: f.name, values: sampleAnswers(f, conditions) }));
  const combinations = samples.reduce((n, { values }) => n * Math.max(values.length, 1), 1);
  // Text can need two answers at once; past the cap, try each answer on its own.
  const answers: FormValues[] =
    combinations <= MAX_ANSWER_RENDERS
      ? samples.reduce<FormValues[]>(
          (sets, { name, values }) =>
            values.length
              ? sets.flatMap((set) => values.map((v) => ({ ...set, [name]: v })))
              : sets,
          [{}],
        )
      : samples.flatMap(({ name, values }) => values.map((v) => ({ [name]: v })));
  for (const values of answers.slice(0, MAX_ANSWER_RENDERS)) {
    try {
      renderToString(
        <RuntimeContext.Provider value={{ mode: 'collect', formId: id, config, answers: values }}>
          <CollectorContext.Provider value={textOnly}>
            <Component />
          </CollectorContext.Provider>
        </RuntimeContext.Provider>,
      );
    } catch {
      // The empty render already succeeded; an answer it can't render adds no text.
    }
  }
  return [...texts];
}
