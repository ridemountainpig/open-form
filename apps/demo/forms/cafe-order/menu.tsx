import { FieldShell, useField, useTranslate } from '@open-form-build/core';
import { drinks, drinkValue, menu } from './options.ts';

const options = drinks.map(({ value, label }) => ({ value, label }));

// The printed menu itself: each drink's ["hot", "iced"] array is the radio group.
export function MenuField({
  name,
  label,
  description,
  required,
}: {
  name: string;
  label: string;
  description?: string;
  required?: boolean;
}) {
  const field = useField({ name, label, description, required, type: 'radio', options });
  const tr = useTranslate();
  const { 'aria-invalid': invalid, 'aria-describedby': describedBy } = field.controlProps;

  return (
    <FieldShell field={field} as="fieldset">
      <div className="co-obj">
        {menu.map((group, g) => (
          <div key={group.key} className="co-group">
            <div className="co-line">
              <span className="co-k">"{group.key}"</span>
              <span className="co-p">{': {'}</span>
            </div>
            <div className="co-indent">
              {group.items.map((item, i) => {
                const picked = item.temps.some((t) => field.value === drinkValue(item, t));
                const ids = item.temps.map((t) => `${field.id}-${drinkValue(item, t)}`);
                const many = item.temps.length > 1;
                return (
                  <div
                    key={item.name}
                    className="co-line co-item"
                    data-picked={picked || undefined}
                  >
                    <label className="co-name" htmlFor={ids[0]}>
                      "{item.name}"
                    </label>
                    <span className="co-p">{many ? ': [' : ': '}</span>
                    {item.temps.map((temp, t) => {
                      const value = drinkValue(item, temp);
                      return (
                        <span key={temp} className="co-pick-wrap">
                          <label className="co-pick">
                            <input
                              ref={g === 0 && i === 0 && t === 0 ? field.ref : undefined}
                              id={ids[t]}
                              className="co-input"
                              type="radio"
                              name={field.name}
                              value={value}
                              checked={field.value === value}
                              aria-label={tr(`${item.name} · ${temp}`)}
                              aria-invalid={invalid}
                              aria-describedby={describedBy}
                              onBlur={field.onBlur}
                              onChange={() => field.setValue(value)}
                            />
                            <span className="co-str">"{temp}"</span>
                          </label>
                          {t < item.temps.length - 1 && <span className="co-p">, </span>}
                        </span>
                      );
                    })}
                    <span className="co-p">
                      {many ? ']' : ''}
                      {i < group.items.length - 1 ? ',' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="co-line">
              <span className="co-p">{g < menu.length - 1 ? '},' : '}'}</span>
            </div>
          </div>
        ))}
      </div>
    </FieldShell>
  );
}
