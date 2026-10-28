type MenuItem = { name: string; temps: string[] };

const slug = (name: string) => name.replace(/\s+/g, '-');

export const menu: { key: string; items: MenuItem[] }[] = [
  {
    key: 'coffee',
    items: [
      'spanish latte',
      'caramel latte',
      'hazelnut latte',
      'mocha latte',
      'double chocolate latte',
      'vanilla latte',
      'caramel macchiato',
    ].map((name) => ({ name, temps: ['hot', 'iced'] })),
  },
  {
    key: 'hot chocolate',
    items: [
      'classic hot chocolate',
      'hazelnut hot chocolate',
      'marshmallow chocolate',
      'belgian drinking chocolate',
    ].map((name) => ({ name, temps: ['hot'] })),
  },
];

export const drinkValue = (item: MenuItem, temp: string) => `${slug(item.name)}-${temp}`;

export const drinks = menu.flatMap((group) =>
  group.items.flatMap((item) =>
    item.temps.map((temp) => ({
      value: drinkValue(item, temp),
      label: `${item.name} · ${temp}`,
      name: item.name,
      temp,
    })),
  ),
);

export const food = [
  'club sandwich',
  'grilled cheese sandwich',
  'jalapeno sandwich',
  'loaded fries',
  'plain fries',
].map((label) => ({ value: slug(label), label }));

export const sizes = ['S', 'M', 'L'].map((label) => ({ value: label, label }));

export const sugarLevels = [0, 30, 50, 70, 100].map((n) => ({ value: String(n), label: `${n}%` }));
