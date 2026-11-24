import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
  ScreenHeadingContext,
  useTranslate,
} from '@open-form-build/core';
import './fonts/geist.css';
import './fonts/geist-mono.css';
import './meridian.css';

// Meridian: enterprise contact sales. The pitch sits on the left and stays put;
// the form is a white card on the right. Single-choice cards read as one
// segmented control, multi-choice cards as a two-column grid with a line of detail.

const NOTES: Record<string, string> = {
  platform: 'Core workspace and API',
  analytics: 'Dashboards and exports',
  sso: 'SAML, SCIM, audit log',
  privateCloud: 'Your region, your keys',
};

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const tr = useTranslate();
  const { field, options, multiple, selected, onToggle, variant } = props;
  if (variant !== 'cards') return <defaultComponents.ChoiceGroup {...props} />;
  return (
    <div className={multiple ? 'md-options' : 'md-segments'}>
      {options.map((option, index) => (
        <label key={option.value} className={multiple ? 'md-option' : 'md-segment'}>
          <input
            ref={index === 0 ? field.ref : undefined}
            type={multiple ? 'checkbox' : 'radio'}
            className={multiple ? 'of-checkbox' : undefined}
            name={field.name}
            value={option.value}
            checked={selected.includes(option.value)}
            aria-invalid={field.controlProps['aria-invalid']}
            aria-describedby={field.controlProps['aria-describedby']}
            onBlur={field.onBlur}
            onChange={(e) => onToggle(option.value, e.target.checked)}
          />
          <span>
            {option.label}
            {multiple && NOTES[option.value] && <small>{tr(NOTES[option.value] as string)}</small>}
          </span>
        </label>
      ))}
    </div>
  );
}

function Layout({ state, banner, header, intro, content, alert, actions, aside }: LayoutUIProps) {
  const inForm = state === 'form';
  return (
    <div className="md-page" data-state={state}>
      <section className="md-info">
        <div className="md-logo" aria-hidden="true">
          <i />
          Meridian
        </div>
        {header}
        {aside && <div className="md-aside">{aside}</div>}
      </section>
      <section
        className={
          state === 'success' ? 'md-card of-success' : inForm ? 'md-card' : 'md-card of-notice'
        }
        role={inForm ? undefined : 'status'}
      >
        {banner}
        {intro}
        <ScreenHeadingContext.Provider value="h2">{content}</ScreenHeadingContext.Provider>
        {alert}
        {actions}
        {inForm && (
          <p className="md-under">
            <span>Protected against spam</span>
            <span>SOC 2 Type II · ISO 27001</span>
          </p>
        )}
      </section>
    </div>
  );
}

export default defineTheme({
  font: '"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '10px',
  spacing: 'comfortable',
  width: '600px',
  colors: {
    primary: '#2c4bff',
    primaryForeground: '#ffffff',
    background: '#f4f3ef',
    surface: '#ffffff',
    foreground: '#16161a',
    muted: '#63626b',
    border: '#e4e2da',
    control: '#8e8c84',
    input: '#ffffff',
    error: '#c62a1b',
    success: '#1f7a4d',
  },
  dark: {
    primary: '#8094ff',
    primaryForeground: '#0b0b0e',
    background: '#0b0b0e',
    surface: '#131317',
    foreground: '#f1f1f3',
    muted: '#9b9aa5',
    border: '#25252c',
    control: '#6b6b78',
    input: '#131317',
    error: '#ff8a7a',
    success: '#6fd3a0',
  },
  components: { Layout, ChoiceGroup },
});
