import { defineTheme } from '@open-form-build/core';

// Classic: the plain look with every token written out. Add it with
// `open-form theme add classic --as brand` to start a brand theme from familiar
// ground. See THEME.md.

export default defineTheme({
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  headingFont: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '10px',
  spacing: 'comfortable',
  width: '640px',
  layout: 'card',
  colors: {
    primary: '#4f46e5',
    primaryForeground: '#ffffff',
    background: '#f4f4f6',
    surface: '#ffffff',
    foreground: '#18181b',
    muted: '#6b6b76',
    border: '#e2e2e7',
    control: '#93939b',
    input: '#ffffff',
    error: '#d92d20',
    success: '#16a34a',
  },
  dark: {
    primary: '#8b8cf8',
    primaryForeground: '#0b0b12',
    background: '#0b0b0e',
    surface: '#141418',
    foreground: '#f4f4f5',
    muted: '#a0a0ab',
    border: '#2a2a31',
    control: '#64646f',
    input: '#0f0f13',
    error: '#f97066',
    success: '#4ade80',
  },
  // Replace any part of the look here, e.g.:
  // components: { Layout: StepperLayout, TextInput: MyInput },
  components: {},
});
