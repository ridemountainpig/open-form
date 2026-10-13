import type { FieldOption } from '../schema/index.ts';

export type OptionInput = string | number | { value: string | number; label?: string };

export function normalizeOptions(options: readonly OptionInput[] | undefined): FieldOption[] {
  if (!options) return [];
  return options.map((option) => {
    if (typeof option === 'object') {
      const value = String(option.value);
      return { value, label: option.label ?? value };
    }
    return { value: String(option), label: String(option) };
  });
}

/** Option labels in the respondent's language; values stay as written. */
export function translateOptions(
  options: FieldOption[],
  tr: (text: string) => string,
): FieldOption[] {
  return options.map((o) => ({ value: o.value, label: tr(o.label) }));
}
