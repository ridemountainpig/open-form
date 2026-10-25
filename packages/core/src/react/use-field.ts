import { useCallback, useContext, useEffect, useId, useMemo, useRef } from 'react';
import {
  CHOICE_TYPES,
  type CustomValidator,
  coerceValue,
  type FieldConstraints,
  type FieldOption,
  type FieldSchema,
  type FieldType,
  isFilled,
  ownValue,
  runCustomValidator,
  validateField,
} from '../schema/index.ts';
import { CollectorContext, ScopeContext, useFormContext, useRuntime } from './context.ts';
import { useTranslate } from './i18n.tsx';
import { useStoreSelector } from './store.ts';

let pressing = false;
let watching = false;

// A blur caused by pressing another control would show its error mid-press, push
// that control down and make the click miss, so the check waits until release.
function watchPresses() {
  if (typeof document === 'undefined' || watching) return;
  watching = true;
  document.addEventListener(
    'pointerdown',
    () => {
      pressing = true;
    },
    true,
  );
  const release = () => {
    pressing = false;
  };
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);
}

function afterPress(run: () => void) {
  if (typeof document === 'undefined' || !pressing) return run();
  const done = () => {
    document.removeEventListener('pointerup', done, true);
    document.removeEventListener('pointercancel', done, true);
    setTimeout(run, 0);
  };
  document.addEventListener('pointerup', done, true);
  document.addEventListener('pointercancel', done, true);
}

export type UseFieldOptions = FieldConstraints & {
  name: string;
  /** Built-in fields set this; custom components can omit it (`'custom'`). */
  type?: FieldType;
  label?: string;
  description?: string;
  options?: FieldOption[];
  /** Extra validation: return an error message, or pass a Zod / Valibot / Standard Schema. */
  validate?: CustomValidator;
  defaultValue?: unknown;
};

export type FieldApi = {
  id: string;
  name: string;
  value: unknown;
  setValue(value: unknown): void;
  onBlur(): void;
  error: string | undefined;
  invalid: boolean;
  required: boolean;
  label?: string;
  description?: string;
  descriptionId?: string;
  errorId: string;
  /**
   * Attach to the element that should receive focus when the field is invalid.
   * Without it, the element carrying `controlProps` is focused.
   */
  ref(element: HTMLElement | null): void;
  /** Spread onto the primary control for labels, ARIA and blur handling. */
  controlProps: {
    id: string;
    name: string;
    'aria-invalid': boolean | undefined;
    'aria-describedby': string | undefined;
    'aria-required': boolean | undefined;
    /** Names a control that has no visible label of its own, like a phone field's country picker. */
    'aria-label'?: string;
    onBlur(): void;
    /** Dev only: where the field is written, for Studio's inspector. */
    'data-of-loc'?: string;
  };
};

type FieldDefinition = Omit<FieldSchema, 'page' | 'when'>;

function toDefinition(opts: UseFieldOptions): FieldDefinition {
  const def: FieldDefinition = { name: opts.name, type: opts.type ?? 'custom' };
  const keys = [
    'label',
    'description',
    'required',
    'minLength',
    'maxLength',
    'pattern',
    'patternMessage',
    'min',
    'max',
    'integer',
    'step',
    'minSelected',
    'maxSelected',
    'international',
    'countries',
  ] as const;
  for (const key of keys) {
    const value = opts[key];
    if (value !== undefined && value !== false) (def as Record<string, unknown>)[key] = value;
  }
  // A choice field always carries its list, so an empty one rejects every answer.
  if (CHOICE_TYPES.has(def.type)) def.options = opts.options ?? [];
  else if (opts.options?.length) def.options = opts.options;
  if (opts.validate) def.hasCustomValidator = true;
  return def;
}

function domId(name: string, reactId: string): string {
  return `of-${name}-${reactId}`.replace(/[^\w-]/g, '');
}

/**
 * Connects a control to the form: value, validation, errors, focus and ARIA.
 * Every built-in field uses it, and so can custom components.
 */
export function useField(opts: UseFieldOptions): FieldApi {
  const runtime = useRuntime();
  const collector = useContext(CollectorContext);
  const scope = useContext(ScopeContext);
  const { store, messages, register, visibleValues } = useFormContext(
    opts.type ? 'field' : 'useField',
  );
  const tr = useTranslate();
  const reactId = useId();
  const id = domId(opts.name, reactId);
  // Before any field can blur: the press that moves focus must already be seen.
  useEffect(watchPresses, []);
  const { name } = opts;

  if (runtime.mode === 'collect' && collector) {
    collector.addField(
      { ...toDefinition(opts), page: scope.page, when: scope.when },
      opts.validate,
    );
  }

  const optsRef = useRef(opts);
  optsRef.current = opts;
  const elementRef = useRef<HTMLElement | null>(null);
  const validationRun = useRef(0);

  const raw = useStoreSelector(store, (s) => ownValue(s.values, name));
  const error = useStoreSelector(store, (s) => ownValue(s.errors, name) as string | undefined);
  const value = raw === undefined ? opts.defaultValue : raw;

  const validateNow = useCallback(
    async (next: unknown) => {
      const run = ++validationRun.current;
      const current = optsRef.current;
      const def = { ...toDefinition(current), page: scope.page, when: scope.when };
      const coerced = coerceValue(def, next);
      let message = validateField(def, coerced, messages);
      if (!message && current.validate && isFilled(coerced)) {
        message = await runCustomValidator(
          current.validate,
          coerced,
          visibleValues(store.getState().values),
        );
        if (message) message = tr(message);
      }
      if (run === validationRun.current) store.setError(name, message);
    },
    [messages, name, scope, store, tr, visibleValues],
  );

  useEffect(() => {
    if (runtime.mode === 'collect') return;
    const initial = optsRef.current.defaultValue;
    if (initial !== undefined && ownValue(store.getState().values, name) === undefined) {
      store.setValue(name, initial);
    }
    return register({
      name,
      page: scope.page,
      getSchema: () => toDefinition(optsRef.current),
      getValidator: () => optsRef.current.validate,
      getDefault: () => optsRef.current.defaultValue,
      element: () => elementRef.current ?? document.getElementById(id),
    });
  }, [id, name, register, runtime.mode, scope.page, store]);

  const setValue = useCallback(
    (next: unknown) => {
      store.setValue(name, next);
      if (ownValue(store.getState().errors, name)) void validateNow(next);
    },
    [name, store, validateNow],
  );

  // Format errors show on blur; "required" waits for Next/Submit so tabbing
  // through an untouched form doesn't light it up red.
  const onBlur = useCallback(() => {
    afterPress(() => {
      const current = ownValue(store.getState().values, name);
      store.setState((s) => ({ touched: { ...s.touched, [name]: true } }));
      if (isFilled(current) || ownValue(store.getState().errors, name)) void validateNow(current);
    });
  }, [name, store, validateNow]);

  const ref = useCallback((element: HTMLElement | null) => {
    elementRef.current = element;
  }, []);

  const descriptionId = opts.description ? `${id}-description` : undefined;
  const errorId = `${id}-error`;
  const describedBy = [descriptionId, error ? errorId : undefined].filter(Boolean).join(' ');
  const required = Boolean(opts.required);
  // Set on the field's element by the dev server (see vite/loc-plugin.ts); it
  // reaches the control because every field spreads `controlProps`.
  const loc = (opts as { 'data-of-loc'?: string })['data-of-loc'];

  const controlProps = useMemo(
    () => ({
      id,
      name,
      'aria-invalid': error ? true : undefined,
      'aria-describedby': describedBy || undefined,
      'aria-required': required || undefined,
      onBlur,
      ...(loc ? { 'data-of-loc': loc } : {}),
    }),
    [id, name, error, describedBy, required, onBlur, loc],
  );

  return {
    id,
    name,
    value,
    setValue,
    onBlur,
    error,
    invalid: Boolean(error),
    required,
    label: opts.label === undefined ? undefined : tr(opts.label),
    description: opts.description === undefined ? undefined : tr(opts.description),
    descriptionId,
    errorId,
    ref,
    controlProps,
  };
}
