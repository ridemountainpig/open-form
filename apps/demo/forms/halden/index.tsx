import {
  defineForm,
  Email,
  Form,
  NumberInput,
  RadioGroup,
  Row,
  Submit,
  Success,
  T,
  Text,
  Textarea,
  Url,
  useFieldValue,
  When,
} from '@open-form-build/core';
import { Docket } from './docket.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Commission a piece.',
  description:
    'Every table, bench and shelf leaves our workshop with one owner in mind. Tell us about yours and we will reply with drawings and a quote within two working days.',
  submissions: {
    maxResponses: 9,
    fullMessage: 'All nine commissions for this season are taken. The book opens again in spring.',
  },
});

function Farewell() {
  const name = useFieldValue<string>('name');
  return (
    <p className="of-description">
      {name ? `${name}, ` : ''}
      <T>your enquiry is on the bench. Drawings and a quote follow within two working days.</T>
    </p>
  );
}

export default function HaldenCommission() {
  return (
    <Form theme={theme} aside={<Docket />}>
      <Row>
        <Text name="name" label="Name" required autoComplete="name" />
        <Email name="email" label="Email" required />
      </Row>
      <Row>
        <Text name="city" label="City" required autoComplete="address-level2" />
        <Url name="website" label="Website or Instagram" placeholder="https://" />
      </Row>
      <RadioGroup
        name="piece"
        label="What should we make?"
        variant="cards"
        required
        options={[
          { value: 'table', label: 'Dining table' },
          { value: 'bench', label: 'Bench' },
          { value: 'shelving', label: 'Shelving' },
          { value: 'other', label: 'Something else' },
        ]}
      />
      <When field="piece" equals="table">
        <NumberInput
          name="seats"
          label="How many seats?"
          unit="seats"
          integer
          min={2}
          max={14}
          defaultValue={6}
          required
        />
      </When>
      <RadioGroup
        name="timber"
        label="Which timber?"
        description="All from managed forests."
        required
        options={[
          { value: 'oak', label: 'White oak' },
          { value: 'walnut', label: 'Walnut' },
          { value: 'ash', label: 'Ash' },
          { value: 'cherry', label: 'Cherry' },
          { value: 'undecided', label: 'Help me choose' },
        ]}
      />
      <Textarea
        name="room"
        label="Tell us about the room."
        description="Size, light, who gathers there."
        rows={4}
        maxLength={1000}
      />
      <Submit>Send enquiry</Submit>
      <Success title="Received, with thanks.">
        <Farewell />
      </Success>
    </Form>
  );
}
