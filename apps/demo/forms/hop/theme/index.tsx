import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
  type RatingUIProps,
  useFieldValue,
} from '@open-form-build/core';
import type { CSSProperties } from 'react';
import { Total } from '../receipt.tsx';
import './fonts/fredoka.css';
import { BREEDS, FINISHES, isBreed, isFinish, Mascot } from './mascot.tsx';
import './hop.css';

// Hop: a liquid-metal rabbit on a studio stage beside the adoption form. The
// stage is a WebGPU canvas (mascot.tsx). Breeds are tiles with the rabbit's
// own render, finishes are metal swatches, and the carrot rating feeds the
// orbit around Hop.

const rgb = (tint: readonly number[]) =>
  `rgb(${tint.map((c) => Math.round(Math.min(1, c) * 255)).join(' ')})`;

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const { field, options, selected, onToggle } = props;
  if (field.name !== 'finish' && field.name !== 'breed') {
    return <defaultComponents.ChoiceGroup {...props} />;
  }
  return (
    <div className={field.name === 'breed' ? 'hp-swatches hp-breeds' : 'hp-swatches'}>
      {options.map((option, index) => {
        const tint = isFinish(option.value) ? FINISHES[option.value].tint : FINISHES.silver.tint;
        return (
          <label
            key={option.value}
            className="hp-swatch"
            style={{ '--hp-metal': rgb(tint) } as CSSProperties}
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
            {isBreed(option.value) ? (
              <img className="hp-thumb" src={BREEDS[option.value]} alt="" />
            ) : (
              <span className="hp-orb" aria-hidden="true" />
            )}
            <span className="hp-swatch-name">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function Carrot() {
  return (
    <svg className="hp-carrot" viewBox="0 0 32 40" aria-hidden="true">
      <path
        className="hp-carrot-leaf"
        d="M16 12c-1-5-4-8-8-9 1 4 3 7 8 9Zm0 0c1-5 4-8 8-9-1 4-3 7-8 9Zm0 0V2"
      />
      <path className="hp-carrot-root" d="M9 13c4-2 10-2 14 0 1 6-3 17-7 25-4-8-8-19-7-25Z" />
      <path className="hp-carrot-line" d="M11 19h3M18 24h3M13 29h3" />
    </svg>
  );
}

function Rating(props: RatingUIProps) {
  const { field, scores, value, onChange, lowLabel, highLabel } = props;
  if (field.name !== 'carrots') return <defaultComponents.Rating {...props} />;
  return (
    <>
      <div className="hp-carrots">
        {scores.map((score, index) => (
          <label
            key={score}
            className="hp-carrot-item"
            data-on={(value ?? 0) >= score || undefined}
          >
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={score}
              checked={value === score}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={() => onChange(score)}
            />
            <Carrot />
            <span className="of-sr-only">{`${score} 根`}</span>
          </label>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="of-rating-labels" aria-hidden="true">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </>
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
  const finishValue = useFieldValue('finish');
  const breedValue = useFieldValue('breed');
  const carrotValue = Number(useFieldValue('carrots'));
  const finish = isFinish(finishValue) ? finishValue : 'silver';
  const breed = isBreed(breedValue) ? breedValue : 'upright';
  const carrots = Number.isInteger(carrotValue) ? Math.max(0, Math.min(5, carrotValue)) : 0;
  return (
    <div className="hp-page" data-state={state}>
      <section className="hp-stage">
        <p className="hp-mark" aria-hidden="true">
          hop
        </p>
        <Mascot breed={breed} finish={finish} carrots={carrots} cheer={state === 'success'} />
        {state === 'form' && <Total />}
      </section>
      <section
        className={
          state === 'success'
            ? 'hp-sheet of-success'
            : state === 'form'
              ? 'hp-sheet'
              : 'hp-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' ? header : <p className="hp-name">{title}</p>}
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
  components: { Layout, ChoiceGroup, Rating },
});
