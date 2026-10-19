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
import { type ComponentType, type RefObject, useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * A demo's titles belong to the form, not to this page, so they are kept out
 * of the page's heading outline. Steps and success screens add new ones.
 */
function useOutlineFree(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const host = ref.current;
    if (!active || !host) return;
    const demote = () => {
      for (const heading of host.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
        heading.setAttribute('role', 'presentation');
      }
    };
    demote();
    const observer = new MutationObserver(demote);
    observer.observe(host, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, active]);
}

/**
 * A demo frame scrolls, not the form inside it, so its scrollbar would sit on
 * the page. Mirror the form's colors onto the frame to keep it on the theme.
 */
function useFrameColors(ref: RefObject<HTMLElement | null>, active: boolean) {
  useEffect(() => {
    const host = ref.current;
    const frame = host?.closest<HTMLElement>('.demo-frame');
    if (!active || !host || !frame) return;
    const sync = () => {
      const root = host.querySelector('.of-root');
      if (!root) return;
      const style = getComputedStyle(root);
      frame.style.setProperty('--frame-bg', style.backgroundColor);
      frame.style.setProperty('--frame-fg', style.color);
      frame.style.colorScheme = style.colorScheme;
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(host, {
      childList: true,
      subtree: true,
      attributeFilter: ['data-scheme', 'data-of-theme'],
    });
    return () => observer.disconnect();
  }, [ref, active]);
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
  const hostRef = useRef<HTMLDivElement>(null);
  useOutlineFree(hostRef, mounted);
  useFrameColors(hostRef, mounted);
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
    <div ref={hostRef} className={`demo-host ${className}`}>
      <FormRuntimeContext.Provider value={runtime}>
        <Form />
      </FormRuntimeContext.Provider>
    </div>
  );
}
