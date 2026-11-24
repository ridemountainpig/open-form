import {
  CheckboxGroup,
  defineForm,
  Form,
  NumberInput,
  Page,
  Paragraph,
  RadioGroup,
  Row,
  Submit,
  Success,
  Tel,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import { ICE, options, PICKUP, SIZES, SWEETNESS, TEAS, TOPPINGS } from './menu.ts';
import { Receipt } from './order.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: '拾杯 線上點飲料',
  description: '先點好，到店直接取。永康街 12 號，每天 11:00–21:00。',
  locale: 'zh-TW',
});

export default function TeaOrder() {
  return (
    <Form theme={theme}>
      <Page title="調一杯你的">
        <RadioGroup name="tea" label="茶底" required variant="cards" options={options(TEAS)} />
        <RadioGroup
          name="size"
          label="杯型"
          required
          defaultValue="l"
          options={[
            { value: 'm', label: `${SIZES.m.name} 500ml` },
            { value: 'l', label: `${SIZES.l.name} 700ml（+10）` },
          ]}
        />
        <When field="tea" notEquals="sugar">
          <RadioGroup name="sweetness" label="甜度" required options={options(SWEETNESS)} />
        </When>
        <When field="tea" equals="sugar">
          <Paragraph>黑糖鮮奶的甜來自手炒黑糖，甜度固定，不能調整。</Paragraph>
        </When>
        <RadioGroup name="ice" label="冰塊" required options={options(ICE)} />
        <CheckboxGroup
          name="toppings"
          label="加料"
          description="可以不加，也可以多選。"
          options={Object.entries(TOPPINGS).map(([value, t]) => ({
            value,
            label: `${t.name} +${t.price}`,
          }))}
        />
      </Page>
      <Page title="取餐資訊">
        <NumberInput
          name="cups"
          label="杯數"
          description="同樣的調法，一次最多 10 杯。"
          required
          integer
          min={1}
          max={10}
          defaultValue={1}
          unit="杯"
        />
        <Row>
          <Text name="name" label="取餐稱呼" required autoComplete="given-name" />
          <Tel
            name="mobile"
            label="手機"
            description="做好了會傳簡訊。"
            required
            defaultCountry="TW"
          />
        </Row>
        <RadioGroup
          name="pickup"
          label="什麼時候來拿"
          required
          variant="cards"
          options={Object.entries(PICKUP).map(([value, label]) => ({ value, label }))}
        />
        <Textarea name="note" label="備註" placeholder="例如：吸管不用給" maxLength={60} rows={2} />
      </Page>
      <Submit>送出訂單</Submit>
      <Success title="收到，開始做了">
        <Receipt />
      </Success>
    </Form>
  );
}
