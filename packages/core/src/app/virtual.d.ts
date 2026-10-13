declare module 'virtual:open-form/forms' {
  import type { FormModule } from './lib/forms.ts';

  export const formIds: string[];
  export function loadForm(id: string): Promise<FormModule>;
}

declare module 'virtual:open-form/themes' {
  import type { FormTheme } from '../react/index.ts';

  export const themeIds: string[];
  export function loadTheme(id: string): Promise<{ default?: FormTheme } | undefined>;
}

declare module 'virtual:open-form/config' {
  import type { Locale } from '../schema/index.ts';

  const config: {
    version: string;
    dev: boolean;
    locale: Locale;
  };
  export default config;
}
