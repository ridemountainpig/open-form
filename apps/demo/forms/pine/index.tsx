import {
  defineForm,
  Email,
  Form,
  Page,
  RadioGroup,
  Submit,
  Success,
  Text,
  Textarea,
  useFieldValue,
} from '@open-form-build/core';
import { ASK } from './script.ts';
import theme from './theme/index.tsx';
import { Transcript } from './transcript.tsx';

export const config = defineForm({
  title: 'Something not working?',
  description:
    'Tell Juniper what is happening. Six short messages and your request is with the right team.',
});

function Goodbye() {
  const name = useFieldValue<string>('name');
  const email = useFieldValue<string>('email');
  return (
    <p className="of-description">
      Thanks{name ? `, ${name}` : ''}. Your request is with the network team, and the first update
      will land at {email || 'your inbox'} within two hours.
    </p>
  );
}

export default function PineSupport() {
  return (
    <Form theme={theme} aside={<Transcript />}>
      <Page>
        <Text
          name="name"
          label={ASK.name.ask}
          placeholder="Type your name"
          required
          autoComplete="given-name"
        />
      </Page>
      <Page>
        <RadioGroup name="topic" label={ASK.topic.ask} required options={ASK.topic.options ?? []} />
      </Page>
      <Page>
        <RadioGroup name="since" label={ASK.since.ask} required options={ASK.since.options ?? []} />
      </Page>
      <Page>
        <RadioGroup
          name="restarted"
          label={ASK.restarted.ask}
          required
          options={ASK.restarted.options ?? []}
        />
      </Page>
      <Page>
        <Textarea
          name="details"
          label={ASK.details.ask}
          placeholder="Error lights, times of day, anything you noticed"
          rows={3}
          maxLength={600}
        />
      </Page>
      <Page>
        <Email name="email" label={ASK.email.ask} placeholder="you@example.com" required />
      </Page>
      <Submit>Send to support</Submit>
      <Success title="All sent.">
        <Goodbye />
      </Success>
    </Form>
  );
}
