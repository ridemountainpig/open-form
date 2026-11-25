// The notes, and the colour of ink each one is in the tank. Top notes are
// light and stay near the surface; base notes are heavy and sink.

export const TOP = {
  bergamot: { name: 'Bergamot', ink: [0.78, 0.82, 0.18] },
  pinkPepper: { name: 'Pink pepper', ink: [0.93, 0.32, 0.5] },
  yuzu: { name: 'Yuzu', ink: [0.98, 0.72, 0.05] },
  neroli: { name: 'Neroli', ink: [0.97, 0.5, 0.22] },
} as const;

export const HEART = {
  rose: { name: 'Damask rose', ink: [0.82, 0.08, 0.32] },
  jasmine: { name: 'Jasmine', ink: [0.93, 0.68, 0.22] },
  iris: { name: 'Iris', ink: [0.56, 0.46, 0.86] },
  fig: { name: 'Fig leaf', ink: [0.2, 0.6, 0.36] },
} as const;

export const BASE = {
  sandalwood: { name: 'Sandalwood', ink: [0.66, 0.36, 0.16] },
  vetiver: { name: 'Vetiver', ink: [0.16, 0.42, 0.34] },
  amber: { name: 'Amber', ink: [0.9, 0.44, 0.06] },
  oud: { name: 'Oud', ink: [0.3, 0.1, 0.24] },
} as const;

export const CONCENTRATION = {
  edt: { name: 'Eau de toilette', detail: '8–12% · light, about 4 hours', strength: 0.65 },
  edp: { name: 'Eau de parfum', detail: '15–20% · lasts the day', strength: 1 },
  extrait: { name: 'Extrait', detail: '25–30% · close and long', strength: 1.45 },
} as const;

export const SIZES = {
  '30': { name: '30 ml', price: 95 },
  '50': { name: '50 ml', price: 140 },
  '100': { name: '100 ml', price: 220 },
} as const;

export const LAYERS = [
  { key: 'top', table: TOP, x: -0.42, depth: 0.55 },
  { key: 'heart', table: HEART, x: 0.02, depth: 1.05 },
  { key: 'base', table: BASE, x: 0.44, depth: 1.7 },
] as const;

export function pick<T extends object>(table: T, value: unknown): keyof T | undefined {
  return typeof value === 'string' && value in table ? (value as keyof T) : undefined;
}

export function options<T extends Record<string, { name: string }>>(table: T) {
  return Object.entries(table).map(([value, item]) => ({ value, label: item.name }));
}
