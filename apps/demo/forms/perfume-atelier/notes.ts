// The notes, and the colour of ink each one is in the tank. Top notes are
// light and stay near the surface; base notes are heavy and sink.

export const TOP = {
  bergamot: { name: 'Bergamot', ink: [0.78, 0.86, 0.46] },
  pinkPepper: { name: 'Pink pepper', ink: [0.97, 0.56, 0.62] },
  yuzu: { name: 'Yuzu', ink: [1.0, 0.83, 0.38] },
  neroli: { name: 'Neroli', ink: [1.0, 0.67, 0.48] },
} as const;

export const HEART = {
  rose: { name: 'Damask rose', ink: [0.88, 0.38, 0.54] },
  jasmine: { name: 'Jasmine', ink: [0.97, 0.8, 0.52] },
  iris: { name: 'Iris', ink: [0.68, 0.62, 0.92] },
  fig: { name: 'Fig leaf', ink: [0.52, 0.74, 0.58] },
} as const;

export const BASE = {
  sandalwood: { name: 'Sandalwood', ink: [0.84, 0.6, 0.44] },
  vetiver: { name: 'Vetiver', ink: [0.32, 0.6, 0.56] },
  amber: { name: 'Amber', ink: [0.95, 0.62, 0.26] },
  oud: { name: 'Oud', ink: [0.56, 0.27, 0.45] },
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
