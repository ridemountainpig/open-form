import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
  useFieldValue,
} from '@open-form-build/core';
import type { CSSProperties } from 'react';
import { Total } from '../receipt.tsx';
import './fonts/fredoka.css';
import { FINISHES, isFinish, Mascot } from './mascot.tsx';
import './plop.css';

// Plop: a liquid-metal figure on a studio stage beside the order form. The
// stage is a WebGPU canvas (mascot.tsx); the finish question is a row of metal
// swatches, and picking one re-tints Plop and makes it wobble.

const rgb = (tint: readonly number[]) =>
  `rgb(${tint.map((c) => Math.round(Math.min(1, c) * 255)).join(' ')})`;

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const { field, options, selected, onToggle } = props;
  if (field.name !== 'finish') return <defaultComponents.ChoiceGroup {...props} />;
  return (
    <div className="pl-swatches">
      {options.map((option, index) => {
        const tint = isFinish(option.value) ? FINISHES[option.value].tint : FINISHES.silver.tint;
        return (
          <label
            key={option.value}
            className="pl-swatch"
            style={{ '--pl-metal': rgb(tint) } as CSSProperties}
          >
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={option.value}
              checked={selected.includes(option.value)}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            <span className="pl-orb" aria-hidden="true" />
            <span className="pl-swatch-name">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Layout({
  state,
  banner,
  header,
  title,
  progress,
  intro,
  content,
  alert,
  actions,
}: LayoutUIProps) {
  const value = useFieldValue('finish');
  const finish = isFinish(value) ? value : 'silver';
  return (
    <div className="pl-page" data-state={state}>
      <section className="pl-stage">
        <p className="pl-mark" aria-hidden="true">
          plop
        </p>
        <Mascot finish={finish} cheer={state === 'success'} />
        {state === 'form' && <Total />}
      </section>
      <section
        className={
          state === 'success'
            ? 'pl-sheet of-success'
            : state === 'form'
              ? 'pl-sheet'
              : 'pl-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' ? header : <p className="pl-name">{title}</p>}
        {progress}
        {intro}
        {content}
        {alert}
        {actions}
      </section>
    </div>
  );
}

export default defineTheme({
  font: 'ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont:
    '"Fredoka", ui-rounded, ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '14px',
  buttonRadius: '999px',
  width: '520px',
  colors: {
    primary: '#b8336a',
    primaryForeground: '#ffffff',
    background: '#eceef2',
    surface: '#ffffff',
    foreground: '#17181c',
    muted: '#5b5f69',
    border: '#dcdfe5',
    control: '#868b96',
    input: '#ffffff',
    error: '#b42318',
    success: '#1f7a4d',
  },
  dark: {
    primary: '#ff8fb8',
    primaryForeground: '#1d0a12',
    background: '#0b0c0f',
    surface: '#14161b',
    foreground: '#f1f2f5',
    muted: '#a3a7b1',
    border: '#2a2d35',
    control: '#6f7480',
    input: '#191b21',
    error: '#ff8a7a',
    success: '#6fd39c',
  },
  components: { Layout, ChoiceGroup },
});
