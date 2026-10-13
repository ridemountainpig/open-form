import type { FormValues } from '@open-form-build/core';

export const TIERS = [
  {
    id: 'community',
    name: 'Community',
    price: 0,
    perks: ['Main stage talks', 'Expo hall', 'After-party'],
  },
  {
    id: 'builder',
    name: 'Builder',
    price: 149,
    perks: ['Everything in Community', 'Up to 3 workshops ($49 each)', 'Lunch both days'],
    popular: true,
  },
  {
    id: 'patron',
    name: 'Patron',
    price: 399,
    perks: ['Everything in Builder', 'All workshops included', 'Speaker dinner'],
  },
] as const;

export const WORKSHOPS = [
  { value: 'agents-101', label: 'Agents 101 — ship your first agent' },
  { value: 'evals', label: 'Evals that catch regressions' },
  { value: 'mcp', label: 'Building MCP servers' },
  { value: 'agent-ux', label: 'Designing agent UX' },
];

export const WORKSHOP_PRICE = 49;

const PROMOS: Record<string, { off: number; label: string; studentsOnly?: boolean }> = {
  AGENTS20: { off: 0.2, label: '20% off' },
  STUDENT50: { off: 0.5, label: 'Student · 50% off', studentsOnly: true },
};

const normalize = (code: unknown) =>
  String(code ?? '')
    .trim()
    .toUpperCase();

/** Custom validator: runs in the browser and again on the server. */
export function checkPromo(code: unknown, values: FormValues): string | undefined {
  const promo = PROMOS[normalize(code)];
  if (!promo) return "That code doesn't exist. Try AGENTS20.";
  if (promo.studentsOnly && values.role !== 'student') return 'STUDENT50 is for students only.';
  return undefined;
}

export type Quote = {
  tier: (typeof TIERS)[number] | undefined;
  workshops: number;
  lines: Array<{ label: string; amount: number }>;
  total: number;
};

type Tr = (text: string, vars?: Record<string, string | number>) => string;
const plain: Tr = (text, vars = {}) =>
  text.replace(/\{(\w+)\}/g, (match, key: string) => (key in vars ? String(vars[key]) : match));

/** Display-only price, derived from the answers so far. Pass `useTranslate()` for labels. */
export function quote(values: FormValues, tr: Tr = plain): Quote {
  const tier = TIERS.find((t) => t.id === values.tier);
  const lines: Quote['lines'] = [];
  let workshops = 0;
  if (tier) {
    lines.push({ label: tr('{tier} pass', { tier: tr(tier.name) }), amount: tier.price });
    if (tier.id === 'builder' && Array.isArray(values.workshops)) {
      workshops = values.workshops.length;
      if (workshops) {
        lines.push({
          label: tr('Workshops × {n}', { n: workshops }),
          amount: workshops * WORKSHOP_PRICE,
        });
      }
    }
    if (tier.id === 'patron') workshops = WORKSHOPS.length;
  }
  const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const promo = PROMOS[normalize(values.promoCode)];
  if (tier && tier.price > 0 && promo && !checkPromo(values.promoCode, values)) {
    lines.push({ label: tr(promo.label), amount: -Math.round(subtotal * promo.off) });
  }
  return { tier, workshops, lines, total: lines.reduce((sum, line) => sum + line.amount, 0) };
}

/** A stable, friendly ticket code derived from the email. */
export function ticketCode(email: unknown): string {
  const text = String(email ?? '').toLowerCase();
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  const code = (hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6);
  return text ? `OC26-${code}` : 'OC26-······';
}
