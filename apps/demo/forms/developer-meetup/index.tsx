import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  type NoticeUIProps,
  Page,
  RadioGroup,
  Rating,
  Row,
  Select,
  Submit,
  Success,
  T,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import { Agenda } from './agenda.tsx';
import zhTW from './locales/zh-TW.json';
import theme from './theme/index.tsx';
import './meetup.css';

export const config = defineForm({
  title: 'Taipei Developer Meetup',
  locale: 'en',
  translations: { 'zh-TW': zhTW },
  description: 'Thursday, Oct 30 · 7 PM · Songshan Cultural Park. Free entry, 100 seats.',
  submissions: {
    maxResponses: 100,
    uniqueBy: 'email',
    closesAt: '2026-10-30',
    duplicateMessage: 'This email is already registered — check your inbox for the ticket.',
    closedMessage: 'We’re not taking sign-ups for this one anymore.',
    fullMessage: 'All the seats are spoken for.',
  },
  success: {
    calendar: {
      start: '2026-10-30T19:00',
      end: '2026-10-30T21:30',
      timeZone: 'Asia/Taipei',
      location: 'Songshan Cultural and Creative Park',
    },
  },
  drafts: true,
});

// The theme's failed-command look; the header above it already names the meetup.
function RegistrationClosed({ state, title, message }: NoticeUIProps) {
  const heading =
    state === 'closed' ? <T>Registration closed</T> : state === 'full' ? <T>Sold out</T> : title;
  return (
    <div className="tm-result">
      <h2 className="tm-fail">
        <span aria-hidden="true">✖ </span>
        {heading}
      </h2>
      <div className="tm-result-body">
        <p>{message}</p>
      </div>
      {(state === 'closed' || state === 'full') && (
        <p className="tm-dim">
          <span aria-hidden="true"># </span>
          <T>Registered? Your ticket arrives by email a week before the event.</T>
        </p>
      )}
      <p className="tm-dim" aria-hidden="true">
        process exited with code 1
      </p>
    </div>
  );
}

export default function DeveloperMeetup() {
  return (
    <Form
      theme={theme}
      aside={<Agenda />}
      className="mt-root"
      components={{ Notice: RegistrationClosed }}
    >
      <Page title="About you">
        <Row>
          <Text name="firstName" label="First name" required autoComplete="given-name" />
          <Text name="lastName" label="Last name" required autoComplete="family-name" />
        </Row>
        <Email name="email" label="Email" required description="Your ticket goes here." />
      </Page>

      <Page title="Background">
        <Select
          name="role"
          label="What best describes you?"
          required
          options={['Student', 'Engineer', 'Designer', 'Product', 'Other']}
        />
        <When field="role" equals="Student">
          <Text name="school" label="School" required />
        </When>
        <When field="role" in={['Engineer', 'Designer', 'Product']}>
          <Text name="company" label="Company" autoComplete="organization" />
        </When>
        <RadioGroup
          name="experience"
          label="Years of experience"
          required
          variant="cards"
          options={['Under 1 year', '1–3 years', '3–5 years', '5+ years']}
        />
        <CheckboxGroup
          name="interests"
          label="Topics you're into"
          description="Pick up to three."
          maxSelected={3}
          options={['AI agents', 'Frontend', 'Backend', 'DevOps', 'Design systems']}
        />
      </Page>

      <Page title="Almost done">
        <Rating
          name="excitement"
          label="How excited are you?"
          lowLabel="Curious"
          highLabel="Can't wait"
        />
        <Textarea name="question" label="A question for the speakers?" maxLength={500} />
        <Checkbox name="codeOfConduct" required>
          I agree to follow the code of conduct
        </Checkbox>
      </Page>

      <Submit>Register</Submit>
      <Success title="You're in!">
        <p>
          <T>We'll email your ticket a week before the event. See you there.</T>
        </p>
        <Agenda final />
      </Success>
    </Form>
  );
}
