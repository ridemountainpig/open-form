import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Page,
  Rating,
  Submit,
  Success,
  T,
  Textarea,
  When,
} from '@open-form-build/core';
import theme from './theme/index.tsx';
import './feedback.css';
import ja from './locales/ja.json';
import zhTW from './locales/zh-TW.json';
import { FEATURES, FeedbackHeader, FeedbackReceipt } from './parts.tsx';

export const config = defineForm({
  title: 'Product feedback',
  description: 'A few quick questions — about a minute. We read every reply.',
  locale: 'en',
  translations: { 'zh-TW': zhTW, ja },
  submissions: {
    closedMessage: 'This survey has closed. Thanks for taking the time.',
  },
});

// One question per <Page>: the conversational theme shows them one at a time.
export default function Feedback() {
  return (
    <Form theme={theme} components={{ Header: FeedbackHeader }}>
      <Page>
        <Rating
          name="nps"
          label="How likely are you to recommend us to a friend?"
          min={0}
          max={10}
          lowLabel="Not at all"
          highLabel="Very likely"
          required
        />
      </Page>
      <When field="nps" lte={6}>
        <Page>
          <Textarea
            name="improve"
            label="What could we do better?"
            placeholder="Where you got stuck, what's missing — anything helps…"
            required
          />
        </Page>
      </When>
      <When
        all={[
          { field: 'nps', gte: 7 },
          { field: 'nps', lte: 8 },
        ]}
      >
        <Page>
          <Textarea
            name="missing"
            label="What would make it a 10?"
            placeholder="One feature, one small detail — anything…"
          />
        </Page>
      </When>
      <When field="nps" gte={9}>
        <Page>
          <Textarea name="love" label="What do you like most?" placeholder="Tell us…" />
        </Page>
      </When>
      <Page>
        <CheckboxGroup
          name="features"
          label="Which features do you use most?"
          description="Pick as many as you like."
          variant="cards"
          options={FEATURES}
        />
      </Page>
      <Page>
        <Email
          name="email"
          label="Want us to get back to you?"
          description="Optional — just leave your email."
          placeholder="name@example.com"
        />
      </Page>
      <Submit>Send feedback</Submit>
      <Success title="Thank you!">
        <p className="of-description">
          <T>Your feedback is in. Every suggestion gets a real look.</T>
        </p>
        <FeedbackReceipt />
      </Success>
    </Form>
  );
}
