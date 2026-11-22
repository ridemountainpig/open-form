import { useCallback, useEffect, useRef } from 'react';
import type { FormStore } from './store.ts';

const ID_RE = /^[\w-]{16,64}$/;
const keyOf = (formId: string) => `open-form:visit:${formId}`;
// Where sessionStorage is blocked, the visit lasts as long as the page.
const unstored = new Map<string, string>();

/** This tab's visit to the form: the same after a reload, never tied to the device or a response. */
function visitIdFor(formId: string): string {
  try {
    const stored = sessionStorage.getItem(keyOf(formId));
    if (stored && ID_RE.test(stored)) return stored;
    const id = crypto.randomUUID();
    sessionStorage.setItem(keyOf(formId), id);
    return id;
  } catch {
    const id = unstored.get(formId) ?? crypto.randomUUID();
    unstored.set(formId, id);
    return id;
  }
}

function forgetVisit(formId: string): void {
  unstored.delete(formId);
  try {
    sessionStorage.removeItem(keyOf(formId));
  } catch {}
}

function send(endpoint: string, body: Record<string, unknown>): void {
  fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'omit',
    keepalive: true,
    body: JSON.stringify(body),
  }).catch(() => {});
}

/**
 * Tells the server which steps this visit reaches and when the respondent first
 * answers, for Studio's Analytics. Never sends answers. Resolves the visit id
 * the submission carries, or undefined when visits aren't counted.
 */
export function useVisit({
  endpoint,
  formId,
  step,
  done,
  store,
}: {
  endpoint: string | undefined;
  formId: string | undefined;
  step: number;
  done: boolean;
  store: FormStore;
}): () => string | undefined {
  const sent = useRef<{ key: string; step?: number; started: boolean }>({
    key: '',
    started: false,
  });
  // Another form in the same component (FormHost's id or api changed) is another visit.
  const marks = useCallback(() => {
    const key = `${endpoint}\n${formId}`;
    if (sent.current.key !== key) sent.current = { key, started: false };
    return sent.current;
  }, [endpoint, formId]);
  const visit = useCallback(
    () => (endpoint && formId ? visitIdFor(formId) : undefined),
    [endpoint, formId],
  );

  useEffect(() => {
    if (!endpoint || done || marks().step === step) return;
    const id = visit();
    if (!id) return;
    marks().step = step;
    send(endpoint, { visit: id, step });
  }, [done, endpoint, marks, step, visit]);

  useEffect(() => {
    if (!endpoint) return;
    const check = () => {
      if (marks().started || !store.getState().edited || store.getState().status === 'success')
        return;
      const id = visit();
      if (!id) return;
      marks().started = true;
      send(endpoint, { visit: id, started: true });
    };
    check();
    return store.subscribe(check);
  }, [endpoint, marks, store, visit]);

  // Answering again after submitting is another visit.
  useEffect(() => {
    if (!done || !formId) return;
    forgetVisit(formId);
    sent.current = { key: sent.current.key, started: false };
  }, [done, formId]);

  return visit;
}
