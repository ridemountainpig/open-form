import {
  defineTheme,
  SplitLayout,
  type TextareaUIProps,
  type TextInputUIProps,
} from '@open-form-build/core';
import './editorial.css';

// Editorial: a magazine look — serif type, hairline rules, underline inputs, pill choices,
// and a split layout with an ink panel. See THEME.md.
// Labels, help, errors, choices, the checkbox, the rating, the select and the
// matrix are the runtime's own markup, restyled in editorial.css. The components
// below exist for markup it doesn't have: the wrapper the underline draws itself
// in and the counter inside the line.

function TextInput({ field, value, onChange, unit, ...attrs }: TextInputUIProps) {
  return (
    <div className="ed-line">
      <input
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="ed-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span className="ed-unit">{unit}</span>}
    </div>
  );
}

function Textarea({ field, value, onChange, maxLength, ...attrs }: TextareaUIProps) {
  return (
    <div className="ed-line">
      <textarea
        {...field.controlProps}
        {...attrs}
        ref={field.ref}
        className="ed-input ed-textarea"
        maxLength={maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {maxLength !== undefined && (
        <span className="ed-count" aria-hidden="true">
          {[...value].length}/{maxLength}
        </span>
      )}
    </div>
  );
}

export default defineTheme({
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont:
    '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, var(--of-cjk-serif), serif',
  radius: '0px',
  spacing: 'spacious',
  width: '620px',
  colors: {
    primary: '#151412',
    primaryForeground: '#f7f3ec',
    background: '#efe9df',
    surface: '#f7f3ec',
    foreground: '#151412',
    muted: '#6f675d',
    border: '#d6cdbf',
    control: '#857d70',
    input: '#f7f3ec',
    error: '#b42318',
  },
  dark: {
    primary: '#efe9df',
    primaryForeground: '#151412',
    background: '#0f0e0c',
    surface: '#171513',
    foreground: '#efe9df',
    muted: '#a0978a',
    border: '#38332c',
    control: '#6e675e',
    input: '#171513',
    error: '#ff8a7a',
  },
  components: { Layout: SplitLayout, TextInput, Textarea },
});
