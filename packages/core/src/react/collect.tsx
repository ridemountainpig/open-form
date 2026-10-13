import type { ComponentType } from 'react';
import { renderToString } from 'react-dom/server';
import type { FormConfig } from '../schema/index.ts';
import { type CollectedForm, createCollection } from './collector.ts';
import { CollectorContext, RuntimeContext } from './context.ts';

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
  return collected;
}
