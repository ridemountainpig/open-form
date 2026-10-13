import { describe, expect, it } from 'vitest';
import { contrast, parseColor, toHex } from './color.ts';
import { contrastReport, effectivePalettes } from './contrast.ts';

const hex = (value: string) => {
  const rgb = parseColor(value);
  return rgb ? toHex(rgb) : null;
};

describe('parseColor', () => {
  it('reads hex, rgb and hsl', () => {
    expect(hex('#4F46E5')).toBe('#4f46e5');
    expect(hex('#fff')).toBe('#ffffff');
    expect(hex('rgb(79, 70, 229)')).toBe('#4f46e5');
    expect(hex('rgb(79 70 229 / 0.5)')).toBe('#4f46e5');
    expect(hex('hsl(0 100% 50%)')).toBe('#ff0000');
  });

  it('converts oklch like Tailwind v4 / shadcn tokens', () => {
    expect(hex('oklch(0.596 0.145 163.225)')).toBe('#009966');
    expect(hex('oklch(59.6% 0.145 163.225)')).toBe('#009966');
    expect(hex('oklch(1 0 0)')).toBe('#ffffff');
  });

  it('returns null for values it cannot resolve', () => {
    expect(parseColor('var(--brand)')).toBeNull();
    expect(parseColor('color-mix(in srgb, red 50%, blue)')).toBeNull();
  });
});

describe('contrast', () => {
  it('matches WCAG reference values', () => {
    const white = parseColor('#fff');
    const black = parseColor('#000');
    if (!white || !black) throw new Error('parse');
    expect(contrast(white, black)).toBeCloseTo(21, 5);
    const emerald = parseColor('#009966');
    if (!emerald) throw new Error('parse');
    expect(contrast(white, emerald)).toBeCloseTo(3.65, 2);
  });
});

describe('theme contrast report', () => {
  it('carries light colors into dark mode when a theme has no dark palette', () => {
    const [, dark] = effectivePalettes({ colors: { surface: '#ffffff' } });
    expect(dark?.colors.surface).toBe('#ffffff');
    expect(dark?.colors.foreground).toBe('#f4f4f5');
    const report = contrastReport({ colors: { surface: '#ffffff' } });
    expect(report.warnings[0]).toMatch(/no `dark`/);
    const darkText = report.palettes[1]?.rows.find((r) => r.label.startsWith('text on surface'));
    expect(darkText?.ok).toBe(false);
  });

  it('flags a brand primary that is too light for white button text', () => {
    const report = contrastReport({ colors: { primary: '#009966' }, dark: false });
    const button = report.palettes[0]?.rows.find((r) => r.label.startsWith('button text'));
    expect(button).toMatchObject({ ok: false, min: 4.5 });
    expect(button?.ratio).toBeCloseTo(3.65, 2);
  });

  it('checks a forced color scheme once', () => {
    expect(effectivePalettes({ colorScheme: 'dark' }).map((p) => p.scheme)).toEqual(['dark']);
  });
});
