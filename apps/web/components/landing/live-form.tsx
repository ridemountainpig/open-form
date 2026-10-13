'use client';

import {
  type FormAvailability,
  type FormConfig,
  type FormRuntime,
  FormRuntimeContext,
  type FormTheme,
  type NavigationInfo,
} from '@open-form-build/core';
import { useTheme } from 'next-themes';
import { type ComponentType, useEffect, useMemo, useState } from 'react';
import '@open-form-build/core/styles.css';

/** Show a theme in the site's color scheme rather than the OS one (as Studio's preview does). */
function forceScheme(
  theme: FormTheme | undefined,
  scheme: 'light' | 'dark',
): FormTheme | undefined {
  if (theme?.colorScheme) return theme;
  if (scheme === 'light' || theme?.dark === false) return { ...theme, colorScheme: 'light' };
  return { ...theme, colorScheme: 'dark', colors: { ...theme?.colors, ...(theme?.dark || {}) } };
}

export function fakeSubmit(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 650));
}

/**
 * Renders a form with the real Open Form runtime — the same `<Form>`, fields,
 * validation and themes a workspace uses — minus the server: `<Form onSubmit>`
 * stands in for the submission API.
 */
export function LiveForm({
  form: Form,
  config,
  theme,
  themeId,
  availability,
  onNavigate,
  className = '',
}: {
  form: ComponentType;
  config: FormConfig;
  theme?: FormTheme;
  themeId?: string;
  availability?: FormAvailability;
  onNavigate?: (info: NavigationInfo) => void;
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const scheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const runtime = useMemo<FormRuntime>(
    () => ({
      mode: 'interactive',
      config,
      theme: forceScheme(theme, scheme),
      themeId,
      availability,
      onNavigate,
    }),
    [config, theme, themeId, scheme, availability, onNavigate],
  );

  // Client-only: the runtime reads the browser's language and storage, and the
  // site's color scheme is only known after hydration.
  if (!mounted) return <div className={`demo-host ${className}`} aria-busy="true" />;
  return (
    <div className={`demo-host ${className}`}>
      <FormRuntimeContext.Provider value={runtime}>
        <Form />
      </FormRuntimeContext.Provider>
    </div>
  );
}
