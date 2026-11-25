import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  NumberInput,
  Page,
  RadioGroup,
  Select,
  Submit,
  Success,
  Text,
  When,
} from '@open-form-build/core';
import theme from './theme/index.tsx';
import { Ticket } from './ticket.tsx';

export const config = defineForm({
  title: 'MONO 春季發表會報名',
  description:
    '2027 年 3 月 13 日（六）下午，台北。開放 200 組報名，每組最多 4 人，3 月 12 日截止，報名約 1 分鐘。',
  locale: 'zh-TW',
  timeZone: 'Asia/Taipei',
  submissions: {
    maxResponses: 200,
    uniqueBy: 'email',
    closesAt: '2027-03-12',
    fullMessage: '200 組名額都報滿了。發表會當天會有線上直播，連結會公布在官網。',
    closedMessage: '報名已在 3 月 12 日截止，謝謝你的關注。當天見不到面的話，直播見。',
    duplicateMessage: '這個 Email 已經報名過了。想改場次或人數，回覆確認信就好。',
  },
});

export default function LaunchRsvp() {
  return (
    <Form theme={theme}>
      <Page title="你是誰">
        <Text name="name" label="姓名" required autoComplete="name" />
        <Email name="email" label="Email" description="入場 QR code 會寄到這裡。" required />
        <Text name="company" label="公司或學校" autoComplete="organization" />
        <RadioGroup
          name="role"
          label="你主要做什麼"
          required
          variant="cards"
          options={[
            { value: 'design', label: '設計' },
            { value: 'engineering', label: '工程' },
            { value: 'product', label: '產品' },
            { value: 'student', label: '學生' },
            { value: 'other', label: '其他' },
          ]}
        />
      </Page>
      <Page title="怎麼參加">
        <CheckboxGroup
          name="sessions"
          label="想參加的場次"
          description="可以多選。"
          required
          options={[
            { value: 'keynote', label: '14:00 主題演講' },
            { value: 'workshop', label: '16:00 動手做工作坊' },
            { value: 'party', label: '18:30 交流酒會' },
          ]}
        />
        <When field="sessions" contains="workshop">
          <RadioGroup
            name="laptop"
            label="工作坊會帶自己的筆電嗎？"
            required
            options={[
              { value: 'yes', label: '會帶' },
              { value: 'no', label: '不會，需要借一台' },
            ]}
          />
        </When>
        <When field="sessions" contains="party">
          <Text
            name="diet"
            label="飲食限制"
            description="素食、過敏或不喝酒都可以寫在這裡。"
            maxLength={80}
          />
        </When>
        <NumberInput
          name="guests"
          label="同行人數"
          description="不含你自己，最多 3 位。"
          required
          integer
          min={0}
          max={3}
          defaultValue={0}
          unit="位"
        />
        <Select
          name="source"
          label="從哪裡知道這場發表會"
          options={[
            { value: 'social', label: 'Threads 或 Instagram' },
            { value: 'friend', label: '朋友或同事' },
            { value: 'newsletter', label: '電子報' },
            { value: 'other', label: '其他' },
          ]}
        />
      </Page>
      <Submit>確認報名</Submit>
      <Success title="到時見">
        <Ticket />
      </Success>
    </Form>
  );
}
