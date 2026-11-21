import {
  defineForm,
  Form,
  Heading,
  RadioGroup,
  Row,
  Submit,
  Success,
  Tel,
  Text,
} from '@open-form-build/core';
import { DayPicker } from './day-picker.tsx';
import theme from './theme/index.tsx';
import { SERVICES, Ticket } from './ticket.tsx';

export const config = defineForm({
  title: 'Book a chair.',
  description: '12 Lane 8, Yongkang St · Tue–Sun 11–20',
});

export default function SundayCutsBooking() {
  return (
    <Form theme={theme} aside={<Ticket />}>
      <RadioGroup
        name="service"
        label="What are we doing?"
        variant="cards"
        required
        options={Object.entries(SERVICES).map(([value, service]) => ({
          value,
          label: service.name,
        }))}
      />
      <RadioGroup
        name="barber"
        label="Who with?"
        required
        defaultValue="anyone"
        options={[
          { value: 'anyone', label: 'Anyone free' },
          { value: 'leo', label: 'Leo' },
          { value: 'mina', label: 'Mina' },
          { value: 'jo', label: 'Jo' },
        ]}
      />
      <DayPicker name="day" label="Pick a day" description="Closed on Mondays." required />
      <RadioGroup
        name="time"
        label="And a time"
        variant="cards"
        required
        options={[
          '11:00',
          '11:45',
          '12:30',
          '13:15',
          '14:30',
          '15:15',
          '16:00',
          '17:30',
          '18:15',
          '19:00',
        ]}
      />
      <Heading>Who's coming?</Heading>
      <Row>
        <Text name="name" label="Name" required autoComplete="name" />
        <Tel name="mobile" label="Mobile, for a reminder text" required defaultCountry="TW" />
      </Row>
      <Submit>Confirm booking</Submit>
      <Success title="You're in the book.">
        <p className="of-description">
          We will text you the morning of. Free to cancel up to two hours before.
        </p>
      </Success>
    </Form>
  );
}
