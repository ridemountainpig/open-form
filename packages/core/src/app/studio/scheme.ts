import { useSyncExternalStore } from 'react';

export type SchemePreference = 'system' | 'light' | 'dark';

// A module-level store so the footer menu and the command palette share one value.

const KEY = 'open-form:studio-scheme';
const listeners = new Set<() => void>();
const media = () => window.matchMedia('(prefers-color-scheme: dark)');

function read(): SchemePreference {
  try {
    const value = localStorage.getItem(KEY);
    if (value === 'light' || value === 'dark') return value;
  } catch {}
  return 'system';
}

let current: SchemePreference = read();

function apply(): void {
  const dark = current === 'dark' || (current === 'system' && media().matches);
  const root = document.documentElement;
  root.dataset.studioScheme = dark ? 'dark' : 'light';
  root.style.colorScheme = dark ? 'dark' : 'light';
}

export function setStudioScheme(next: SchemePreference): void {
  try {
    if (next === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {}
  current = next;
  apply();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Follow the OS while on "system".
  const mq = media();
  const onChange = () => current === 'system' && apply();
  mq.addEventListener('change', onChange);
  return () => {
    listeners.delete(listener);
    mq.removeEventListener('change', onChange);
  };
}

/** Studio's light / dark / system choice, remembered per browser. */
export function useStudioScheme(): SchemePreference {
  return useSyncExternalStore(subscribe, () => current);
}
