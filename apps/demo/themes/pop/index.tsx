import {
  type ChoiceGroupUIProps,
  defineTheme,
  type LayoutUIProps,
  ScreenHeadingContext,
} from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './fonts/syne.css';
import './pop.css';

// Pop: bottle green, cream and tomato. Chunky Syne headings, numbered questions,
// initialed pills, and a green panel that holds the form's `aside` and the
// button. See THEME.md.

function ChoiceGroup({
  field,
  options,
  multiple,
  selected,
  onToggle,
  variant,
}: ChoiceGroupUIProps) {
  const kind = variant === 'cards' ? 'card' : 'pill';
  return (
    <div className={`sc-${kind}s`}>
      {options.map((option, index) => (
        <label key={option.value} className={`sc-${kind}`}>
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
          {kind === 'pill' && <i aria-hidden="true">{option.label.slice(0, 2).toUpperCase()}</i>}
          {kind === 'card' ? <b>{option.label}</b> : option.label}
        </label>
      ))}
    </div>
  );
}

function Layout({ state, banner, header, intro, content, alert, actions, aside }: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="sc-page" data-state={state}>
      <section
        className={
          state === 'success' ? 'sc-main of-success' : inForm ? 'sc-main' : 'sc-main of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        <p className="sc-logo" aria-hidden="true">
          <i className="sc-pole" />
          Good Studio
        </p>
        {banner}
        {inForm && header}
        {intro}
        {content}
        {alert}
        {!inForm && actions}
      </section>
      {inForm && (
        <aside className="sc-side">
          <ScreenHeadingContext.Provider value="h2">{aside}</ScreenHeadingContext.Provider>
          {actions}
        </aside>
      )}
    </div>
  );
}

const DISPLAY =
  '"Syne", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif';

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: DISPLAY,
  radius: '14px',
  buttonRadius: '999px',
  spacing: 'comfortable',
  width: '860px',
  colors: {
    primary: '#12382b',
    primaryForeground: '#fff7ea',
    background: '#f5eee0',
    surface: '#fffaf0',
    foreground: '#12382b',
    muted: '#4d6a5e',
    border: '#b9c4b4',
    control: '#6f8a7d',
    input: '#fffaf0',
    error: '#b82a12',
    success: '#12382b',
  },
  dark: {
    primary: '#fff7ea',
    primaryForeground: '#12382b',
    background: '#0c2019',
    surface: '#122a21',
    foreground: '#fff7ea',
    muted: '#a9b8ae',
    border: '#35493f',
    control: '#7b9185',
    input: '#122a21',
    error: '#ff9a85',
    success: '#fff7ea',
  },
  components: { Layout, ChoiceGroup },
});
