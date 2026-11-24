import {
  Checkbox,
  defineForm,
  Email,
  Form,
  RadioGroup,
  Rating,
  Row,
  Submit,
  Success,
  T,
  Text,
  Textarea,
  useFieldValue,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Request a feature',
  description:
    'Tell us what would make Relay better for your team. It takes less than two minutes, and the roadmap is built from these.',
  submissions: { closedMessage: 'Feature requests are paused while we plan the next quarter.' },
});

function Echo() {
  const idea = useFieldValue<string>('idea');
  const notify = useFieldValue<boolean>('notify');
  return (
    <>
      {idea && <p className="rl-echo">“{idea}”</p>}
      <p className="of-description">
        {notify ? (
          <T>It is on the list. We will email you the day it ships.</T>
        ) : (
          <T>It is on the list. Requests are reviewed every other Monday.</T>
        )}
      </p>
    </>
  );
}

export default function RelayFeatureRequest() {
  return (
    <Form theme={theme}>
      <Row>
        <Text name="name" label="Your name" required autoComplete="name" />
        <Email name="email" label="Work email" required />
      </Row>
      <RadioGroup
        name="area"
        label="Which part of Relay is this about?"
        required
        options={[
          { value: 'inbox', label: 'Inbox' },
          { value: 'automations', label: 'Automations' },
          { value: 'reports', label: 'Reports' },
          { value: 'other', label: 'Something else' },
        ]}
      />
      <Text name="idea" label="Give your idea a title" required maxLength={80} />
      <Textarea name="problem" label="What problem would it solve?" rows={3} maxLength={800} />
      <Rating name="importance" label="How much does this matter to you?" />
      <Checkbox name="notify">Email me when this ships</Checkbox>
      <Submit>Submit</Submit>
      <Success title="Thanks, we got it.">
        <Echo />
      </Success>
    </Form>
  );
}
