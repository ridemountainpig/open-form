import { createContext, useContext } from 'react';
import type { FormStatus } from './store.ts';

export type NavStep = {
  /** Index into all `<Page>`s, hidden conditional ones included. */
  index: number;
  /** 0-based position among the steps the respondent will see. */
  position: number;
  title: string;
  state: 'done' | 'current' | 'upcoming';
  /** Already visited, so `goTo(position)` may jump here. */
  reachable: boolean;
};

export type FormNav = {
  /** Index into all `<Page>`s. */
  step: number;
  /** 0-based position among visible steps. */
  position: number;
  total: number;
  stepTitle?: string;
  steps: NavStep[];
  isFirst: boolean;
  isLast: boolean;
  status: FormStatus;
  submitting: boolean;
  /** Form-level error (network, server), if any. */
  error?: string;
  /** Studio preview jumped between steps: navigation is free and nothing is submitted. */
  inspecting: boolean;
  /** Validate this step, then advance — or submit on the last step. Same as the primary button. */
  next(): Promise<void>;
  back(): void;
  /** Jump to a visited step; moving forward validates the current step and the ones it skips. */
  goTo(position: number): Promise<void>;
};

const STATIC_NAV: FormNav = {
  step: 0,
  position: 0,
  total: 1,
  steps: [],
  isFirst: true,
  isLast: true,
  status: 'idle',
  submitting: false,
  inspecting: false,
  next: async () => {},
  back: () => {},
  goTo: async () => {},
};

export const NavContext = createContext<FormNav>(STATIC_NAV);

/** Where the respondent is in the form, and the actions to move. For custom layouts and controls. */
export function useFormNav(): FormNav {
  return useContext(NavContext);
}
