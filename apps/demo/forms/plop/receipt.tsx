import { useFormValues } from '@open-form-build/core';

const FINISH_NAMES: Record<string, string> = {
  silver: '鏡面銀',
  rose: '玫瑰金',
  champagne: '香檳金',
  black: '黑鉻',
};
const SIZES: Record<string, { name: string; price: number }> = {
  palm: { name: '掌心款', price: 1280 },
  desk: { name: '桌上款', price: 2680 },
};

const money = (n: number) => `NT$${n.toLocaleString('en-US')}`;

export function useOrder() {
  const values = useFormValues();
  const finish = String(values.finish ?? 'silver');
  const size = SIZES[String(values.size ?? '')];
  const raw = Number(values.quantity);
  const quantity = Number.isInteger(raw) && raw >= 1 && raw <= 3 ? raw : 1;
  const extras = Array.isArray(values.extras) ? values.extras : [];
  const each = (size?.price ?? 0) + (extras.includes('case') ? 390 : 0);
  const total = size ? each * quantity + (extras.includes('keychain') ? 290 : 0) : undefined;
  return {
    finish,
    finishName: FINISH_NAMES[finish] ?? FINISH_NAMES.silver,
    sizeName: size?.name,
    quantity,
    total,
    engraving: String(values.engraving ?? '').trim(),
    email: String(values.email ?? ''),
  };
}

export function Total() {
  const order = useOrder();
  return (
    <p className="pl-total" aria-live="polite">
      <span>
        {order.finishName}
        {order.sizeName ? ` · ${order.sizeName} × ${order.quantity}` : ''}
      </span>
      {order.total === undefined ? <span>選個尺寸看價格</span> : <b>{money(order.total)}</b>}
    </p>
  );
}

export function Receipt() {
  const order = useOrder();
  return (
    <div className="pl-receipt">
      <p className="of-description">
        {`${order.quantity} 隻${order.finishName}${order.sizeName ?? ''}的 Plop 已經替你留好`}
        {order.engraving ? `，底座會刻上「${order.engraving}」` : ''}。
        {order.email ? `付款連結 24 小時內寄到 ${order.email}，` : '付款連結 24 小時內寄出，'}
        2027 年 3 月出貨。
      </p>
      {order.total !== undefined && (
        <p className="pl-receipt-total">
          <span>合計</span>
          <b>{money(order.total)}</b>
        </p>
      )}
    </div>
  );
}
