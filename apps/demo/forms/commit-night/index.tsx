import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Page,
  RadioGroup,
  Submit,
  Success,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import { Agenda, Seats, You } from './panes.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'COMMIT NIGHT v12',
  description: 'Four talks, one long table, pizza.',
  drafts: true,
  prefill: ['name', 'email', 'handle'],
  submissions: {
    maxResponses: 100,
    uniqueBy: 'email',
    closesAt: '2027-01-14',
    fullMessage: 'All 100 seats are taken. The stream link goes out on the day.',
    closedMessage: 'Registration closed on Jan 14. See you at v13.',
    duplicateMessage: 'This email already has a seat.',
  },
  success: {
    calendar: {
      title: 'Commit Night v12',
      start: '2027-01-15T19:00',
      end: '2027-01-15T22:00',
      timeZone: 'Asia/Taipei',
      location: 'Huashan 1914, Taipei',
    },
  },
});

export default function CommitNightRegistration() {
  return (
    <Form
      theme={theme}
      aside={
        <>
          <You />
          <Agenda />
          <Seats />
        </>
      }
    >
      <Page title="about you">
        <Text name="name" label="Your name" required autoComplete="name" />
        <Email name="email" label="Email" description="The ticket goes here." required />
        <Text name="handle" label="GitHub handle" placeholder="@" />
      </Page>
      <Page title="background">
        <RadioGroup
          name="role"
          label="What best describes you?"
          variant="cards"
          required
          options={[
            { value: 'engineer', label: 'Engineer' },
            { value: 'designer', label: 'Designer' },
            { value: 'student', label: 'Student' },
            { value: 'other', label: 'Other' },
          ]}
        />
        <When field="role" notEquals="student">
          <Text name="company" label="Company" />
        </When>
        <When field="role" equals="student">
          <Text name="school" label="School" required />
        </When>
        <RadioGroup
          name="experience"
          label="Years of experience"
          variant="cards"
          required
          options={[
            { value: '0-1', label: '< 1' },
            { value: '1-3', label: '1–3' },
            { value: '3-5', label: '3–5' },
            { value: '5+', label: '5+' },
          ]}
        />
        <CheckboxGroup
          name="topics"
          label="Topics you're into"
          description="Pick up to three. Matching talks get a star in the agenda."
          maxSelected={3}
          options={[
            { value: 'agents', label: 'AI agents' },
            { value: 'frontend', label: 'Frontend' },
            { value: 'systems', label: 'Systems & Rust' },
            { value: 'devops', label: 'DevOps' },
            { value: 'design', label: 'Design systems' },
          ]}
        />
      </Page>
      <Page title="almost done">
        <RadioGroup
          name="pizza"
          label="Pizza"
          required
          options={[
            { value: 'any', label: 'Anything' },
            { value: 'vegetarian', label: 'Vegetarian' },
            { value: 'vegan', label: 'Vegan' },
            { value: 'none', label: 'I will eat before' },
          ]}
        />
        <Textarea
          name="lightning"
          label="Want five minutes at the open table?"
          description="Optional. Tell us what you would show."
          rows={2}
          maxLength={280}
        />
        <Checkbox name="conduct" required>
          I have read the code of conduct and will be kind.
        </Checkbox>
      </Page>
      <Submit>register</Submit>
      <Success title="201 Created">
        <p className="of-description">
          Your seat is saved and the ticket is in your inbox. Doors at 19:00, talks from 19:30.
        </p>
      </Success>
    </Form>
  );
}
