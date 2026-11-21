import {
  DateInput,
  defineForm,
  Form,
  NumberInput,
  Page,
  RadioGroup,
  Row,
  Select,
  Submit,
  Success,
  T,
  Tel,
  Text,
  Textarea,
  useFieldValue,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Book a table at Mesa',
  description: 'Open Tuesday to Sunday, 18:00 till late.',
  submissions: { closedMessage: 'The book is full this month. Walk-ins are welcome at the bar.' },
});

const TIMES = ['18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30'];

function Farewell() {
  const time = useFieldValue<string>('time');
  const occasion = useFieldValue<string>('occasion');
  return (
    <p className="of-description">
      {time ? `${time}. ` : ''}
      {occasion === 'birthday' ? (
        <T>The table is yours, and the candle is on us. We hold it for fifteen minutes.</T>
      ) : (
        <T>The table is yours. We hold it for fifteen minutes, then the bar gets lucky.</T>
      )}
    </p>
  );
}

export default function MesaReservation() {
  return (
    <Form theme={theme}>
      <Page title="When shall we expect you?" description="Tables are held for fifteen minutes.">
        <NumberInput
          name="guests"
          label="Guests"
          required
          integer
          min={1}
          max={8}
          defaultValue={2}
        />
        <Row>
          <DateInput name="date" label="Date" required />
          <Select name="time" label="Time" required options={TIMES} />
        </Row>
      </Page>
      <Page
        title="What are we celebrating?"
        description="So the kitchen knows whether to send candles, or just more bread."
      >
        <RadioGroup
          name="occasion"
          label="Occasion"
          variant="cards"
          required
          options={[
            { value: 'date', label: 'Date night' },
            { value: 'birthday', label: 'Birthday' },
            { value: 'family', label: 'Family dinner' },
            { value: 'hungry', label: 'Just hungry' },
          ]}
        />
      </Page>
      <Page title="Who is the table for?" description="We only call if something changes.">
        <Row>
          <Text name="name" label="Name" required autoComplete="name" />
          <Tel name="phone" label="Phone" required />
        </Row>
        <Textarea
          name="notes"
          label="Anything the kitchen should know?"
          description="Allergies, a high chair, a surprise."
          rows={3}
          maxLength={300}
        />
      </Page>
      <Submit>Reserve the table</Submit>
      <Success title="See you at the table.">
        <Farewell />
      </Success>
    </Form>
  );
}
