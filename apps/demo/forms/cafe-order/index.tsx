import {
  CheckboxGroup,
  defineForm,
  Form,
  RadioGroup,
  Submit,
  Success,
  Text,
} from '@open-form-build/core';
import en from './locales/en.json';
import ja from './locales/ja.json';
import zhCN from './locales/zh-CN.json';
import { MenuField } from './menu.tsx';
import { food, sizes, sugarLevels } from './options.ts';
import { Receipt } from './receipt.tsx';
import theme from './theme/index.tsx';
import './cafe-order.css';

export const config = defineForm({
  title: 'findrink',
  description: '到場前先點好，報上名字直接取。',
  locale: 'zh-TW',
  translations: { en, 'zh-CN': zhCN, ja },
  submissions: {
    closedMessage: '這次的預點已經結束。',
  },
  // Everyone orders from the venue's Wi-Fi, so one IP is many people.
  protection: { rateLimit: { max: 60, window: '10m' } },
});

export default function CafeOrderForm() {
  return (
    <Form theme={theme} className="co-root">
      <div className="co-headers">
        <Text name="name" label="名字" required autoComplete="name" maxLength={40} />
        <p className="co-static" aria-hidden="true">
          Content-Type: application/json
        </p>
      </div>
      <div className="co-body">
        <MenuField name="drink" label="飲料" description='選一杯：點 "hot" 或 "iced"' required />
        <RadioGroup name="size" label="尺寸" options={sizes} required />
        <RadioGroup name="sugar" label="甜度" options={sugarLevels} required />
        <CheckboxGroup name="food" label="加點" description="可複選，不加也行" options={food} />
        <Text name="note" label="備註" description="奶類、過敏或其他需求都可以寫" maxLength={120} />
      </div>
      <Submit>送出訂單</Submit>
      <Success title="點好了">
        <Receipt />
      </Success>
    </Form>
  );
}
