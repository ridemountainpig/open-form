import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Rating,
  Row,
  Select,
  Submit,
  Success,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Join the Fieldnotes beta',
  description:
    'Fieldnotes is a plain-text notebook that works offline and syncs when it can. We are letting in 200 people a week. Five questions, about a minute.',
  submissions: {
    uniqueBy: 'email',
    duplicateMessage:
      'This email is already on the list. We will write as soon as your week comes up.',
  },
});

export default function FieldnotesBeta() {
  return (
    <Form theme={theme}>
      <Row>
        <Text name="name" label="What's your name?" required autoComplete="name" />
        <Email name="email" label="And your email?" required />
      </Row>
      <CheckboxGroup
        name="writes"
        label="What do you write most?"
        description="Pick up to two."
        required
        maxSelected={2}
        options={[
          { value: 'meetings', label: 'Meeting notes' },
          { value: 'journal', label: 'A daily journal' },
          { value: 'research', label: 'Research and reading notes' },
          { value: 'drafts', label: 'Long-form drafts' },
        ]}
      />
      <Select
        name="device"
        label="Where would you use it first?"
        required
        options={[
          { value: 'mac', label: 'Mac' },
          { value: 'windows', label: 'Windows' },
          { value: 'linux', label: 'Linux' },
          { value: 'ios', label: 'iPhone or iPad' },
          { value: 'android', label: 'Android' },
        ]}
      />
      <Rating name="currentApp" label="How happy are you with your current notes app?" />
      <When field="currentApp" lte={3}>
        <Textarea
          name="missing"
          label="What's missing from it?"
          placeholder="Type your answer…"
          rows={3}
          maxLength={600}
        />
      </When>
      <Submit>Join the list</Submit>
      <Success title="You're on the list.">
        <p className="of-description">
          Invites go out every Monday morning. Yours will come from hello@fieldnotes.example with a
          download link and nothing else.
        </p>
      </Success>
    </Form>
  );
}
