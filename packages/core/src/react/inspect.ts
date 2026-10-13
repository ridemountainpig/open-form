import { createContext } from 'react';
import type { ConditionNames } from '../schema/index.ts';

export type InspectState = {
  /** Studio preview is jumping between steps: `<When>` shows hidden content, marked. */
  inspecting: boolean;
  /** Field and option labels for describing conditions, sent by Studio. */
  names: ConditionNames;
};

export const InspectContext = createContext<InspectState>({ inspecting: false, names: {} });
