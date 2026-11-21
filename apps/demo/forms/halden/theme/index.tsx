import {
  type ChoiceGroupUIProps,
  defineTheme,
  type LayoutUIProps,
  ScreenHeadingContext,
  type TextInputUIProps,
  useTranslate,
} from '@open-form-build/core';
import type { ReactNode } from 'react';
import './fonts/geist-mono.css';
import './fonts/instrument-sans.css';
import './fonts/instrument-serif.css';
import './halden.css';

// Halden: an editorial enquiry sheet for a furniture workshop. A dark brand
// panel holds the headline and a job docket; the questions are numbered rows on
// paper. Card choices are a ruled strip of pieces, list choices timber swatches,
// and a number field is a stepper.

const PIECES: Record<string, { from: string; icon: ReactNode }> = {
  table: {
    from: 'from NT$ 86,000',
    icon: <path d="M4 14h56M8 14v26M56 14v26M14 14v8M50 14v8M8 22h48" />,
  },
  bench: {
    from: 'from NT$ 32,000',
    icon: <path d="M6 22h52M6 26h52M12 26l-3 14M52 26l3 14M6 22v4M58 22v4" />,
  },
  shelving: {
    from: 'from NT$ 48,000',
    icon: (
      <path d="M14 4v36M50 4v36M14 8h36M14 20h36M14 32h36M22 20v-7M26 20v-9M30 20v-6M40 32v-7h6v7" />
    ),
  },
  other: {
    from: 'Let us draw it',
    icon: <path d="M10 36l4-12L42 6l8 8-28 18zM36 10l8 8M10 36l12-4" />,
  },
};

function ChoiceGroup({
  field,
  options,
  multiple,
  selected,
  onToggle,
  variant,
}: ChoiceGroupUIProps) {
  const tr = useTranslate();
  const cards = variant === 'cards';
  return (
    <div className={cards ? 'hd-pieces' : 'hd-swatches'}>
      {options.map((option, index) => {
        const piece = cards ? PIECES[option.value] : undefined;
        return (
          <label key={option.value} className={cards ? 'hd-piece' : 'hd-swatch'}>
            <input
              ref={index === 0 ? field.ref : undefined}
              type={multiple ? 'checkbox' : 'radio'}
              name={field.name}
              value={option.value}
              checked={selected.includes(option.value)}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            {cards ? (
              <>
                <i className="hd-dot" aria-hidden="true" />
                <svg viewBox="0 0 64 44" width="64" height="44" aria-hidden="true">
                  {piece?.icon}
                </svg>
                <b>{option.label}</b>
                {piece && <small>{tr(piece.from)}</small>}
              </>
            ) : (
              <>
                <i className="hd-grain" data-timber={option.value} aria-hidden="true" />
                {option.label}
              </>
            )}
          </label>
        );
      })}
    </div>
  );
}

function TextInput({ field, type, value, onChange, unit, ...attrs }: TextInputUIProps) {
  const input = (
    <input
      {...field.controlProps}
      {...attrs}
      ref={field.ref}
      className={type === 'date' ? 'of-input of-date' : 'of-input'}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
  if (type !== 'number') return input;
  const min = typeof attrs.min === 'number' ? attrs.min : Number.NEGATIVE_INFINITY;
  const max = typeof attrs.max === 'number' ? attrs.max : Number.POSITIVE_INFINITY;
  const bump = (by: number) => {
    const next = Math.min(max, Math.max(min, (Number(value) || 0) + by));
    onChange(String(next));
  };
  return (
    <div className="hd-stepper">
      <button type="button" aria-label="−1" onClick={() => bump(-1)}>
        −
      </button>
      {input}
      <button type="button" aria-label="+1" onClick={() => bump(1)}>
        +
      </button>
      {unit && <span className="hd-unit">{unit}</span>}
    </div>
  );
}

function Layout({ state, banner, header, intro, content, alert, actions, aside }: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="hd-page" data-state={state}>
      <section className="hd-brand">
        <p className="hd-mast">
          <span className="hd-word" aria-hidden="true">
            Halden<i>.</i>
          </span>
          <span>Furniture, made to order · Tainan</span>
        </p>
        {header}
        {aside}
      </section>
      <section
        className={
          state === 'success' ? 'hd-form of-success' : inForm ? 'hd-form' : 'hd-form of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {inForm && (
          <p className="hd-form-head">
            <span>Enquiry form</span>
            <span>About 3 minutes</span>
          </p>
        )}
        {banner}
        {intro}
        <ScreenHeadingContext.Provider value="h2">{content}</ScreenHeadingContext.Provider>
        {alert}
        {actions}
      </section>
    </div>
  );
}

const SERIF = '"Instrument Serif", ui-serif, Georgia, var(--of-cjk-serif), serif';

export default defineTheme({
  font: '"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: SERIF,
  radius: '0px',
  spacing: 'spacious',
  width: '860px',
  colors: {
    primary: '#c63a18',
    primaryForeground: '#fff8f0',
    background: '#f7f3ea',
    surface: '#f7f3ea',
    foreground: '#171512',
    muted: '#6b6256',
    border: '#cfc6b4',
    control: '#857c6c',
    input: '#f7f3ea',
    error: '#a8200d',
    success: '#3f6b3a',
  },
  dark: {
    primary: '#ff6a43',
    primaryForeground: '#1b0d07',
    background: '#12110f',
    surface: '#12110f',
    foreground: '#efe8da',
    muted: '#9a9080',
    border: '#34302a',
    control: '#7d7466',
    input: '#12110f',
    error: '#ff9a85',
    success: '#9cc795',
  },
  components: { Layout, ChoiceGroup, TextInput },
});
