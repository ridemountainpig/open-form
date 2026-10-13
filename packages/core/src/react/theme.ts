import type { Theme } from '../schema/index.ts';
import type { FormComponents } from './components.tsx';

export type FormTheme = Theme & {
  /**
   * Replace how fields look. Each component gets the field's behavior (value,
   * errors, ARIA) as props; anything left out keeps the default look.
   */
  components?: Partial<FormComponents>;
};

export function defineTheme(theme: FormTheme): FormTheme {
  return theme;
}
