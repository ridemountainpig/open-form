import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Page,
  Paragraph,
  RadioGroup,
  Submit,
  Success,
  T,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import { AvatarPicker, ColorPicker, DepthSlider, TierPicker } from './fields.tsx';
import zhTW from './locales/zh-TW.json';
import { PassNotice } from './notice.tsx';
import { checkPromo, WORKSHOPS } from './pricing.ts';
import theme from './theme/index.ts';
import { Ticket } from './ticket.tsx';
import './pass.css';

export const config = defineForm({
  title: 'OpenConf 2026 — build your pass',
  description: 'Nov 14–15 · Taipei. Two days on agents that actually ship.',
  locale: 'en',
  translations: { 'zh-TW': zhTW },
  submissions: {
    maxResponses: 300,
    uniqueBy: 'email',
    closesAt: '2026-11-13',
    duplicateMessage: 'This email already has a pass — check your inbox.',
    closedMessage: 'Registration for OpenConf 2026 has closed.',
    fullMessage: 'All 300 passes have been claimed.',
    closed: true,
  },
});

export default function ConferencePass() {
  return (
    <Form
      theme={theme}
      aside={<Ticket />}
      className="pass-root"
      components={{ Notice: PassNotice }}
    >
      <Page title="Who's coming?">
        <Text name="name" label="Full name" required autoComplete="name" maxLength={40} />
        <Email name="email" label="Email" required description="Your pass is sent here." />
        <RadioGroup
          name="role"
          label="What do you do?"
          required
          variant="cards"
          options={[
            { value: 'engineer', label: '🛠  Engineer' },
            { value: 'designer', label: '🎨  Designer' },
            { value: 'founder', label: '🚀  Founder' },
            { value: 'student', label: '🎓  Student' },
          ]}
        />
        <Checkbox name="wantsToSpeak" description="Adds a short step for your talk proposal.">
          I'd like to give a talk
        </Checkbox>
      </Page>

      <Page title="Make it yours" description="Watch your pass update as you choose.">
        <AvatarPicker name="avatar" label="Pick an avatar" />
        <ColorPicker name="color" label="Pass color" />
        <DepthSlider name="agentDepth" label="How deep are you into AI agents?" />
      </Page>

      <Page title="Choose your pass">
        <TierPicker name="tier" label="Pass" />
        <When field="tier" equals="builder">
          <CheckboxGroup
            name="workshops"
            label="Workshops"
            description="$49 each, up to three."
            maxSelected={3}
            options={WORKSHOPS}
          />
        </When>
        <When field="tier" equals="patron">
          <Paragraph>✦ All four workshops are included with Patron.</Paragraph>
        </When>
        <When field="tier" in={['builder', 'patron']}>
          <Text
            name="promoCode"
            label="Promo code"
            description="Try AGENTS20 — or STUDENT50 if you picked Student."
            validate={checkPromo}
            autoComplete="off"
          />
        </When>
      </Page>

      <When field="wantsToSpeak" equals={true}>
        <Page title="Your talk" description="Short and concrete wins. You can edit it later.">
          <Text name="talkTitle" label="Talk title" required maxLength={80} />
          <RadioGroup
            name="talkFormat"
            label="Format"
            required
            variant="cards"
            options={['Lightning · 5 min', 'Talk · 25 min', 'Workshop · 90 min']}
          />
          <Textarea
            name="abstract"
            label="Abstract"
            required
            minLength={80}
            maxLength={600}
            rows={5}
          />
        </Page>
      </When>

      <Page title="Last details">
        <RadioGroup
          name="tshirt"
          label="T-shirt size"
          required
          variant="cards"
          options={['XS', 'S', 'M', 'L', 'XL', 'XXL']}
        />
        <CheckboxGroup
          name="dietary"
          label="Dietary needs"
          options={['Vegetarian', 'Vegan', 'Gluten-free', 'Halal']}
        />
        <Checkbox name="codeOfConduct" required>
          I'll follow the OpenConf code of conduct
        </Checkbox>
      </Page>

      <Submit>Mint my pass →</Submit>
      <Success title="Your pass is minted">
        <Ticket final />
        <p className="of-description">
          <T>We emailed it to you. Show the code at the door — see you in Taipei.</T>
        </p>
      </Success>
    </Form>
  );
}
