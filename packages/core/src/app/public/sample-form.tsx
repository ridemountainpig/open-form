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
      'Your form title': '你的表單標題',
      'A short description sits here, so you can see how this theme sets a line or two of text.':
        '這裡放一段簡短的說明，讓你看看這個主題怎麼排一兩行文字。',
      Basics: '基本欄位',
      'First name': '名字',
      Ada: '小明',
      'Last name': '姓氏',
      Lovelace: '王',
      Email: '電子郵件',
      'Help text sits under a label like this.': '輔助說明會像這樣放在標籤下方。',
      Dropdown: '下拉選單',
      'Option one': '選項一',
      'Option two': '選項二',
      'Option three': '選項三',
      'Option four': '選項四',
      'Single choice': '單選',
      'Choice A': '選項 A',
      'Choice B': '選項 B',
      'Choice C': '選項 C',
      'Choice D': '選項 D',
      'More fields': '更多欄位',
      'Multiple choice': '複選',
      'First option': '第一個選項',
      'Second option': '第二個選項',
      'Third option': '第三個選項',
      Rating: '評分',
      Low: '低',
      High: '高',
      Number: '數字',
      items: '個',
      Date: '日期',
      'Long answer': '長篇回答',
      'Type a longer answer here…': '在這裡輸入比較長的回答…',
      'A single checkbox': '單一核取方塊',
      'A checkbox can carry a note too.': '核取方塊也可以附上一行說明。',
      Submit: '送出',
      'Thank you': '謝謝你',
      'This is the message people see after they submit.': '這是填寫者送出後會看到的訊息。',
    },
    'zh-CN': {
      'Your form title': '你的表单标题',
      'A short description sits here, so you can see how this theme sets a line or two of text.':
        '这里放一段简短的说明，让你看看这个主题怎么排一两行文字。',
      Basics: '基本字段',
      'First name': '名字',
      Ada: '小明',
      'Last name': '姓氏',
      Lovelace: '王',
      Email: '邮箱',
      'Help text sits under a label like this.': '辅助说明会像这样放在标签下方。',
      Dropdown: '下拉菜单',
      'Option one': '选项一',
      'Option two': '选项二',
      'Option three': '选项三',
      'Option four': '选项四',
      'Single choice': '单选',
      'Choice A': '选项 A',
      'Choice B': '选项 B',
      'Choice C': '选项 C',
      'Choice D': '选项 D',
      'More fields': '更多字段',
      'Multiple choice': '多选',
      'First option': '第一个选项',
      'Second option': '第二个选项',
      'Third option': '第三个选项',
      Rating: '评分',
      Low: '低',
      High: '高',
      Number: '数字',
      items: '个',
      Date: '日期',
      'Long answer': '长篇回答',
      'Type a longer answer here…': '在这里输入比较长的回答…',
      'A single checkbox': '单个复选框',
      'A checkbox can carry a note too.': '复选框也可以附上一行说明。',
      Submit: '提交',
      'Thank you': '谢谢你',
      'This is the message people see after they submit.': '这是填写者提交后会看到的消息。',
    },
    ja: {
      'Your form title': 'フォームのタイトル',
      'A short description sits here, so you can see how this theme sets a line or two of text.':
        'ここに短い説明が入ります。このテーマで1〜2行の文章がどう見えるかを確認できます。',
      Basics: '基本の項目',
      'First name': '名',
      Ada: '花子',
      'Last name': '姓',
      Lovelace: '山田',
      Email: 'メールアドレス',
      'Help text sits under a label like this.': '補足の説明はラベルの下にこのように入ります。',
      Dropdown: 'プルダウン',
      'Option one': '選択肢 1',
      'Option two': '選択肢 2',
      'Option three': '選択肢 3',
      'Option four': '選択肢 4',
      'Single choice': '単一選択',
      'Choice A': '選択肢 A',
      'Choice B': '選択肢 B',
      'Choice C': '選択肢 C',
      'Choice D': '選択肢 D',
      'More fields': 'その他の項目',
      'Multiple choice': '複数選択',
      'First option': '1つ目の選択肢',
      'Second option': '2つ目の選択肢',
      'Third option': '3つ目の選択肢',
      Rating: '評価',
      Low: '低い',
      High: '高い',
      Number: '数値',
      items: '個',
      Date: '日付',
      'Long answer': '長文の回答',
      'Type a longer answer here…': 'ここに長めの回答を入力…',
      'A single checkbox': 'チェックボックス',
      'A checkbox can carry a note too.': 'チェックボックスにも説明を添えられます。',
      Submit: '送信',
      'Thank you': 'ありがとうございます',
      'This is the message people see after they submit.':
        '送信後に回答者へ表示されるメッセージです。',
    },
  },
};

/** Every built-in component under neutral labels, for previewing themes. Submitting goes nowhere. */
export function SampleForm() {
  return (
    <Form
      title="Your form title"
      description="A short description sits here, so you can see how this theme sets a line or two of text."
      onSubmit={async () => {}}
    >
      <Page title="Basics">
        <Row>
          <Text name="firstName" label="First name" required placeholder="Ada" />
          <Text name="lastName" label="Last name" required placeholder="Lovelace" />
        </Row>
        <Email
          name="email"
          label="Email"
          required
          description="Help text sits under a label like this."
        />
        <Select
          name="dropdown"
          label="Dropdown"
          options={['Option one', 'Option two', 'Option three', 'Option four']}
        />
        <RadioGroup
          name="single"
          label="Single choice"
          variant="cards"
          options={['Choice A', 'Choice B', 'Choice C', 'Choice D']}
          defaultValue="Choice B"
        />
      </Page>
      <Page title="More fields">
        <CheckboxGroup
          name="multiple"
          label="Multiple choice"
          options={['First option', 'Second option', 'Third option']}
          defaultValue={['Second option']}
        />
        <Rating name="rating" label="Rating" lowLabel="Low" highLabel="High" defaultValue={4} />
        <Row>
          <NumberInput name="number" label="Number" min={1} integer unit="items" defaultValue={2} />
          <DateInput name="date" label="Date" />
        </Row>
        <Textarea
          name="long"
          label="Long answer"
          placeholder="Type a longer answer here…"
          maxLength={280}
          rows={3}
        />
        <Checkbox name="checkbox" required description="A checkbox can carry a note too.">
          A single checkbox
        </Checkbox>
      </Page>
      <Submit>Submit</Submit>
      <Success title="Thank you">This is the message people see after they submit.</Success>
    </Form>
  );
}
