import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  type LayoutUIProps,
} from '@open-form-build/core';
import { pick, TEAS } from '../menu.ts';
import { describe, useOrder } from '../order.tsx';
import { Scene } from './scene.tsx';
import './tea.css';

// A tea-shop order beside the counter (scene.tsx): the cup on it is the drink
// being ordered, and it changes with every answer. The tea question is a menu
// with a swatch of each drink's colour.

const swatch = (tint: readonly number[]) =>
  `rgb(${tint
    .slice(0, 3)
    .map((c) => Math.round(c * 255))
    .join(' ')})`;

function ChoiceGroup(props: ChoiceGroupUIProps) {
  const { field, options, selected, onToggle } = props;
  if (field.name !== 'tea') return <defaultComponents.ChoiceGroup {...props} />;
  return (
    <div className="tea-menu">
      {options.map((option, index) => {
        const tea = pick(TEAS, option.value);
        return (
          <label key={option.value} className="tea-item">
            <input
              ref={index === 0 ? field.ref : undefined}
              type="radio"
              name={field.name}
              value={option.value}
              checked={selected.includes(option.value)}
              aria-invalid={field.controlProps['aria-invalid']}
              aria-describedby={field.controlProps['aria-describedby']}
              onBlur={field.onBlur}
              onChange={(e) => onToggle(option.value, e.target.checked)}
            />
            <span
              className="tea-swatch"
              aria-hidden="true"
              style={tea ? { background: swatch(TEAS[tea].tint) } : undefined}
            />
            <span className="tea-item-name">{option.label}</span>
            {tea && <span className="tea-item-price">{TEAS[tea].price}</span>}
          </label>
        );
      })}
    </div>
  );
}

function Caption({ done }: { done: boolean }) {
  const order = useOrder();
  const parts = describe(order);
  return (
    <div className="tea-caption" aria-live="polite">
      <p className="tea-eyebrow">
        {done
          ? '訂單已送出'
          : order.tea
            ? `NT$ ${order.each}${order.cups > 1 ? ` × ${order.cups} 杯` : ''}`
            : '今天喝什麼'}
      </p>
      <p className="tea-word">{order.tea ? TEAS[order.tea].name : '選一個茶底'}</p>
      <p className="tea-detail">
        {parts.length ? parts.join(' · ') : '杯子裡會照你點的樣子做出來。'}
      </p>
    </div>
  );
}

function Layout({
  state,
  banner,
  header,
  title,
  progress,
  intro,
  content,
  alert,
  actions,
}: LayoutUIProps) {
  const order = useOrder();
  const done = state === 'success';
  return (
    <div className="tea-page" data-state={state}>
      <section className="tea-counter">
        <p className="tea-mark" aria-hidden="true">
          拾杯 <span>SHIBEI TEA</span>
        </p>
        <Scene order={order} done={done} />
        {state === 'form' || done ? <Caption done={done} /> : null}
      </section>
      <section
        className={
          done ? 'tea-sheet of-success' : state === 'form' ? 'tea-sheet' : 'tea-sheet of-notice'
        }
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {state === 'form' ? header : <p className="tea-name">{title}</p>}
        {progress}
        {intro}
        {content}
        {alert}
        {actions}
      </section>
    </div>
  );
}

export default defineTheme({
  font: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif',
  radius: '12px',
  buttonRadius: '999px',
  width: '500px',
  colors: {
    primary: '#6b3417',
    primaryForeground: '#fff8ef',
    background: '#f3ebdd',
    surface: '#fffaf2',
    foreground: '#2a1c13',
    muted: '#6f5d4f',
    border: '#e6dac8',
    control: '#9a8573',
    input: '#ffffff',
    error: '#b42318',
    success: '#2f7a4a',
  },
  dark: {
    primary: '#efc29b',
    primaryForeground: '#2a160a',
    background: '#17110d',
    surface: '#1f1813',
    foreground: '#f6ece1',
    muted: '#bba897',
    border: '#3a2e25',
    control: '#8a7766',
    input: '#271f19',
    error: '#ff8a7a',
    success: '#7bd39a',
  },
  components: { Layout, ChoiceGroup },
});
