import {
  Children,
  Fragment,
  isValidElement,
  type JSXElementConstructor,
  type ReactElement,
  type ReactNode,
} from 'react';
import type { Condition } from '../schema/index.ts';

// String keys (not symbols or identity checks) so markers survive when the
// runtime is loaded twice, e.g. from source in dev and from dist in a build.
export const KIND = '$$openFormKind';

export type Kind = 'page' | 'when' | 'submit' | 'success';

type Marked = JSXElementConstructor<never> & { [KIND]?: Kind };

export function markKind<T>(component: T, kind: Kind): T {
  (component as Marked)[KIND] = kind;
  return component;
}

export function kindOf(node: ReactNode): Kind | undefined {
  if (!isValidElement(node) || typeof node.type === 'string') return undefined;
  return (node.type as Marked)[KIND];
}

export type StepEntry = {
  element: ReactElement<{ title?: string; children?: ReactNode }>;
  when: Condition[];
  title?: string;
};

export type FormParts = {
  steps: StepEntry[];
  /** Top-level content that isn't a page: rendered above the step on every step. */
  loose: ReactNode[];
  submit?: ReactElement<{ children?: ReactNode }>;
  success?: ReactElement<{ title?: string; children?: ReactNode }>;
};

function flatten(children: ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement<{ children?: ReactNode }>(child) && child.type === Fragment) {
      out.push(...flatten(child.props.children));
    } else if (child !== null && child !== undefined && typeof child !== 'boolean') {
      out.push(child);
    }
  });
  return out;
}

function containsPage(children: ReactNode): boolean {
  return flatten(children).some((child) => {
    const kind = kindOf(child);
    if (kind === 'page') return true;
    if (kind === 'when')
      return containsPage((child as ReactElement<{ children?: ReactNode }>).props.children);
    return false;
  });
}

export type ConditionFromProps = (props: Record<string, unknown>) => Condition;

export function partitionForm(children: ReactNode, toCondition: ConditionFromProps): FormParts {
  const parts: FormParts = { steps: [], loose: [] };

  const walk = (nodes: ReactNode, when: Condition[], topLevel: boolean) => {
    for (const child of flatten(nodes)) {
      const kind = kindOf(child);
      const element = child as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
      if (kind === 'page') {
        parts.steps.push({
          element: element as StepEntry['element'],
          when,
          title: typeof element.props.title === 'string' ? element.props.title : undefined,
        });
      } else if (kind === 'when' && containsPage(element.props.children)) {
        walk(element.props.children, [...when, toCondition(element.props)], false);
      } else if (kind === 'submit' && topLevel) {
        parts.submit = element;
      } else if (kind === 'success' && topLevel) {
        parts.success = element as FormParts['success'];
      } else if (topLevel) {
        parts.loose.push(child);
      }
    }
  };

  walk(children, [], true);
  parts.submit ??= findDeep(children, 'submit') as FormParts['submit'];
  parts.success ??= findDeep(children, 'success') as FormParts['success'];
  return parts;
}

// Agents sometimes put <Submit> inside the last <Page>; find it anywhere in
// the element tree (without rendering components).
function findDeep(nodes: ReactNode, kind: Kind): ReactElement | undefined {
  for (const child of flatten(nodes)) {
    if (kindOf(child) === kind) return child as ReactElement;
    if (isValidElement<{ children?: ReactNode }>(child)) {
      const found = findDeep(child.props.children, kind);
      if (found) return found;
    }
  }
  return undefined;
}
