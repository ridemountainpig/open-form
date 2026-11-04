import { useFormValues, useTranslate } from '@open-form-build/core';
import { drinks, food, sizes, sugarLevels } from './options.ts';

const str = (value: string) => JSON.stringify(value);

// The response body: the order echoed back as JSON.
export function Receipt() {
  const values = useFormValues();
  const tr = useTranslate();
  const name = String(values.name ?? '').trim();
  const drink = drinks.find((d) => d.value === values.drink);
  const size = sizes.find((o) => o.value === values.size);
  const sugar = sugarLevels.find((o) => o.value === values.sugar);
  const picked = food.filter((f) => ((values.food as string[]) ?? []).includes(f.value));
  const note = String(values.note ?? '').trim();

  const lines: [string, string][] = [[tr('名字'), str(name)]];
  if (drink) lines.push([tr('飲料'), `[${str(drink.name)}, ${str(drink.temp)}]`]);
  if (size) lines.push([tr('尺寸'), str(size.label)]);
  if (sugar) lines.push([tr('甜度'), str(sugar.label)]);
  if (picked.length) lines.push([tr('加點'), `[${picked.map((f) => str(f.label)).join(', ')}]`]);
  if (note) lines.push([tr('備註'), str(note)]);

  return (
    <div className="co-receipt">
      <pre className="co-json">
        <span className="co-p">{'{'}</span>
        {lines.map(([key, value], i) => (
          <span key={key} className="co-json-line">
            {'\n    '}
            <span className="co-k">{str(key)}</span>
            <span className="co-p">: </span>
            <span className="co-v">{value}</span>
            <span className="co-p">{i < lines.length - 1 ? ',' : ''}</span>
          </span>
        ))}
        {'\n'}
        <span className="co-p">{'}'}</span>
      </pre>
      <p className="co-comment">
        {'// '}
        {tr('到場報上「{name}」就能取餐。', { name })}
      </p>
    </div>
  );
}
