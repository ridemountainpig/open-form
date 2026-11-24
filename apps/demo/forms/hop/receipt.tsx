import { useFormValues } from '@open-form-build/core';

const BREED_NAMES: Record<string, string> = {
  upright: '立耳兔',
  lop: '垂耳兔',
  lionhead: '獅子兔',
  dwarf: '侏儒兔',
};
const FINISH_NAMES: Record<string, string> = {
  silver: '鏡面銀',
  rose: '玫瑰金',
  champagne: '香檳金',
  black: '黑鉻',
};
const SIZES: Record<string, { name: string; price: number }> = {
  palm: { name: '掌心兔', price: 1280 },
  desk: { name: '桌上兔', price: 2680 },
};

const money = (n: number) => `NT$${n.toLocaleString('en-US')}`;

export function useOrder() {
  const values = useFormValues();
  const breed = String(values.breed ?? 'upright');
  const finish = String(values.finish ?? 'silver');
  const size = SIZES[String(values.size ?? '')];
  const raw = Number(values.quantity);
  const quantity = Number.isInteger(raw) && raw >= 1 && raw <= 3 ? raw : 1;
  const carrots = Number(values.carrots);
  const extras = Array.isArray(values.extras) ? values.extras : [];
  const each = (size?.price ?? 0) + (extras.includes('carrotBase') ? 290 : 0);
  const total = size ? each * quantity + (extras.includes('carrotKeychain') ? 190 : 0) : undefined;
  return {
    breedName: BREED_NAMES[breed] ?? BREED_NAMES.upright,
    finishName: FINISH_NAMES[finish] ?? FINISH_NAMES.silver,
    sizeName: size?.name,
    quantity,
    carrots: Number.isInteger(carrots) && carrots >= 1 && carrots <= 5 ? carrots : undefined,
    total,
    bunnyName: String(values.bunnyName ?? '').trim(),
    email: String(values.email ?? ''),
  };
}

export function Total() {
  const order = useOrder();
  return (
    <p className="hp-total" aria-live="polite">
      <span>
        {`${order.finishName}${order.breedName}`}
        {order.sizeName ? ` · ${order.sizeName} × ${order.quantity}` : ''}
      </span>
      {order.total === undefined ? <span>選個尺寸看價格</span> : <b>{money(order.total)}</b>}
    </p>
  );
}

export function Receipt() {
  const order = useOrder();
  const who = order.bunnyName ? `「${order.bunnyName}」` : `你的${order.breedName}`;
  return (
    <div className="hp-receipt">
      <p className="of-description">
        {`${who}已經在收行李了：${order.quantity} 隻${order.finishName}${order.sizeName ?? ''}`}
        {order.carrots ? `，每天 ${order.carrots} 根紅蘿蔔我們先幫你備好` : ''}。
        {order.email ? `付款連結 24 小時內寄到 ${order.email}，` : '付款連結 24 小時內寄出，'}
        2027 年 3 月出貨。
      </p>
      {order.total !== undefined && (
        <p className="hp-receipt-total">
          <span>合計</span>
          <b>{money(order.total)}</b>
        </p>
      )}
    </div>
  );
}
