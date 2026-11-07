import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Page,
  RadioGroup,
  Row,
  Select,
  Submit,
  Success,
  Tel,
  Text,
  Textarea,
  Url,
  When,
} from '@open-form-build/core';
import { competencies, DnaChoice, DnaEcho } from './dna.tsx';
import theme from './theme/index.tsx';
import './careers-form.css';

export const config = defineForm({
  title: '加入微程式',
  description: '一起成就更好的事。三個步驟，約 5 分鐘。',
  locale: 'zh-TW',
  drafts: true,
  submissions: {
    closedMessage: '線上應徵暫時關閉，歡迎將履歷寄至 mphrteam@program.com.tw 自我推薦。',
  },
});

const positions = [
  { value: 'software', label: '軟體研發' },
  { value: 'firmware', label: '韌體／嵌入式' },
  { value: 'hardware', label: '硬體研發' },
  { value: 'ai', label: 'AI 應用開發' },
  { value: 'pm', label: '產品／專案管理' },
  { value: 'business', label: '業務／營運' },
];

function Notes() {
  return (
    <div className="mp-notes">
      <h2>應徵須知</h2>
      <p>送出後兩週內完成評估，若合適將主動通知您。</p>
      <p>
        也可以將履歷寄至
        <br />
        <strong>mphrteam@program.com.tw</strong>
      </p>
      <p>
        公司地址
        <br />
        407 台中市西屯區市政路 402 號 7 樓
      </p>
    </div>
  );
}

export default function MicroprogramCareers() {
  return (
    <Form
      theme={theme}
      components={{ ChoiceGroup: DnaChoice }}
      aside={<Notes />}
      className="mpf-root"
    >
      <Page title="基本資料">
        <Text name="name" label="姓名" required autoComplete="name" />
        <Email name="email" label="Email" required />
        <Tel name="phone" label="手機" required defaultCountry="TW" />
      </Page>

      <Page title="應徵職務">
        <RadioGroup
          name="position"
          label="想應徵的職務類別"
          options={positions}
          variant="cards"
          required
        />
        <CheckboxGroup
          name="domains"
          label="最想參與的產品領域"
          description="可複選，沒有特別偏好可以略過。"
          options={['電子支付', '智慧停車', '智慧單車', '半導體感測控制', 'AI 產業應用']}
          variant="cards"
        />
        <RadioGroup
          name="experience"
          label="相關工作經驗"
          options={[
            { value: 'new', label: '應屆畢業／一年以下' },
            { value: '1-3', label: '1–3 年' },
            { value: '3-5', label: '3–5 年' },
            { value: '5+', label: '5 年以上' },
          ]}
          required
        />
        <When field="experience" equals="new">
          <Row>
            <Text name="school" label="畢業學校" required autoComplete="organization" />
            <Text name="major" label="科系" required />
          </Row>
        </When>
        <Select
          name="availability"
          label="最快可到職時間"
          options={['隨時', '兩週內', '一個月內', '兩個月內', '需再討論']}
          required
        />
      </Page>

      <Page title="關於你">
        <RadioGroup
          name="coreStrength"
          label="微程式人的四大核心職能，哪一項最像你？"
          options={competencies}
          required
        />
        <Textarea
          name="story"
          label="說一個你發揮這項能力的例子"
          description="一段經驗就好，工作、學校或社團都可以。"
          rows={5}
          maxLength={500}
          required
        />
        <Url
          name="resumeUrl"
          label="履歷連結"
          description="Google Drive、Dropbox 或 104 履歷的網址，請開放「知道連結的人可檢視」。"
          required
        />
        <When field="position" in={['software', 'firmware', 'hardware', 'ai']}>
          <Url name="portfolioUrl" label="GitHub 或作品集" description="選填。" />
        </When>
        <Checkbox name="consent" required>
          我同意微程式依個人資料保護法，於招募期間蒐集並使用以上資料。
        </Checkbox>
      </Page>

      <Submit>送出應徵</Submit>
      <Success title="已收到你的應徵">
        <DnaEcho />
      </Success>
    </Form>
  );
}
