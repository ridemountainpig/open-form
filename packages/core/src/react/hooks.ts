import { type FormValues, type Messages, ownValue } from '../schema/index.ts';
import { useFormContext } from './context.ts';
import { useStoreSelector } from './store.ts';

/**
 * Every answer so far, for display: live previews, summaries, prices.
 * Values are raw input (a number field may hold a string while typing), and
 * answers to fields hidden by `<When>` are kept until submit — check the
 * condition yourself if a summary depends on it. Use `<When>` to show or hide fields.
 */
export function useFormValues(): FormValues {
  const { store } = useFormContext('useFormValues');
  return useStoreSelector(store, (s) => s.values);
}

/** One answer, re-rendering only when it changes. */
export function useFieldValue<T = unknown>(name: string): T | undefined {
  const { store } = useFormContext('useFieldValue');
  return useStoreSelector(store, (s) => ownValue(s.values, name)) as T | undefined;
}

/** Built-in strings in the form's locale, for custom components that need them. */
export function useFormMessages(): Messages {
  return useFormContext('useFormMessages').messages;
}
