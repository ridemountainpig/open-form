import { type ReactNode, useContext, useMemo } from 'react';
import {
  type Condition,
  evaluateCondition,
  explainCondition,
  type FieldCondition,
  format,
  stableStringify,
} from '../schema/index.ts';
import { ScopeContext, useFormContext, useRuntime } from './context.ts';
import { useTranslate, useTranslatedNode } from './i18n.tsx';
import { InspectContext } from './inspect.ts';
import { markKind } from './steps.ts';
import { useStoreSelector } from './store.ts';

export type PageProps = {
  title?: string;
  description?: string;
  children?: ReactNode;
};

/** One step of a multi-step form. */
export const Page = markKind(function Page({ title, description, children }: PageProps) {
  const tr = useTranslate();
  return (
    <section className="of-page">
      {(title || description) && (
        <header className="of-page-header">
          {title && <h2 className="of-page-title">{tr(title)}</h2>}
          {description && <p className="of-page-description">{tr(description)}</p>}
        </header>
      )}
      <div className="of-fields">{children}</div>
    </section>
  );
}, 'page');

export type WhenProps = Omit<FieldCondition, 'field'> & {
  field?: string;
  all?: Condition[];
  any?: Condition[];
  not?: Condition;
  condition?: Condition;
  children?: ReactNode;
};

const FIELD_OPERATORS = [
  'equals',
  'notEquals',
  'in',
  'notIn',
  'contains',
  'filled',
  'empty',
  'gt',
  'gte',
  'lt',
  'lte',
] as const;

export function conditionFromProps(props: Record<string, unknown>): Condition {
  const p = props as WhenProps;
  const parts: Condition[] = [];
  if (p.field) {
    const cond: FieldCondition = { field: p.field };
    for (const op of FIELD_OPERATORS) {
      if (p[op] !== undefined) (cond as Record<string, unknown>)[op] = p[op];
    }
    parts.push(cond);
  }
  if (p.all) parts.push({ all: p.all });
  if (p.any) parts.push({ any: p.any });
  if (p.not) parts.push({ not: p.not });
  if (p.condition) parts.push(p.condition);
  if (parts.length === 0) {
    throw new Error('<When> needs a `field` (with an operator such as `equals`) or `all` / `any`.');
  }
  return parts.length === 1 ? (parts[0] as Condition) : { all: parts };
}

/** Render children only while the condition holds. Hidden fields are not validated or stored. */
export const When = markKind(function When(props: WhenProps) {
  const runtime = useRuntime();
  const scope = useContext(ScopeContext);
  const { store, messages, visibleValues } = useFormContext('When');
  const { children, ...rest } = props;
  const key = stableStringify(rest);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` captures every prop that shapes the condition
  const condition = useMemo(() => conditionFromProps(rest), [key]);
  const scoped = useMemo(
    () => ({ page: scope.page, when: [...scope.when, condition] }),
    [scope, condition],
  );
  const visible = useStoreSelector(store, (s) =>
    evaluateCondition(condition, visibleValues(s.values)),
  );
  const { inspecting, names } = useContext(InspectContext);

  if (runtime.mode !== 'collect' && !visible) {
    if (!inspecting) return null;
    // Studio preview: show what this branch would add, labelled with its condition.
    return (
      <div className="of-when-reveal">
        <p className="of-inspect-note">
          {format(messages.shownWhen, {
            condition: explainCondition(condition, names, messages.locale),
          })}
        </p>
        <ScopeContext.Provider value={scoped}>{children}</ScopeContext.Provider>
      </div>
    );
  }
  return <ScopeContext.Provider value={scoped}>{children}</ScopeContext.Provider>;
}, 'when');

/** Lay fields side by side; stacks on narrow screens. */
export function Row({ children, ...dev }: { children?: ReactNode } & DevLoc) {
  return (
    <div className="of-row" data-of-loc={dev['data-of-loc']}>
      {children}
    </div>
  );
}

type DevLoc = { 'data-of-loc'?: string };

export function Heading({
  children,
  level = 3,
  ...dev
}: { children?: ReactNode; level?: 2 | 3 | 4 } & DevLoc) {
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4';
  return (
    <Tag className="of-heading" data-of-loc={dev['data-of-loc']}>
      {useTranslatedNode(children)}
    </Tag>
  );
}

export function Paragraph({ children, ...dev }: { children?: ReactNode } & DevLoc) {
  return (
    <p className="of-paragraph" data-of-loc={dev['data-of-loc']}>
      {useTranslatedNode(children)}
    </p>
  );
}

export type SubmitProps = { children?: ReactNode };

/** Sets the final button's label. Back / Next are rendered automatically. */
export const Submit = markKind(function Submit(_props: SubmitProps) {
  return null;
}, 'submit');

export type SuccessProps = { title?: string; children?: ReactNode };

/** Replaces the default thank-you screen. */
export const Success = markKind(function Success(_props: SuccessProps) {
  return null;
}, 'success');
