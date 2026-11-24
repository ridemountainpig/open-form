import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
  useTranslate,
} from '@open-form-build/core';
import './fonts/big-shoulders-display.css';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './moonlap.css';

// Moonlap: a night race in warm black and amber. The form is a column on the
// left with its steps as laps; the stage on the right holds a moon, track lanes
// and the bib being built. Always dark: it is a night run.

const DISTANCES: Record<string, { unit: string; note: string; price: string }> = {
  '5': { unit: 'K', note: 'One lap of the river loop. Walkers welcome.', price: 'NT$ 600' },
  '10': { unit: 'K', note: 'Two laps, three bridges, one very loud finish.', price: 'NT$ 900' },
  '21': { unit: '.1 K', note: 'The half. Train for it.', price: 'NT$ 1,400' },
};

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const tr = useTranslate();
  const { field, options, multiple, selected, onToggle, variant } = props;
  const cards = variant === 'cards' && options.every((option) => DISTANCES[option.value]);
  const swatches = field.name === 'bibColor';
  if (!cards && !swatches) return <defaultComponents.ChoiceGroup {...props} />;
  return (
    <div className={cards ? 'ml-distances' : 'ml-colors'}>
      {options.map((option, index) => {
        const distance = DISTANCES[option.value];
        return (
          <label
            key={option.value}
            className={cards ? 'ml-distance' : 'ml-color'}
            data-color={swatches ? option.value : undefined}
          >
            <input
              ref={index === 0 ? field.ref : undefined}
              type={multiple ? 'checkbox' : 'radio'}
              name={field.name}
              value={option.value}
              checked={selected.includes(option.value)}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              aria-label={swatches ? option.label : undefined}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            {cards && distance && (
              <>
                <b>
                  {option.value}
                  <small>{distance.unit}</small>
                </b>
                <span>{tr(distance.note)}</span>
                <em>{distance.price}</em>
              </>
            )}
          </label>
        );
      })}
    </div>
  );
}

function Layout({
  state,
  nav,
  banner,
  header,
  intro,
  content,
  alert,
  actions,
  aside,
}: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="ml-page" data-state={state}>
      <section
        className={
          state === 'success' ? 'ml-form of-success' : inForm ? 'ml-form' : 'ml-form of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        <p className="ml-logo" aria-hidden="true">
          <i />
          Moonlap
        </p>
        {inForm && nav.total > 1 && (
          <ol className="ml-laps">
            {nav.steps.map((step) => (
              <li
                key={step.index}
                data-state={step.state}
                aria-current={step.state === 'current' ? 'step' : undefined}
              >
                <b>{String(step.position + 1).padStart(2, '0')}</b>
                <span>{step.title}</span>
              </li>
            ))}
          </ol>
        )}
        {banner}
        {inForm && header}
        {intro}
        {content}
        {alert}
        {actions}
      </section>
      <aside className="ml-stage">
        <div className="ml-moon" aria-hidden="true" />
        <div className="ml-lanes" aria-hidden="true" />
        {aside}
      </aside>
    </div>
  );
}

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont:
    '"Big Shoulders Display", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '12px',
  buttonRadius: '999px',
  spacing: 'comfortable',
  width: '560px',
  colorScheme: 'dark',
  colors: {
    primary: '#ffe07a',
    primaryForeground: '#1d1611',
    background: '#0e0b09',
    surface: '#1a1410',
    foreground: '#f3f1e8',
    muted: '#a89a88',
    border: '#352a20',
    control: '#85766a',
    input: '#1a1410',
    error: '#ff9a85',
    success: '#74efc4',
  },
  components: { Layout, ChoiceGroup },
});
