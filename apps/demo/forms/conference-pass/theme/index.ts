import { defineTheme } from '@open-form-build/core';

// A dark-only brand: `colorScheme: 'dark'` ignores the respondent's system setting.
export default defineTheme({
  colorScheme: 'dark',
  headingFont: 'ui-monospace, "SF Mono", "JetBrains Mono", Menlo, monospace',
  radius: '12px',
  width: '560px',
  colors: {
    primary: '#c8ff3d',
    primaryForeground: '#0a0b06',
    background: '#06060a',
    surface: '#0e0e15',
    foreground: '#f3f3f7',
    muted: '#8c8ca3',
    border: '#25253a',
    input: '#0a0a12',
    error: '#ff6b7a',
    success: '#c8ff3d',
  },
});
