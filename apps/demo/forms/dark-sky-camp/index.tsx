import {
  Checkbox,
  DateInput,
  defineForm,
  Email,
  Form,
  NumberInput,
  Page,
  RadioGroup,
  Row,
  Select,
  Submit,
  Success,
  Text,
  When,
} from '@open-form-build/core';
import { Ticket } from './camp.tsx';
import { SITES, WEEKENDS } from './sky.ts';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Dark Sky Camp',
  description:
    'Three nights a year, far from any city light. Two nights of camping, guided sky tours and hot cocoa at 2 a.m.',
  submissions: {
    maxResponses: 120,
    uniqueBy: 'email',
    fullMessage: 'Every pitch is taken this season. Join us for the next shower.',
    duplicateMessage: 'This email already has a booking. Reply to your confirmation to change it.',
  },
});

export default function DarkSkyCamp() {
  return (
    <Form theme={theme}>
      <Page title="Your sky">
        <RadioGroup
          name="weekend"
          label="Which weekend?"
          description="Each one is timed to a meteor shower and a new moon."
          required
          variant="cards"
          options={Object.entries(WEEKENDS).map(([value, w]) => ({
            value,
            label: `${w.name} · ${w.dates}`,
          }))}
        />
        <RadioGroup
          name="site"
          label="Where do you want to pitch?"
          required
          options={Object.entries(SITES).map(([value, s]) => ({
            value,
            label: `${s.name} — ${s.detail}`,
          }))}
        />
        <NumberInput
          name="group"
          label="How many of you?"
          description="Up to 6 to a booking. Each group gets its own pitch."
          required
          integer
          min={1}
          max={6}
          defaultValue={1}
          unit="people"
        />
        <DateInput
          name="birthday"
          label="Your birthday"
          description="Optional. We'll find your star sign in the sky for you."
          min="1920-01-01"
          max="2026-12-31"
        />
      </Page>
      <Page title="Your details">
        <Row>
          <Text name="name" label="Name" required autoComplete="name" />
          <Email name="email" label="Email" required />
        </Row>
        <Select
          name="experience"
          label="Have you stargazed before?"
          options={[
            { value: 'never', label: 'Never — show me everything' },
            { value: 'some', label: 'A few times' },
            { value: 'keen', label: 'I know my way around the sky' },
          ]}
        />
        <Checkbox name="telescope">Rent a telescope for the weekend (+$25)</Checkbox>
        <When field="telescope" equals={true}>
          <RadioGroup
            name="scope"
            label="Which one?"
            required
            options={[
              { value: 'dob8', label: '8" Dobsonian — easy, bright, great for galaxies' },
              { value: 'refractor', label: '80 mm refractor — sharp moon and planets' },
            ]}
          />
        </When>
      </Page>
      <Submit>Book my pitch</Submit>
      <Success title="See you under the stars">
        <Ticket />
      </Success>
    </Form>
  );
}
