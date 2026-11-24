import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  NumberInput,
  Page,
  RadioGroup,
  Rating,
  Submit,
  Success,
  Tel,
  Text,
  When,
} from '@open-form-build/core';
import { Receipt } from './receipt.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Hop 液態金屬兔',
  description: '第一批只有 300 隻，2027 年 3 月出貨。三個步驟，大概 1 分鐘。',
  locale: 'zh-TW',
  submissions: {
    maxResponses: 300,
    uniqueBy: 'email',
    fullMessage: '第一批 300 隻兔子都被領養了。第二批開放時，我們會在 Instagram 先說。',
    closedMessage: '第一批領養已經結束，謝謝每一位幫兔子找到家的人。',
    duplicateMessage: '這個 Email 已經領養過一隻了。想改內容的話，回覆確認信就好。',
  },
});

export default function HopAdoption() {
  return (
    <Form theme={theme}>
      <Page title="挑一隻兔子">
        <RadioGroup
          name="breed"
          label="品種"
          description="點一下，旁邊那隻就會換耳朵。"
          required
          defaultValue="upright"
          options={[
            { value: 'upright', label: '立耳兔' },
            { value: 'lop', label: '垂耳兔' },
            { value: 'lionhead', label: '獅子兔' },
            { value: 'dwarf', label: '侏儒兔' },
          ]}
        />
        <RadioGroup
          name="finish"
          label="金屬毛色"
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
            { value: 'palm', label: '掌心兔 8 cm · NT$1,280' },
            { value: 'desk', label: '桌上兔 15 cm · NT$2,680' },
          ]}
        />
      </Page>
      <Page title="跟牠熟一點">
        <Text
          name="bunnyName"
          label="幫牠取名字"
          description="會刻在底座上，最多 8 個字。想不到可以先空著。"
          placeholder="例如：麻糬"
          maxLength={8}
        />
        <Rating
          name="carrots"
          label="一天要餵幾根紅蘿蔔？"
          description="選幾根，牠身邊就繞幾根。"
          required
          defaultValue={2}
          lowLabel="一根就好"
          highLabel="吃到變圓"
        />
        <CheckboxGroup
          name="extras"
          label="加購"
          options={[
            { value: 'carrotBase', label: '紅蘿蔔造型底座，每隻 +NT$290' },
            { value: 'carrotKeychain', label: '迷你金屬紅蘿蔔鑰匙圈 +NT$190' },
          ]}
        />
        <NumberInput
          name="quantity"
          label="要領養幾隻"
          description="第一批每人最多 3 隻，同一個品種和毛色。"
          required
          integer
          min={1}
          max={3}
          defaultValue={1}
          unit="隻"
        />
      </Page>
      <Page title="牠要跳去哪裡">
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
      <Submit>帶牠回家</Submit>
      <Success title="牠正在跳去你家">
        <Receipt />
      </Success>
    </Form>
  );
}
