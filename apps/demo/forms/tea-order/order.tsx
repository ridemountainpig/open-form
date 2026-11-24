import { useFormValues } from '@open-form-build/core';
import { ICE, PICKUP, pick, SIZES, SWEETNESS, TEAS, TOPPINGS, type Topping } from './menu.ts';

export function useOrder() {
  const values = useFormValues();
  const tea = pick(TEAS, values.tea);
  const size = pick(SIZES, values.size);
  const sweetness = tea === 'sugar' ? undefined : pick(SWEETNESS, values.sweetness);
  const ice = pick(ICE, values.ice);
  const ticked = Array.isArray(values.toppings) ? values.toppings : [];
  const toppings = (Object.keys(TOPPINGS) as Topping[]).filter((t) => ticked.includes(t));
  const raw = Number(values.cups);
  const cups = Number.isInteger(raw) && raw >= 1 && raw <= 10 ? raw : 1;
  const each =
    (tea ? TEAS[tea].price : 0) +
    (size ? SIZES[size].price : 0) +
    toppings.reduce((sum, t) => sum + TOPPINGS[t].price, 0);
  return {
    tea,
    size,
    sweetness,
    ice,
    toppings,
    cups,
    each,
    total: each * cups,
    name: String(values.name ?? '').trim(),
    pickup: pick(PICKUP, values.pickup),
    note: String(values.note ?? '').trim(),
  };
}

export type Order = ReturnType<typeof useOrder>;

export function describe(order: Order) {
  return [
    order.size && SIZES[order.size].name,
    order.tea === 'sugar' ? '固定甜度' : order.sweetness && SWEETNESS[order.sweetness].name,
    order.ice && ICE[order.ice].name,
    ...order.toppings.map((t) => `加${TOPPINGS[t].name}`),
  ].filter(Boolean) as string[];
}

export function Receipt() {
  const order = useOrder();
  return (
    <div className="tea-receipt">
      <p className="tea-receipt-no">
        <span>取餐號碼</span>
        <b>A{String(17 + order.cups * 3).padStart(3, '0')}</b>
      </p>
      <div className="tea-receipt-line">
        <span>
          {order.tea ? TEAS[order.tea].name : '飲料'}
          <small>{describe(order).join(' · ')}</small>
        </span>
        <span>
          {order.cups > 1 ? `× ${order.cups}` : ''}
          <b>NT$ {order.total}</b>
        </span>
      </div>
      <p className="of-description">
        {order.pickup ? `${PICKUP[order.pickup]}到櫃台取餐` : '做好了會在櫃台叫號'}
        {order.name ? `，報「${order.name}」或號碼都可以。` : '。'}
        到店再付款，可以刷卡或用行動支付。
      </p>
    </div>
  );
}
