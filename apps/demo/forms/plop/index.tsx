import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  NumberInput,
  Page,
  RadioGroup,
  Submit,
  Success,
  Tel,
  Text,
  When,
} from '@open-form-build/core';
import { Receipt } from './receipt.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Plop 液態金屬公仔',
  description: '第一批預購，限量 300 隻，2027 年 3 月出貨。兩個步驟，約 1 分鐘。',
  locale: 'zh-TW',
  submissions: {
    maxResponses: 300,
    uniqueBy: 'email',
    fullMessage: '第一批 300 隻都有主人了。第二批開放時，我們會在 Instagram 先說。',
    closedMessage: '第一批預購已經結束，謝謝每一位幫 Plop 找到家的人。',
    duplicateMessage: '這個 Email 已經預購過了。想改內容的話，回覆確認信就好。',
  },
});

export default function PlopPreorder() {
  return (
    <Form theme={theme}>
      <Page title="挑一隻 Plop">
        <RadioGroup
          name="finish"
          label="金屬色"
          description="選了就會看到它換上新顏色。"
          required
          defaultValue="silver"
          options={[
            { value: 'silver', label: '鏡面銀' },
            { value: 'rose', label: '玫瑰金' },
            { value: 'champagne', label: '香檳金' },
            { value: 'black', label: '黑鉻' },
          ]}
        />
        <RadioGroup
          name="size"
          label="尺寸"
          required
          options={[
            { value: 'palm', label: '掌心款 8 cm · NT$1,280' },
            { value: 'desk', label: '桌上款 15 cm · NT$2,680' },
          ]}
        />
        <NumberInput
          name="quantity"
          label="數量"
          description="第一批每人最多 3 隻。"
          required
          integer
          min={1}
          max={3}
          defaultValue={1}
          unit="隻"
        />
        <CheckboxGroup
          name="extras"
          label="加購"
          options={[
            { value: 'case', label: '壓克力展示盒，每隻 +NT$390' },
            { value: 'keychain', label: '迷你 Plop 鑰匙圈 +NT$290' },
          ]}
        />
        <Text
          name="engraving"
          label="底座刻字"
          description="最多 12 個字，例如它的名字。不刻也可以。"
          maxLength={12}
        />
      </Page>
      <Page title="寄到哪裡">
        <Text name="name" label="收件人" required autoComplete="name" />
        <Email name="email" label="Email" description="付款連結和出貨通知會寄到這裡。" required />
        <Tel name="phone" label="手機" required defaultCountry="TW" countries={['TW']} />
        <RadioGroup
          name="delivery"
          label="取貨方式"
          required
          options={[
            { value: 'store', label: '超商取貨' },
            { value: 'home', label: '宅配到府' },
          ]}
        />
        <When field="delivery" equals="store">
          <Text name="store" label="取貨門市" description="門市名稱或店號。" required />
        </When>
        <When field="delivery" equals="home">
          <Text name="address" label="收件地址" required autoComplete="street-address" />
        </When>
      </Page>
      <Submit>預購這隻 Plop</Submit>
      <Success title="Plop 開始液化了">
        <Receipt />
      </Success>
    </Form>
  );
}
