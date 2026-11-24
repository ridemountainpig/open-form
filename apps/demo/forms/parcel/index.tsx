import {
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  Rating,
  Submit,
  Success,
  T,
  Textarea,
  When,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'How did we do?',
  description: 'Three quick questions about your delivery. It takes less than a minute.',
  submissions: { closedMessage: 'This delivery survey has closed. Thanks for ordering with us.' },
});

export default function ParcelFeedback() {
  return (
    <Form theme={theme}>
      <Rating
        name="overall"
        label="Overall, how was your experience?"
        required
        lowLabel="Poor"
        highLabel="Excellent"
      />
      <CheckboxGroup
        name="stoodOut"
        label="What stood out?"
        description="Choose any"
        variant="cards"
        options={[
          { value: 'speed', label: 'Fast delivery' },
          { value: 'packaging', label: 'Packaging' },
          { value: 'tracking', label: 'Tracking updates' },
          { value: 'courier', label: 'Courier' },
          { value: 'price', label: 'Price' },
          { value: 'other', label: 'Something else' },
        ]}
      />
      <When field="overall" lte={4}>
        <Textarea
          name="improve"
          label="What would have made it a 5?"
          description="Optional"
          rows={2}
          maxLength={600}
        />
      </When>
      <Email name="email" label="Email" description="Only if you'd like a reply" />
      <Submit>Send feedback</Submit>
      <Success title="Thanks, that helps.">
        <p className="of-description">
          <T>
            We read every response. If you left an email, expect a reply within two working days.
          </T>
        </p>
      </Success>
    </Form>
  );
}
