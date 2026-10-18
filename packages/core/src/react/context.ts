import { createContext, useContext } from 'react';
import type {
  Condition,
  CustomValidator,
  FieldSchema,
  FormConfig,
  FormValues,
  Locale,
  Messages,
  PageSchema,
  Theme,
} from '../schema/index.ts';
import type { FormStore } from './store.ts';
import type { FormTheme } from './theme.ts';

export type FormAvailability =
  | { state: 'open' }
  | { state: 'closed' | 'full' | 'duplicate' | 'not-found'; message?: string }
  | { state: 'not-open'; message?: string; opensAt?: string };

export type NavigationInfo = {
  step: number;
  stepNumber: number;
  totalSteps: number;
  stepTitle?: string;
  /** Studio preview has jumped freely between steps; nothing will be submitted. */
  inspecting?: boolean;
  /** The success screen is showing. */
  done?: boolean;
  /** Studio preview is showing the screen for this unavailable state. */
  notice?: PreviewNotice['state'];
};

/** An unavailable state Studio's preview can show without the form being in it. */
export type PreviewNotice =
  | { state: 'closed' | 'full' | 'duplicate' }
  | { state: 'not-open'; opensAt?: string };

/** Studio → preview commands (see `FormRuntime.previewControl`). */
export type PreviewCommand =
  | {
      type: 'goto';
      step: number;
      /** Field labels and option labels by value, so conditions read as questions. */
      labels?: { fields: Record<string, string>; options: Record<string, Record<string, string>> };
      /** Leave out the "inspecting" banner, e.g. when judging a theme rather than a form. */
      quiet?: boolean;
    }
  | { type: 'done' }
  | ({ type: 'notice' } & PreviewNotice);

/**
 * What the host (the Open Form app, Studio preview, or an embedding app)
 * tells the runtime about the form it is rendering.
 */
export type FormRuntime = {
  mode: 'interactive' | 'collect';
  formId?: string;
  config?: FormConfig;
  theme?: FormTheme;
  themeId?: string;
  locale?: Locale;
  /** URL submissions are POSTed to. */
  endpoint?: string;
  availability?: FormAvailability;
  /** Signed timing token from the server, echoed back on submit. */
  token?: string;
  preview?: boolean;
  onNavigate?: (info: NavigationInfo) => void;
  /** A language asked for by the URL (`?lang=`) or the host; used when the form has it. */
  requestedLocale?: string;
  /** Called when the shown language changes, e.g. to update `<html lang>` and the title. */
  onLocaleChange?: (locale: Locale) => void;
  /** Called after a successful submission. */
  onSubmitted?: (result: { id?: string }) => void;
  /** Follows `config.success.redirect`. Default: navigate this window. */
  redirect?: (url: string) => void;
  /** Preview only: lets Studio jump to any step. Jumping turns submission off. */
  previewControl?: { subscribe(listener: (command: PreviewCommand) => void): () => void };
  /** Preview only: unsaved tokens from Studio's Adjust panel, in place of the form's own theme's tokens. */
  themeDraft?: Theme;
};

export const RuntimeContext = createContext<FormRuntime>({ mode: 'interactive' });

export function useRuntime(): FormRuntime {
  return useContext(RuntimeContext);
}

export type RegisteredField = {
  name: string;
  page: number;
  getSchema(): Omit<FieldSchema, 'page' | 'when'>;
  getValidator(): CustomValidator | undefined;
  /** The field's own `defaultValue`, applied when it mounts without an answer. */
  getDefault(): unknown;
  focus(): void;
};

export type FormContextValue = {
  store: FormStore;
  messages: Messages;
  register(field: RegisteredField): () => void;
  /** The answers of the fields that are showing, coerced as the server reads them. */
  visibleValues(values: FormValues): FormValues;
};

export const FormContext = createContext<FormContextValue | null>(null);

export function useFormContext(component: string): FormContextValue {
  const ctx = useContext(FormContext);
  if (!ctx) throw new Error(`<${component}> must be rendered inside <Form>.`);
  return ctx;
}

/** Where a field sits: its step and the conditions wrapping it. */
export type ScopeValue = { page: number; when: Condition[] };

export const ScopeContext = createContext<ScopeValue>({ page: 0, when: [] });

export type Collector = {
  addPage(page: PageSchema): void;
  /** Every string that goes through translation, for coverage checks. */
  addText?(text: string): void;
  addField(field: FieldSchema, validator: CustomValidator | undefined): void;
  /** A component slot the form renders, so `check` can spot theme components it never uses. */
  addComponent?(name: string): void;
  markForm(): void;
};

export const CollectorContext = createContext<Collector | null>(null);
