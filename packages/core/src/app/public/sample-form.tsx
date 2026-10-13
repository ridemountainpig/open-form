import {
  Checkbox,
  CheckboxGroup,
  DateInput,
  Email,
  Form,
  NumberInput,
  Page,
  RadioGroup,
  Rating,
  Row,
  Select,
  Submit,
  Success,
  Text,
  Textarea,
} from '../../react/index.ts';
import type { FormConfig } from '../../schema/index.ts';

/** Shown in Studio's language, so a theme is judged with the scripts you'll use. */
export const SAMPLE_CONFIG: FormConfig = {
  locale: 'en',
  languageSwitch: false,
  translations: {
    'zh-TW': {
      'Spring design workshop': '春季設計工作坊',
      'Two days of hands-on sessions in Taipei. Signing up takes about two minutes.':
        '在台北的兩天實作課程。報名大約只要兩分鐘。',
      'About you': '關於你',
      'First name': '名字',
      Ada: '小明',
      'Last name': '姓氏',
      Lovelace: '王',
      Email: '電子郵件',
      "We'll send your ticket here.": '票券會寄到這裡。',
      Role: '職務',
      Designer: '設計師',
      Engineer: '工程師',
      'Product manager': '產品經理',
      Student: '學生',
      'Team size': '團隊規模',
      'Just me': '只有我',
      'Your workshop': '你的工作坊',
      Sessions: '想參加的場次',
      'Type & layout': '字體與排版',
      'Design tokens': '設計 token',
      'Prototyping with agents': '用 agent 做原型',
      'How comfortable are you with design systems?': '你對設計系統有多熟悉？',
      'Just starting': '剛入門',
      Very: '非常熟',
      Seats: '人數',
      seats: '位',
      'Arrival date': '抵達日期',
      'Anything we should know?': '還有什麼想讓我們知道的嗎？',
      'Dietary needs, access, questions…': '飲食、無障礙需求或任何問題…',
      'I agree to the code of conduct': '我同意活動行為準則',
      'You can cancel up to a week before.': '活動前一週都可以取消。',
      Register: '報名',
      "You're registered": '報名完成',
      "We've emailed your ticket. See you in spring!": '票券已寄到你的信箱，春天見！',
    },
    'zh-CN': {
      'Spring design workshop': '春季设计工作坊',
      'Two days of hands-on sessions in Taipei. Signing up takes about two minutes.':
        '在台北的两天实操课程。报名大约只需两分钟。',
      'About you': '关于你',
      'First name': '名字',
      Ada: '小明',
      'Last name': '姓氏',
      Lovelace: '王',
      Email: '邮箱',
      "We'll send your ticket here.": '门票会发送到这里。',
      Role: '职位',
      Designer: '设计师',
      Engineer: '工程师',
      'Product manager': '产品经理',
      Student: '学生',
      'Team size': '团队规模',
      'Just me': '只有我',
      'Your workshop': '你的工作坊',
      Sessions: '想参加的场次',
      'Type & layout': '字体与排版',
      'Design tokens': '设计 token',
      'Prototyping with agents': '用 agent 做原型',
      'How comfortable are you with design systems?': '你对设计系统有多熟悉？',
      'Just starting': '刚入门',
      Very: '非常熟',
      Seats: '人数',
      seats: '位',
      'Arrival date': '到达日期',
      'Anything we should know?': '还有什么想让我们知道的吗？',
      'Dietary needs, access, questions…': '饮食、无障碍需求或任何问题…',
      'I agree to the code of conduct': '我同意活动行为准则',
      'You can cancel up to a week before.': '活动前一周都可以取消。',
      Register: '报名',
      "You're registered": '报名完成',
      "We've emailed your ticket. See you in spring!": '门票已发送到你的邮箱，春天见！',
    },
    ja: {
      'Spring design workshop': '春のデザインワークショップ',
      'Two days of hands-on sessions in Taipei. Signing up takes about two minutes.':
        '台北で2日間のハンズオン。登録は2分ほどで終わります。',
      'About you': 'あなたについて',
      'First name': '名',
      Ada: '花子',
      'Last name': '姓',
      Lovelace: '山田',
      Email: 'メールアドレス',
      "We'll send your ticket here.": 'チケットをこちらにお送りします。',
      Role: '職種',
      Designer: 'デザイナー',
      Engineer: 'エンジニア',
      'Product manager': 'プロダクトマネージャー',
      Student: '学生',
      'Team size': 'チームの人数',
      'Just me': '自分だけ',
      'Your workshop': 'ワークショップ',
      Sessions: '参加したいセッション',
      'Type & layout': '文字組みとレイアウト',
      'Design tokens': 'デザイントークン',
      'Prototyping with agents': 'エージェントでプロトタイピング',
      'How comfortable are you with design systems?':
        'デザインシステムにはどのくらい慣れていますか？',
      'Just starting': 'これから',
      Very: 'とても',
      Seats: '人数',
      seats: '名',
      'Arrival date': '到着日',
      'Anything we should know?': 'ほかに伝えておきたいことは？',
      'Dietary needs, access, questions…': '食事の制限、アクセシビリティ、ご質問など…',
      'I agree to the code of conduct': '行動規範に同意します',
      'You can cancel up to a week before.': '1週間前までキャンセルできます。',
      Register: '登録する',
      "You're registered": '登録が完了しました',
      "We've emailed your ticket. See you in spring!":
        'チケットをメールでお送りしました。春にお会いしましょう！',
    },
  },
};

/** Every built-in component in a realistic form, for previewing themes. Submitting goes nowhere. */
export function SampleForm() {
  return (
    <Form
      title="Spring design workshop"
      description="Two days of hands-on sessions in Taipei. Signing up takes about two minutes."
      onSubmit={async () => {}}
    >
      <Page title="About you">
        <Row>
          <Text name="firstName" label="First name" required placeholder="Ada" />
          <Text name="lastName" label="Last name" required placeholder="Lovelace" />
        </Row>
        <Email name="email" label="Email" required description="We'll send your ticket here." />
        <Select
          name="role"
          label="Role"
          options={['Designer', 'Engineer', 'Product manager', 'Student']}
        />
        <RadioGroup
          name="size"
          label="Team size"
          variant="cards"
          options={['Just me', '2–10', '11–50', '50+']}
          defaultValue="2–10"
        />
      </Page>
      <Page title="Your workshop">
        <CheckboxGroup
          name="sessions"
          label="Sessions"
          options={['Type & layout', 'Design tokens', 'Prototyping with agents']}
          defaultValue={['Design tokens']}
        />
        <Rating
          name="comfort"
          label="How comfortable are you with design systems?"
          lowLabel="Just starting"
          highLabel="Very"
          defaultValue={4}
        />
        <Row>
          <NumberInput name="seats" label="Seats" min={1} integer unit="seats" defaultValue={2} />
          <DateInput name="arrival" label="Arrival date" />
        </Row>
        <Textarea
          name="notes"
          label="Anything we should know?"
          placeholder="Dietary needs, access, questions…"
          maxLength={280}
          rows={3}
        />
        <Checkbox name="terms" required description="You can cancel up to a week before.">
          I agree to the code of conduct
        </Checkbox>
      </Page>
      <Submit>Register</Submit>
      <Success title="You're registered">We've emailed your ticket. See you in spring!</Success>
    </Form>
  );
}
