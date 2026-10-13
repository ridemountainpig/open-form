import {
  defineForm,
  Email,
  Form,
  NumberInput,
  RadioGroup,
  Row,
  Submit,
  Text,
  Textarea,
  Url,
  When,
} from '@open-form-build/core';
import zhTW from './locales/zh-TW.json';
import { PlanPicker } from './plan-picker.tsx';
import { RequestSummary } from './summary.tsx';
import theme from './theme/index.tsx';
import './contact.css';

export const config = defineForm({
  title: 'Talk to sales',
  description: 'Tell us about your team and we will get back to you within one business day.',
  locale: 'en',
  translations: { 'zh-TW': zhTW },
  protection: { rateLimit: { max: 3, window: '1h' } },
  submissions: {
    closedMessage: 'We are not taking requests through this form at the moment.',
  },
  success: {
    title: 'Thank you.',
    message: 'Your request is with our team. Expect a reply within one business day.',
  },
});

// The returned message is source text too: the runtime translates it like a label.
const notFreeMail = (value: unknown) =>
  /@(gmail|yahoo|hotmail|outlook)\./i.test(String(value))
    ? 'Please use your work email.'
    : undefined;

export default function Contact() {
  return (
    <Form theme={theme} aside={<RequestSummary />}>
      <Row>
        <Text name="name" label="Name" required autoComplete="name" />
        <Email name="email" label="Work email" required validate={notFreeMail} />
      </Row>
      <Row>
        <Text name="company" label="Company" required autoComplete="organization" />
        <Url name="website" label="Website" placeholder="https://" />
      </Row>
      <RadioGroup
        name="teamSize"
        label="Team size"
        required
        options={['1–10', '11–50', '51–200', '200+']}
      />
      <PlanPicker name="plan" label="Which plan are you considering?" />
      <When field="plan" equals="enterprise">
        <NumberInput name="seats" label="How many seats?" min={10} integer required unit="seats" />
      </When>
      <Textarea name="message" label="What are you hoping to build?" maxLength={1000} rows={5} />
      <Submit>Contact sales</Submit>
    </Form>
  );
}
