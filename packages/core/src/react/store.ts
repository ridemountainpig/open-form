import { useCallback, useSyncExternalStore } from 'react';
import { type FieldErrors, type FormValues, ownValue } from '../schema/index.ts';

export type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

export type FormState = {
  values: FormValues;
  errors: FieldErrors;
  touched: Record<string, boolean>;
  /** Index into the full step list (hidden conditional steps included). */
  step: number;
  status: FormStatus;
  formError?: string;
  /** Bumped each time `formError` is set, so the alert announces a repeated message again. */
  alertCount: number;
  submissionId?: string;
};

export type FormStore = {
  getState(): FormState;
  setState(update: Partial<FormState> | ((state: FormState) => Partial<FormState>)): void;
  subscribe(listener: () => void): () => void;
  setValue(name: string, value: unknown): void;
  setError(name: string, error: string | undefined): void;
};

export function createFormStore(initialValues: FormValues = {}): FormStore {
  let state: FormState = {
    values: { ...initialValues },
    errors: {},
    touched: {},
    step: 0,
    status: 'idle',
    alertCount: 0,
  };
  const listeners = new Set<() => void>();

  const setState: FormStore['setState'] = (update) => {
    const patch = typeof update === 'function' ? update(state) : update;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };

  return {
    getState: () => state,
    setState,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setValue(name, value) {
      if (Object.is(ownValue(state.values, name), value)) return;
      setState((s) => ({ values: { ...s.values, [name]: value } }));
    },
    setError(name, error) {
      if (ownValue(state.errors, name) === error) return;
      setState((s) => {
        const errors = { ...s.errors };
        delete errors[name];
        return { errors: error ? { ...errors, [name]: error } : errors };
      });
    },
  };
}

/** Subscribe to a slice of form state. The selector must return a stable value. */
export function useStoreSelector<T>(store: FormStore, selector: (state: FormState) => T): T {
  const getSnapshot = useCallback(() => selector(store.getState()), [store, selector]);
  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
