import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Page,
  RadioGroup,
  Rating,
  Submit,
  Success,
  T,
  Textarea,
} from '@open-form-build/core';
import ja from './locales/ja.json';
import zhTW from './locales/zh-TW.json';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Loop rider check-in',
  description: 'Five stops, about a minute.',
  locale: 'en',
  translations: { 'zh-TW': zhTW, ja },
  submissions: {
    uniqueBy: 'device',
    duplicateMessage: 'You already checked in after this ride. Thanks again.',
  },
});

export default function LoopCheckIn() {
  return (
    <Form theme={theme}>
      <Page title="Score">
        <Rating
          name="score"
          label="How likely are you to tell a friend about Loop?"
          min={0}
          max={10}
          lowLabel="Not a chance"
          highLabel="Already did"
          required
        />
      </Page>
      <Page title="Why">
        <Textarea
          name="reason"
          label="What is the main reason for that score?"
          placeholder="One honest sentence is plenty."
          rows={3}
          maxLength={400}
        />
      </Page>
      <Page title="Habits">
        <CheckboxGroup
          name="uses"
          label="What do you use Loop for most?"
          description="Pick as many as you like."
          variant="cards"
          required
          options={[
            { value: 'commute', label: 'The commute' },
            { value: 'lastMile', label: 'Last mile' },
            { value: 'night', label: 'Night rides' },
            { value: 'errands', label: 'Errands' },
            { value: 'wandering', label: 'Just wandering' },
          ]}
        />
      </Page>
      <Page title="Wishlist">
        <RadioGroup
          name="fixFirst"
          label="What should we fix first?"
          variant="cards"
          required
          options={[
            { value: 'bikes', label: 'More bikes at rush hour' },
            { value: 'docks', label: 'Docks that are not full' },
            { value: 'price', label: 'A cheaper day pass' },
            { value: 'app', label: 'A faster app' },
          ]}
        />
      </Page>
      <Page title="Stay in touch">
        <Email
          name="email"
          label="Want a reply from a human?"
          description="Optional. Leave an email and someone on the team writes back."
        />
        <Checkbox name="rideCredit">Send me a free ride when my fix ships</Checkbox>
      </Page>
      <Submit>Send it</Submit>
      <Success title="Thanks for the ride.">
        <p className="of-description">
          <T>Your answers go straight to the people who move the bikes around.</T>
        </p>
      </Success>
    </Form>
  );
}
