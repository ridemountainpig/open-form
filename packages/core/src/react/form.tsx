import {
  Component,
  type FormEvent,
  isValidElement,
  type ReactNode,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { createPortal } from 'react-dom';
import {
  type ConditionNames,
  coerceValue,
  coerceValues,
  evaluateAll,
  explainCondition,
  type FieldErrors,
  type FormSchema,
  type FormValues,
  format,
  formatDateTime,
  formLocales,
  getMessages,
  isFilled,
  LOCALE_NAMES,
  type Locale,
  type Messages,
  ownValue,
  pickLocale,
  resolveVisibleFields,
  runCustomValidator,
  sourceLocale,
  submissionValues,
  themeToCss,
  translate,
  type VisibleFields,
  validateField,
} from '../schema/index.ts';
import { type CollectedForm, createCollection } from './collector.ts';
import {
  ComponentsContext,
  type FormComponents,
  type LayoutUIProps,
  mergeComponents,
  useFormComponents,
} from './components.tsx';
import {
  type Collector,
  CollectorContext,
  FormContext,
  type FormContextValue,
  type FormRuntime,
  type PreviewCommand,
  type PreviewNotice,
  type RegisteredField,
  RuntimeContext,
  ScopeContext,
  useRuntime,
} from './context.ts';
import { clearDraft, draftLifetime, readDraft, sweepDrafts, writeDraft } from './drafts.ts';
import { type FormLanguage, TranslateContext, type Translator } from './i18n.tsx';
import { InspectContext } from './inspect.ts';
import { conditionFromProps } from './layout.tsx';
import { type FormNav, NavContext } from './nav.ts';
import { type FormParts, partitionForm, type StepEntry } from './steps.ts';
import { createFormStore, type FormStore, useStoreSelector } from './store.ts';
import type { FormTheme } from './theme.ts';
import { visitorId } from './visitor.ts';

export type FormProps = {
  children?: ReactNode;
  /** Overrides `config.title`. */
  title?: string;
  /** Overrides `config.description`. */
  description?: string;
  defaultValues?: FormValues;
  /** Handle submission yourself instead of POSTing to Open Form's server. */
  onSubmit?: (values: FormValues) => void | Promise<void>;
  /**
   * Display-only content beside the form on wide screens (below it on narrow
   * ones): a live preview, an order summary, a price. Read answers with
   * `useFormValues()` / `useFieldValue()`. Don't put fields here.
   */
  aside?: ReactNode;
  /**
   * This form's look: tokens, components and CSS, usually the copy in
   * `./theme/` made by `open-form theme copy`. Wins over a host's theme.
   */
  theme?: FormTheme;
  /** Replace how this form's fields look, on top of the theme's components. */
  components?: Partial<FormComponents>;
  className?: string;
};

const NO_CONDITIONS: StepEntry['when'] = [];
const THEME_ID_RE = /^[A-Za-z0-9][\w-]*$/;
const NOTICE_STATES = ['closed', 'not-open', 'full', 'duplicate'] as const;
const ROOT_SCOPE = { page: 0, when: NO_CONDITIONS };

export function Form(props: FormProps) {
  const runtime = useRuntime();
  const collector = useContext(CollectorContext);
  const config = runtime.config;
  const collecting = runtime.mode === 'collect';
  const source = sourceLocale(config, runtime.locale);
  const availableKey = formLocales(config, runtime.locale).join(',');
  const available = useMemo(() => availableKey.split(',') as Locale[], [availableKey]);
  const [picked, setPicked] = useState<Locale | null>(null);
  const [stored] = useState(() => readStoredLocale(runtime.formId));
  const locale: Locale = collecting
    ? source
    : pickLocale(available, [picked, runtime.requestedLocale, stored], browserLanguages());
  const messages = getMessages(locale);

  const tr = useMemo<Translator>(() => {
    const translation = locale === source ? undefined : config?.translations?.[locale];
    const fill = (text: string, vars?: Record<string, string | number>) =>
      vars ? format(text, vars) : text;
    const fn = collecting
      ? (text: string, vars?: Record<string, string | number>) => {
          collector?.addText?.(text);
          return fill(text, vars);
        }
      : (text: string, vars?: Record<string, string | number>) =>
          fill(translate(translation, text), vars);
    return Object.assign(fn, { locale, source });
  }, [collecting, collector, config, locale, source]);

  const onLocaleChange = runtime.onLocaleChange;
  useEffect(() => {
    if (!collecting) onLocaleChange?.(locale);
  }, [collecting, locale, onLocaleChange]);

  const formId = runtime.formId;
  const language = useMemo<FormLanguage>(
    () => ({
      locale,
      source,
      available,
      setLocale(next) {
        setPicked(next);
        try {
          if (formId) localStorage.setItem(`open-form:lang:${formId}`, next);
        } catch {}
      },
    }),
    [available, formId, locale, source],
  );
  const i18n = useMemo(() => ({ tr, language }), [tr, language]);
  const [store] = useState(() => createFormStore(props.defaultValues));
  const registry = useRef(new Set<RegisteredField>());
  const fieldSteps = useRef(new Map<string, number>());
  // undefined until the browser has collected the schema; null if it couldn't.
  const [collected, setCollected] = useState<CollectedForm | null>();
  const inBrowser = useSyncExternalStore(subscribeNever, onClient, onServer);
  const resolve = useMemo(() => visibilityResolver(collected?.schema), [collected]);

  const register = useCallback((field: RegisteredField) => {
    registry.current.add(field);
    fieldSteps.current.set(field.name, field.page);
    return () => {
      registry.current.delete(field);
    };
  }, []);

  const ctx = useMemo<FormContextValue>(
    () => ({ store, messages, register, visibleValues: (values) => resolve(values).values }),
    [store, messages, register, resolve],
  );
  const parts = partitionForm(props.children, conditionFromProps);
  // Appearance never reaches the schema: collecting renders the default components.
  const themeComponents = collecting ? undefined : (props.theme ?? runtime.theme)?.components;
  const components = useMemo(
    () => mergeComponents(themeComponents, props.components),
    [themeComponents, props.components],
  );

  if (collecting) {
    collector?.markForm();
    const pages = parts.steps.length ? parts.steps : [{ when: [], title: undefined }];
    pages.forEach((page, index) => {
      collector?.addPage({ index, title: page.title, when: page.when });
    });
    const textOnly: Collector = {
      addPage() {},
      addField() {},
      markForm() {},
      addText: (text) => collector?.addText?.(text),
    };
    for (const text of [
      props.title,
      props.description,
      parts.submit?.props.children,
      parts.success?.props.title,
      parts.success?.props.children,
    ]) {
      if (typeof text === 'string') tr(text);
    }
    return (
      <TranslateContext.Provider value={i18n}>
        <FormContext.Provider value={ctx}>
          <ComponentsContext.Provider value={components}>
            <ScopeContext.Provider value={ROOT_SCOPE}>{parts.loose}</ScopeContext.Provider>
            {parts.steps.map((step, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional
              <ScopeContext.Provider key={index} value={{ page: index, when: step.when }}>
                {step.element}
              </ScopeContext.Provider>
            ))}
            {/* Rendered only so their text counts toward translation coverage; any
                fields inside stay out of the schema. */}
            <CollectorContext.Provider value={textOnly}>
              <ScopeContext.Provider value={ROOT_SCOPE}>
                {props.aside}
                {parts.success?.props.children}
                {NOTICE_STATES.map((state) => (
                  <components.Notice
                    key={state}
                    state={state}
                    title={messages.closedTitle}
                    message=""
                  />
                ))}
              </ScopeContext.Provider>
            </CollectorContext.Provider>
          </ComponentsContext.Provider>
        </FormContext.Provider>
      </TranslateContext.Provider>
    );
  }

  return (
    <>
      <TranslateContext.Provider value={i18n}>
        <FormContext.Provider value={ctx}>
          <ComponentsContext.Provider value={components}>
            <InteractiveForm
              tr={tr}
              language={language}
              props={props}
              parts={parts}
              runtime={runtime}
              store={store}
              messages={messages}
              registry={registry.current}
              fieldSteps={fieldSteps.current}
              collected={collected ?? undefined}
              resolve={resolve}
            />
          </ComponentsContext.Provider>
        </FormContext.Provider>
      </TranslateContext.Provider>
      {inBrowser && collected === undefined && (
        <BrowserCollect props={props} runtime={runtime} onDone={setCollected} />
      )}
    </>
  );
}

const subscribeNever = () => () => {};
const onClient = () => true;
const onServer = () => false;

type Resolve = (values: FormValues) => VisibleFields;

// One cached result per store snapshot: every <When> and step asks for the same values.
function visibilityResolver(schema: FormSchema | undefined): Resolve {
  let input: FormValues | undefined;
  let output: VisibleFields = { fields: [], values: {} };
  return (values) => {
    if (values !== input) {
      input = values;
      output = schema
        ? resolveVisibleFields(schema, coerceValues(schema, values))
        : { fields: [], values };
    }
    return output;
  };
}

/**
 * Renders the form once more in collect mode, into a detached node, so the
 * browser holds the same schema the server derives: what shows, what a
 * custom validator sees and where a server error belongs are then decided by
 * the same code on both sides.
 */
function BrowserCollect({
  props,
  runtime,
  onDone,
}: {
  props: FormProps;
  runtime: FormRuntime;
  onDone: (collected: CollectedForm | null) => void;
}) {
  const [container] = useState(() => document.createElement('div'));
  const [collection] = useState(() => createCollection(runtime.config, { dedupe: true }));
  const { formId, config } = runtime;
  const collectRuntime = useMemo<FormRuntime>(
    () => ({ mode: 'collect', formId, config }),
    [config, formId],
  );
  const done = useCallback(
    () => onDone(collection.finish(formId ?? '').collected),
    [collection, formId, onDone],
  );
  const failed = useCallback(() => onDone(null), [onDone]);
  return createPortal(
    <CollectBoundary onError={failed}>
      <Suspense fallback={null}>
        <RuntimeContext.Provider value={collectRuntime}>
          <CollectorContext.Provider value={collection.collector}>
            <Form {...props} />
          </CollectorContext.Provider>
        </RuntimeContext.Provider>
        <Committed onCommit={done} />
      </Suspense>
    </CollectBoundary>,
    container,
  );
}

function Committed({ onCommit }: { onCommit: () => void }) {
  useLayoutEffect(() => onCommit(), [onCommit]);
  return null;
}

class CollectBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function readStoredLocale(formId: string | undefined): string | null {
  if (!formId) return null;
  try {
    return localStorage.getItem(`open-form:lang:${formId}`);
  } catch {
    return null;
  }
}

function browserLanguages(): readonly string[] {
  return typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
}

type InteractiveProps = {
  tr: Translator;
  language: FormLanguage;
  props: FormProps;
  parts: FormParts;
  runtime: FormRuntime;
  store: FormStore;
  messages: Messages;
  registry: Set<RegisteredField>;
  fieldSteps: Map<string, number>;
  collected: CollectedForm | undefined;
  resolve: Resolve;
};

type SubmitResponse = {
  id?: string;
  error?: string;
  message?: string;
  errors?: FieldErrors;
};

function InteractiveForm({
  tr,
  language,
  props,
  parts,
  runtime,
  store,
  messages,
  registry,
  fieldSteps,
  collected,
  resolve,
}: InteractiveProps) {
  const multiStep = parts.steps.length > 0;
  const steps: Array<Pick<StepEntry, 'when' | 'title'> & { element: ReactNode }> = multiStep
    ? parts.steps
    : [{ element: <div className="of-fields">{parts.loose}</div>, when: NO_CONDITIONS }];

  const visibleKey = useStoreSelector(store, (s) => {
    const values = resolve(s.values).values;
    return steps
      .map((step, i) => (evaluateAll(step.when, values) ? i : -1))
      .filter((i) => i >= 0)
      .join(',');
  });
  const [inspecting, setInspecting] = useState(false);
  const [quiet, setQuiet] = useState(false);
  const [previewNotice, setPreviewNotice] = useState<PreviewNotice | null>(null);
  const [labels, setLabels] = useState<Extract<PreviewCommand, { type: 'goto' }>['labels']>();
  const names = useMemo<ConditionNames>(
    () => ({
      field: (name) => {
        const label = labels && ownValue(labels.fields, name);
        return typeof label === 'string' && label ? tr(label) : undefined;
      },
      option: (name, value) => {
        const options = labels && ownValue(labels.options, name);
        const label = options && ownValue(options as FormValues, String(value));
        return typeof label === 'string' && label ? tr(label) : undefined;
      },
    }),
    [labels, tr],
  );
  const inspectState = useMemo(() => ({ inspecting, names }), [inspecting, names]);
  const stepCount = steps.length;
  const visible = useMemo(
    () =>
      inspecting
        ? Array.from({ length: stepCount }, (_, i) => i)
        : visibleKey.split(',').filter(Boolean).map(Number),
    [inspecting, stepCount, visibleKey],
  );
  const step = useStoreSelector(store, (s) => s.step);
  const status = useStoreSelector(store, (s) => s.status);
  const formError = useStoreSelector(store, (s) => s.formError);
  const alertCount = useStoreSelector(store, (s) => s.alertCount);

  const current = visible.includes(step)
    ? step
    : (visible.find((i) => i >= step) ?? visible[visible.length - 1] ?? 0);
  const position = Math.max(0, visible.indexOf(current));
  const isLast = position >= visible.length - 1;

  const rootRef = useRef<HTMLDivElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);
  const honeypotRef = useRef<HTMLInputElement>(null);
  const focusAfterRender = useRef<'step' | string | null>(null);
  const [focusRequest, setFocusRequest] = useState(0);
  const requestFocus = useCallback((target: 'step' | string) => {
    focusAfterRender.current = target;
    setFocusRequest((n) => n + 1);
  }, []);
  const showError = useCallback(
    (message: string) =>
      store.setState((s) => ({ formError: message, alertCount: s.alertCount + 1 })),
    [store],
  );
  // Next, jumps and submit validate (sometimes asynchronously) before acting; one at a time.
  const busy = useRef(false);
  const [furthest, setFurthest] = useState(0);
  useEffect(() => setFurthest((f) => Math.max(f, position)), [position]);

  const config = runtime.config;
  const formId = runtime.formId;
  const draftMs = runtime.preview || !formId ? null : draftLifetime(config?.drafts);
  const [restored, setRestored] = useState(false);
  const restoredAt = useRef<number | null>(null);

  // Drafts: restore after mount (localStorage doesn't exist while rendering on a
  // server), then save every change until the form is sent. A form that stopped
  // keeping drafts forgets the one it may have left behind.
  useEffect(() => {
    if (runtime.preview || !formId) return;
    sweepDrafts();
    if (draftMs === null) clearDraft(formId);
  }, [draftMs, formId, runtime.preview]);

  useEffect(() => {
    if (draftMs === null || !formId) return;
    const draft = readDraft(formId, draftMs);
    if (draft && Object.keys(draft.values).length > 0) {
      store.setState((s) => ({ values: { ...s.values, ...draft.values }, step: draft.step }));
      restoredAt.current = draft.step;
      setRestored(true);
    }
    return store.subscribe(() => {
      const { values, step, status } = store.getState();
      if (status === 'success') clearDraft(formId);
      else writeDraft(formId, { values, step }, draftMs);
    });
  }, [draftMs, formId, store]);

  const startOver = useCallback(() => {
    if (formId) clearDraft(formId);
    const values = { ...props.defaultValues };
    // Mounted fields won't re-run their mount effect, so give them their own defaults back.
    const defaults = [...registry]
      .map((field) => [field.name, field.getDefault()] as const)
      .filter(([name, value]) => value !== undefined && ownValue(values, name) === undefined);
    store.setState({
      values: { ...values, ...Object.fromEntries(defaults) },
      errors: {},
      touched: {},
      step: 0,
      status: 'idle',
      formError: undefined,
    });
    setFurthest(0);
    setRestored(false);
    restoredAt.current = null;
    requestFocus('step');
  }, [formId, props.defaultValues, registry, requestFocus, store]);

  const sourceTitle = props.title ?? config?.title;
  const sourceDescription = props.description ?? config?.description;
  const title = sourceTitle === undefined ? undefined : tr(sourceTitle);
  const description = sourceDescription === undefined ? undefined : tr(sourceDescription);
  const stepTitle = steps[current]?.title;

  useEffect(() => {
    runtime.onNavigate?.({
      step: current,
      stepNumber: position + 1,
      totalSteps: visible.length,
      stepTitle,
      inspecting,
      done: status === 'success',
      notice: previewNotice?.state,
    });
  }, [
    runtime.onNavigate,
    current,
    position,
    visible.length,
    stepTitle,
    inspecting,
    status,
    previewNotice,
  ]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after each step change or focus request
  useEffect(() => {
    const target = focusAfterRender.current;
    focusAfterRender.current = null;
    if (!target) return;
    if (target === 'step') {
      stepRef.current?.focus({ preventScroll: true });
      const top = rootRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 0) rootRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    for (const field of registry) {
      if (field.name === target) {
        field.focus();
        break;
      }
    }
  }, [current, status, focusRequest]);

  const goTo = useCallback(
    (next: number, focus: 'step' | string = 'step') => {
      requestFocus(focus);
      store.setState({ step: next });
    },
    [requestFocus, store],
  );

  const markInvalid = useCallback(
    (errors: ReadonlyMap<string, string>, checked: Iterable<string>) => {
      const replaced = new Set(checked);
      store.setState((s) => {
        const kept = Object.entries(s.errors).filter(([name]) => !replaced.has(name));
        const touched = [...replaced].map((name) => [name, true] as const);
        return {
          errors: Object.fromEntries([...kept, ...errors]),
          touched: { ...s.touched, ...Object.fromEntries(touched) },
        };
      });
      if (errors.size > 0) showError(messages.fixErrors);
      else store.setState({ formError: undefined });
    },
    [messages, showError, store],
  );

  const validateMounted = useCallback(async (): Promise<boolean> => {
    const { values } = store.getState();
    const shown = resolve(values).values;
    const errors = new Map<string, string>();
    let firstInvalid: RegisteredField | undefined;
    for (const field of registry) {
      if (errors.has(field.name)) continue;
      const def = { ...field.getSchema(), page: field.page, when: [] };
      const value = coerceValue(def, ownValue(values, field.name));
      let message = validateField(def, value, messages);
      const validator = field.getValidator();
      if (!message && validator && isFilled(value)) {
        message = await runCustomValidator(validator, value, shown);
        if (message) message = tr(message);
      }
      if (message) {
        errors.set(field.name, message);
        firstInvalid ??= field;
      }
    }
    markInvalid(
      errors,
      [...registry].map((field) => field.name),
    );
    // After the render that sets aria-invalid and the error, so it's read with the field.
    if (firstInvalid) requestFocus(firstInvalid.name);
    return !firstInvalid;
  }, [markInvalid, messages, registry, requestFocus, resolve, store, tr]);

  /** Steps the respondent skips past, checked from the schema since they aren't mounted. */
  const validateSkipped = useCallback(
    async (skipped: readonly number[]): Promise<{ step: number; name: string } | undefined> => {
      if (!collected || skipped.length === 0) return undefined;
      const { fields, values } = resolve(store.getState().values);
      const mounted = new Set([...registry].map((field) => field.name));
      const errors = new Map<string, string>();
      const checked = new Set<string>();
      let first: { step: number; name: string } | undefined;
      for (const field of fields) {
        if (!skipped.includes(field.page) || mounted.has(field.name)) continue;
        if (errors.has(field.name)) continue;
        checked.add(field.name);
        const value = ownValue(values, field.name);
        let message = validateField(field, value, messages);
        const validator = collected.validators.get(field.name);
        if (!message && validator && isFilled(value)) {
          message = await runCustomValidator(validator, value, values);
          if (message) message = tr(message);
        }
        if (!message) continue;
        errors.set(field.name, message);
        if (!first || skipped.indexOf(field.page) < skipped.indexOf(first.step)) {
          first = { step: field.page, name: field.name };
        }
      }
      markInvalid(errors, checked);
      return first;
    },
    [collected, markInvalid, messages, registry, resolve, store, tr],
  );

  /** The step a field is answered on: the one where it's showing, if any. */
  const stepOf = useCallback(
    (name: string, shown: FormValues): number | undefined => {
      const fields = collected?.schema.fields.filter((f) => f.name === name) ?? [];
      const field = fields.find((f) => evaluateAll(f.when, shown)) ?? fields[0];
      return field ? field.page : fieldSteps.get(name);
    },
    [collected, fieldSteps],
  );

  const submit = useCallback(async () => {
    store.setState({ status: 'submitting', formError: undefined });
    const { values } = store.getState();
    try {
      if (props.onSubmit) {
        await props.onSubmit(collected ? submissionValues(collected.schema, values) : values);
        store.setState({ status: 'success' });
        return;
      }
      if (!runtime.endpoint) {
        console.warn('[open-form] No submission endpoint; pass `onSubmit` to <Form>.');
        store.setState({ status: 'success' });
        return;
      }
      const res = await fetch(runtime.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          data: values,
          locale: language.locale,
          token: runtime.token,
          hp: honeypotRef.current?.value ?? '',
          visitor: visitorId(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as SubmitResponse;
      if (res.ok) {
        store.setState({ status: 'success', submissionId: body.id });
        runtime.onSubmitted?.({ id: body.id });
        const redirect = config?.success?.redirect;
        if (redirect && !runtime.preview) {
          (runtime.redirect ?? ((url: string) => window.location.assign(url)))(redirect);
        }
        return;
      }
      if (res.status === 422 && body.errors) {
        const entries = Object.entries(body.errors);
        store.setState({
          status: 'error',
          errors: Object.fromEntries(entries.map(([name, message]) => [name, tr(message)])),
        });
        showError(messages.fixErrors);
        const shown = resolve(values).values;
        let target: { step: number; name: string } | undefined;
        for (const [name] of entries) {
          const step = stepOf(name, shown);
          if (step !== undefined && (!target || step < target.step)) target = { step, name };
        }
        if (target) goTo(target.step, target.name);
        return;
      }
      store.setState({ status: 'error' });
      showError(body.message ? tr(body.message) : messages.genericError);
    } catch {
      store.setState({ status: 'error' });
      showError(messages.networkError);
    }
  }, [
    collected,
    config,
    goTo,
    language.locale,
    messages,
    props,
    resolve,
    runtime,
    showError,
    stepOf,
    store,
    tr,
  ]);

  const next = useCallback(async () => {
    if (busy.current || store.getState().status === 'submitting') return;
    if (inspecting) {
      // Answers were skipped on the way here, so never send them.
      if (isLast) showError(messages.previewNoSubmit);
      else goTo(visible[position + 1] ?? current);
      return;
    }
    busy.current = true;
    const before = store.getState().status;
    try {
      // Disable the button while the last step's (possibly async) checks run.
      if (isLast) store.setState({ status: 'submitting' });
      if (!(await validateMounted())) {
        if (isLast) store.setState({ status: before });
        return;
      }
      if (!isLast) {
        goTo(visible[position + 1] ?? current);
        return;
      }
      await submit();
    } finally {
      busy.current = false;
    }
  }, [
    current,
    goTo,
    inspecting,
    isLast,
    messages,
    position,
    showError,
    store,
    submit,
    validateMounted,
    visible,
  ]);

  const back = useCallback(() => {
    const previous = visible[position - 1];
    if (previous !== undefined) goTo(previous);
  }, [goTo, position, visible]);

  const jump = useCallback(
    async (target: number) => {
      const index = visible[target];
      if (inspecting && index !== undefined) return goTo(index);
      if (index === undefined || target === position || target > furthest || busy.current) return;
      if (target < position) return goTo(index);
      busy.current = true;
      try {
        if (!(await validateMounted())) return;
        const invalid = await validateSkipped(visible.slice(position + 1, target));
        if (invalid) goTo(invalid.step, invalid.name);
        else goTo(index);
      } finally {
        busy.current = false;
      }
    },
    [furthest, goTo, inspecting, position, validateMounted, validateSkipped, visible],
  );

  // Studio preview: jump straight to any step (conditional ones included) or screen.
  const previewControl = runtime.previewControl;
  useEffect(
    () =>
      previewControl?.subscribe((command) => {
        setInspecting(true);
        if (command.type === 'notice') {
          setPreviewNotice(command);
          store.setState({ status: 'idle', errors: {}, formError: undefined });
          return;
        }
        setPreviewNotice(null);
        if (command.type === 'done') {
          store.setState({ status: 'success', errors: {}, formError: undefined });
          return;
        }
        setQuiet(Boolean(command.quiet));
        if (command.labels) setLabels(command.labels);
        store.setState({ status: 'idle', errors: {}, formError: undefined });
        goTo(Math.max(0, Math.min(command.step, stepCount - 1)));
      }),
    [previewControl, goTo, stepCount, store],
  );

  const nav = useMemo<FormNav>(
    () => ({
      step: current,
      position,
      total: visible.length,
      stepTitle: stepTitle === undefined ? undefined : tr(stepTitle),
      steps: visible.map((index, i) => ({
        index,
        position: i,
        title: tr(steps[index]?.title ?? format(messages.stepLabel, { n: i + 1 })),
        state: i < position ? 'done' : i === position ? 'current' : 'upcoming',
        reachable: inspecting || i <= furthest,
      })),
      isFirst: position === 0,
      isLast,
      status,
      submitting: status === 'submitting',
      error: formError,
      inspecting,
      next,
      back,
      goTo: jump,
    }),
    [
      back,
      current,
      formError,
      furthest,
      inspecting,
      isLast,
      jump,
      messages,
      next,
      position,
      status,
      stepTitle,
      steps,
      tr,
      visible,
    ],
  );

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void next();
  };

  // Project theme ids always match; anything else (a crafted preview URL) would
  // otherwise be spliced into the CSS selector below.
  // A form's own theme is scoped to the form, so `theme copy` rewrites its CSS to the form id.
  const theme = props.theme ?? runtime.theme;
  const scope = props.theme ? runtime.formId : runtime.themeId;
  const themeId = scope && THEME_ID_RE.test(scope) ? scope : 'default';
  const themeCss = useMemo(
    () => themeToCss(theme, `.of-root[data-of-theme="${themeId}"]`),
    [theme, themeId],
  );
  const scheme = theme?.colorScheme ?? (theme?.dark === false ? 'light' : undefined);
  const availability = runtime.availability;
  const unavailable = availability && availability.state !== 'open' ? availability : undefined;
  // Closed, full or already answered: the draft can never be sent.
  const ended = unavailable && unavailable.state !== 'not-open' ? unavailable.state : null;
  useEffect(() => {
    if (ended && formId && !runtime.preview) clearDraft(formId);
  }, [ended, formId, runtime.preview]);
  const { Layout, LanguageSwitch, Header, Progress, Nav, Success, Notice } = useFormComponents();
  const noticeMessage = (shown: Unavailable) =>
    'message' in shown && shown.message
      ? tr(shown.message)
      : unavailableMessage(shown, config, messages, tr);
  // Studio's preview fills the form in even when it's closed, and can show any closed screen.
  const notice = previewNotice ?? (runtime.preview ? undefined : unavailable);

  const header = <Header title={title} description={description} />;
  let state: LayoutUIProps['state'] = 'form';
  let content: ReactNode;

  if (notice) {
    state = 'unavailable';
    content = (
      <Notice
        state={notice.state}
        eyebrow={title}
        title={unavailableTitle(notice.state, messages)}
        message={noticeMessage(notice)}
      />
    );
  } else if (status === 'success') {
    state = 'success';
    const success = parts.success;
    const successTitle = success?.props.title ?? config?.success?.title;
    const successMessage = config?.success?.message;
    const children = success?.props.children;
    content = (
      <Success title={successTitle ? tr(successTitle) : messages.successTitle}>
        {typeof children === 'string'
          ? tr(children)
          : (children ?? (
              <p className="of-description">
                {successMessage ? tr(successMessage) : messages.successMessage}
              </p>
            ))}
      </Success>
    );
  } else {
    const pageWhen = steps[current]?.when ?? NO_CONDITIONS;
    const hiddenPage =
      inspecting &&
      pageWhen.length > 0 &&
      !evaluateAll(pageWhen, resolve(store.getState().values).values);
    content = (
      <div
        className="of-step"
        ref={stepRef}
        tabIndex={-1}
        key={current}
        data-of-loc={locOf(steps[current]?.element)}
      >
        {hiddenPage && (
          <p className="of-inspect-note">
            {format(messages.shownWhen, {
              condition: explainCondition(pageWhen, names, messages.locale),
            })}
          </p>
        )}
        <StepScope page={current} when={pageWhen}>
          {steps[current]?.element}
        </StepScope>
      </div>
    );
  }

  const inForm = state === 'form';
  const layout = (
    <Layout
      state={state}
      nav={nav}
      banner={
        inForm && restored && current === restoredAt.current ? (
          <p className="of-banner of-banner-draft" role="status">
            <span>{messages.draftRestored}</span>
            <button type="button" className="of-banner-action" onClick={startOver}>
              {messages.draftDiscard}
            </button>
          </p>
        ) : inForm && inspecting && !quiet ? (
          <p className="of-banner of-banner-inspect" role="status">
            {messages.previewInspect}
          </p>
        ) : inForm && unavailable ? (
          <p className="of-banner" role="status">
            {unavailableTitle(unavailable.state, messages)} · {noticeMessage(unavailable)}
          </p>
        ) : null
      }
      header={header}
      title={title}
      description={description}
      progress={
        inForm ? (
          <Progress
            nav={nav}
            label={format(messages.stepOf, { current: position + 1, total: visible.length })}
          />
        ) : null
      }
      intro={
        inForm && multiStep && parts.loose.length > 0 ? (
          <ScopeContext.Provider value={ROOT_SCOPE}>
            <div className="of-fields">{parts.loose}</div>
          </ScopeContext.Provider>
        ) : null
      }
      content={content}
      alert={
        inForm ? (
          <div className="of-alert" role="alert" aria-live="assertive">
            {formError && <span key={alertCount}>{formError}</span>}
          </div>
        ) : null
      }
      actions={
        inForm ? (
          <Nav
            nav={nav}
            submitLabel={
              typeof parts.submit?.props.children === 'string'
                ? tr(parts.submit.props.children)
                : (parts.submit?.props.children ?? messages.submit)
            }
            labels={{ back: messages.back, next: messages.next, submitting: messages.submitting }}
          />
        ) : null
      }
      aside={inForm ? (props.aside ?? null) : null}
    />
  );

  return (
    <NavContext.Provider value={nav}>
      <InspectContext.Provider value={inspectState}>
        <div
          className={['of-root', props.className].filter(Boolean).join(' ')}
          data-of-loc={(props as { 'data-of-loc'?: string })['data-of-loc']}
          lang={language.locale}
          data-of-theme={themeId}
          data-layout={theme?.layout ?? 'card'}
          data-scheme={scheme}
          data-state={state}
          data-aside={inForm && props.aside ? '' : undefined}
          ref={rootRef}
        >
          {themeCss && <style>{themeCss}</style>}
          {language.available.length > 1 && config?.languageSwitch !== false && (
            <LanguageSwitch
              value={language.locale}
              label={messages.language}
              onChange={language.setLocale}
              options={language.available.map((value) => ({ value, label: LOCALE_NAMES[value] }))}
            />
          )}
          {inForm ? (
            <form className="of-frame" noValidate onSubmit={onSubmit} aria-busy={nav.submitting}>
              {layout}
              {(config?.protection?.honeypot ?? true) && (
                <div className="of-hp" aria-hidden="true">
                  <label>
                    Leave this field empty
                    <input
                      ref={honeypotRef}
                      type="text"
                      name="_of_hp"
                      tabIndex={-1}
                      autoComplete="off"
                    />
                  </label>
                </div>
              )}
            </form>
          ) : (
            layout
          )}
        </div>
      </InspectContext.Provider>
    </NavContext.Provider>
  );
}

/** Dev only: the source location the dev server stamped on a `<Page>`. */
function locOf(element: ReactNode): string | undefined {
  if (!isValidElement(element)) return undefined;
  const loc = (element.props as { 'data-of-loc'?: unknown })['data-of-loc'];
  return typeof loc === 'string' ? loc : undefined;
}

function StepScope({
  page,
  when,
  children,
}: {
  page: number;
  when: StepEntry['when'];
  children: ReactNode;
}) {
  const scope = useMemo(() => ({ page, when }), [page, when]);
  return <ScopeContext.Provider value={scope}>{children}</ScopeContext.Provider>;
}

function unavailableTitle(state: string, messages: Messages): string {
  if (state === 'not-found') return messages.notFoundTitle;
  return messages.closedTitle;
}

type Unavailable = Exclude<NonNullable<FormRuntime['availability']>, { state: 'open' }>;

function unavailableMessage(
  availability: Unavailable,
  config: FormRuntime['config'],
  messages: Messages,
  tr: (text: string) => string,
): string {
  const own = (text: string | undefined, fallback: string) => (text ? tr(text) : fallback);
  switch (availability.state) {
    case 'full':
      return own(config?.submissions?.fullMessage, messages.fullMessage);
    case 'duplicate':
      return own(config?.submissions?.duplicateMessage, messages.duplicateMessage);
    case 'not-open':
      return format(messages.notOpenMessage, {
        date: availability.opensAt ? formatDateTime(availability.opensAt, messages.locale) : '',
      });
    default:
      return own(config?.submissions?.closedMessage, messages.closedMessage);
  }
}
