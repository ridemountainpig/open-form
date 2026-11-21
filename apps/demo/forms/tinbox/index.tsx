import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  RadioGroup,
  Submit,
  Success,
  Text,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'TINBOX',
  description: 'Private beta · request an API key',
  submissions: {
    uniqueBy: 'email',
    duplicateMessage: '409 Conflict. This email already has a request in the queue.',
    closedMessage: '503. The beta is full for now; keys open again next month.',
  },
});

export default function TinboxBetaKey() {
  return (
    <Form theme={theme}>
      <Text name="name" label="Name" required autoComplete="name" />
      <Email name="email" label="Email" required />
      <RadioGroup
        name="building"
        label="Building"
        required
        options={[
          { value: 'webApp', label: 'a web app' },
          { value: 'cli', label: 'a CLI tool' },
          { value: 'agent', label: 'an agent' },
          { value: 'poking', label: 'just poking around' },
        ]}
      />
      <CheckboxGroup
        name="stack"
        label="Stack"
        description="any"
        options={[
          { value: 'typescript', label: 'TypeScript' },
          { value: 'go', label: 'Go' },
          { value: 'rust', label: 'Rust' },
          { value: 'python', label: 'Python' },
          { value: 'other', label: 'other' },
        ]}
      />
      <RadioGroup
        name="volume"
        label="Volume"
        description="requests per day"
        required
        options={[
          { value: 'under1k', label: '< 1k' },
          { value: '1k-50k', label: '1k to 50k' },
          { value: 'over50k', label: '50k+' },
        ]}
      />
      <Text name="note" label="Note" placeholder="what are you replacing?" maxLength={140} />
      <Submit>send request</Submit>
      <Success title="201 Created">
        <p className="of-description">
          Your request is in the queue. The key arrives by email, usually within a day. Do not bend
          the disk.
        </p>
      </Success>
    </Form>
  );
}
