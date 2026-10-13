import { loadForm } from 'virtual:open-form/forms';
import { type ComponentType, useEffect, useState } from 'react';
import type { FormConfig } from '../../schema/index.ts';

export type FormModule = {
  default?: ComponentType;
  config?: FormConfig;
};

export type FormModuleState = {
  module?: FormModule;
  error?: Error;
  /** Bumps whenever the form's source changes in dev. */
  revision: number;
};

type FormChanged = { formIds?: string[]; timestamp?: number };

export function onFormChanged(handler: (data: FormChanged) => void): () => void {
  if (!import.meta.hot) return () => {};
  import.meta.hot.on('open-form:form-changed', handler);
  return () => import.meta.hot?.off('open-form:form-changed', handler);
}

export function useFormModule(id: string | undefined): FormModuleState {
  const [state, setState] = useState<FormModuleState>({ revision: 0 });

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    const load = (revision: number) => {
      loadForm(id).then(
        (module) => !cancelled && setState({ module, revision }),
        (error: Error) => !cancelled && setState({ error, revision }),
      );
    };
    load(0);
    const off = onFormChanged((data) => {
      if (data.formIds?.includes(id)) load(data.timestamp ?? Date.now());
    });
    return () => {
      cancelled = true;
      off();
    };
  }, [id]);

  return state;
}

/** Dev only: tells the `current-form` skill what's on screen (see vite/studio-current.ts). */
export function reportCurrent(payload: Record<string, unknown>): void {
  if (!import.meta.hot) return;
  void fetch('/api/studio/current', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(payload),
  }).catch(() => {});
}
