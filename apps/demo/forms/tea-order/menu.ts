// The menu, shared by the form, the cup on the counter and the receipt.
// `tint` is the drink's colour in the cup and how cloudy it is (milk is
// dense, a clear green tea lets the toppings show through).

export const TEAS = {
  black: { name: '紅茶拿鐵', price: 55, tint: [0.74, 0.53, 0.35, 3.4] },
  oolong: { name: '炭焙烏龍奶茶', price: 60, tint: [0.6, 0.39, 0.23, 3.6] },
  jasmine: { name: '茉莉綠茶', price: 40, tint: [0.9, 0.8, 0.36, 0.75] },
  matcha: { name: '宇治抹茶拿鐵', price: 70, tint: [0.55, 0.68, 0.33, 3.2] },
  sugar: { name: '黑糖鮮奶', price: 70, tint: [0.98, 0.94, 0.86, 3.8] },
} as const;

export const SIZES = {
  m: { name: '中杯', price: 0 },
  l: { name: '大杯', price: 10 },
} as const;

export const SWEETNESS = {
  '0': { name: '無糖', level: 0 },
  '30': { name: '微糖', level: 0.3 },
  '50': { name: '半糖', level: 0.5 },
  '70': { name: '少糖', level: 0.7 },
  '100': { name: '全糖', level: 1 },
} as const;

export const ICE = {
  regular: { name: '正常冰', cubes: 5 },
  less: { name: '少冰', cubes: 3 },
  light: { name: '微冰', cubes: 1.5 },
  none: { name: '去冰', cubes: 0 },
  hot: { name: '熱飲', cubes: 0 },
} as const;

export const TOPPINGS = {
  pearls: { name: '珍珠', price: 10 },
  jelly: { name: '椰果', price: 10 },
  pudding: { name: '布丁', price: 15 },
} as const;

export const PICKUP = {
  asap: '盡快（約 15 分鐘）',
  in30: '30 分鐘後',
  in60: '1 小時後',
} as const;

export type Tea = keyof typeof TEAS;
export type Topping = keyof typeof TOPPINGS;

export function pick<T extends object>(table: T, value: unknown): keyof T | undefined {
  return typeof value === 'string' && value in table ? (value as keyof T) : undefined;
}

export function options<T extends Record<string, { name: string }>>(table: T) {
  return Object.entries(table).map(([value, item]) => ({ value, label: item.name }));
}
