import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
  useFormValues,
  useTranslate,
} from '@open-form-build/core';
import { TILES } from './art.tsx';
import './fonts/fraunces.css';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './mesa.css';

// Mesa: a dinner menu. Steps are courses across the top, each page opens with a
// large serif question, and `variant="cards"` choices become arched tiles when
// art.tsx has a drawing for every option.

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const tr = useTranslate();
  const { field, options, multiple, selected, onToggle, variant } = props;
  if (variant !== 'cards' || !options.every((option) => TILES[option.value])) {
    return <defaultComponents.ChoiceGroup {...props} />;
  }
  return (
    <div className="ms-tiles">
      {options.map((option, index) => {
        const tile = TILES[option.value];
        return (
          <label key={option.value} className="ms-tile">
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
            {tile?.art}
            <b>{option.label}</b>
            <small>{tile ? tr(tile.note) : null}</small>
          </label>
        );
      })}
    </div>
  );
}

function Summary() {
  const { guests, date, time } = useFormValues();
  const parts: string[] = [];
  if (typeof guests === 'number') parts.push(`Table for ${guests}`);
  if (typeof date === 'string' && date) {
    const day = new Date(`${date}T12:00`);
    if (!Number.isNaN(day.getTime())) {
      parts.push(day.toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' }));
    }
  }
  if (typeof time === 'string' && time) parts.push(time);
  return (
    <p className="ms-eyebrow">{parts.length > 1 ? parts.join(' · ') : 'Mesa · Calle Olmo 14'}</p>
  );
}

function Layout({ state, nav, banner, header, intro, content, alert, actions }: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="ms-page" data-state={state}>
      <div className="ms-top">
        <span className="ms-logo" aria-hidden="true">
          Mesa
        </span>
        {inForm && nav.total > 1 && (
          <ol className="ms-courses">
            {nav.steps.map((step) => (
              <li
                key={step.index}
                data-state={step.state}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                {['Starter', 'Main', 'Dessert'][step.position] ?? step.position + 1}
              </li>
            ))}
          </ol>
        )}
      </div>
      <div
        className={
          state === 'success' ? 'ms-main of-success' : inForm ? 'ms-main' : 'ms-main of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {banner}
        {inForm && header}
        {inForm && <Summary />}
        {intro}
        {content}
        {alert}
        {actions}
      </div>
    </div>
  );
}

const SERIF = '"Fraunces", ui-serif, Georgia, var(--of-cjk-serif), serif';

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: SERIF,
  radius: '10px',
  buttonRadius: '999px',
  spacing: 'spacious',
  width: '1000px',
  colors: {
    primary: '#8a5a0c',
    primaryForeground: '#fbf5e8',
    background: '#f3ead8',
    surface: '#fbf5e8',
    foreground: '#2a2414',
    muted: '#6f6548',
    border: '#d2c6a8',
    control: '#8f8364',
    input: '#fbf5e8',
    error: '#a5362e',
    success: '#5d6b1f',
  },
  dark: {
    primary: '#e0b060',
    primaryForeground: '#1c1a12',
    background: '#1c1a12',
    surface: '#252214',
    foreground: '#f4ead6',
    muted: '#a79c80',
    border: '#4a4330',
    control: '#8a7f62',
    input: '#252214',
    error: '#f08a80',
    success: '#b9c76a',
  },
  components: { Layout, ChoiceGroup },
});
