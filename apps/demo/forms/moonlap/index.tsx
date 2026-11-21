import {
  Checkbox,
  defineForm,
  Email,
  Form,
  Page,
  RadioGroup,
  Row,
  Select,
  Submit,
  Success,
  T,
  Tel,
  Text,
  useFieldValue,
} from '@open-form-build/core';
import { Bib, waveFor } from './bib.tsx';
import { PaceSlider } from './pace-slider.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Build your bib.',
  description: 'Taipei riverside night run · Sat 27 Mar 2027 · 20:00',
  submissions: {
    maxResponses: 3000,
    uniqueBy: 'email',
    closesAt: '2027-03-20',
    fullMessage: 'All 3,000 bibs are taken. The waitlist opens the week before the race.',
    duplicateMessage: 'This email already has a bib. One runner, one bib.',
  },
  success: {
    calendar: {
      title: 'Moonlap night run',
      start: '2027-03-27T20:00',
      end: '2027-03-27T23:00',
      timeZone: 'Asia/Taipei',
      location: 'Dajia Riverside Park, Taipei',
    },
  },
});

function Farewell() {
  const pace = useFieldValue<number>('pace');
  const wave = waveFor(typeof pace === 'number' ? pace : 340);
  return (
    <p className="of-description">
      <T>Your bib is being printed.</T> Wave {wave.letter}, {wave.start}.{' '}
      <T>Pick it up at the park from 17:00 on race day, and bring a photo ID.</T>
    </p>
  );
}

export default function MoonlapRegistration() {
  return (
    <Form theme={theme} aside={<Bib />}>
      <Page title="Runner" description="Who is running, and who we call if you need a hand.">
        <Row>
          <Text name="fullName" label="Full name" required autoComplete="name" />
          <Email name="email" label="Email" required />
        </Row>
        <Row>
          <Text name="emergencyName" label="Emergency contact" required />
          <Tel name="emergencyPhone" label="Their phone" required defaultCountry="TW" />
        </Row>
      </Page>
      <Page
        title="Your race"
        description="Everything you choose here is printed on the bib. Watch it change."
      >
        <RadioGroup
          name="distance"
          label="Distance"
          variant="cards"
          required
          defaultValue="10"
          options={[
            { value: '5', label: '5K' },
            { value: '10', label: '10K' },
            { value: '21', label: '21.1K' },
          ]}
        />
        <PaceSlider name="pace" label="Target pace" description="Sets your start wave." />
        <Text
          name="bibName"
          label="Name on bib"
          description="Up to 12 letters or numbers."
          required
          maxLength={12}
          pattern="^[A-Za-z0-9 ]+$"
          patternMessage="Letters, numbers and spaces only."
        />
        <RadioGroup
          name="bibColor"
          label="Bib colour"
          defaultValue="amber"
          options={[
            { value: 'amber', label: 'Amber' },
            { value: 'coral', label: 'Coral' },
            { value: 'rose', label: 'Rose' },
            { value: 'sand', label: 'Sand' },
            { value: 'mint', label: 'Mint' },
          ]}
        />
      </Page>
      <Page title="Kit" description="A race shirt comes with every entry.">
        <Row>
          <Select
            name="shirtSize"
            label="Shirt size"
            required
            options={['XS', 'S', 'M', 'L', 'XL', 'XXL']}
          />
          <Select
            name="shirtCut"
            label="Cut"
            required
            options={[
              { value: 'straight', label: 'Straight' },
              { value: 'fitted', label: 'Fitted' },
            ]}
          />
        </Row>
        <RadioGroup
          name="pickup"
          label="Bib pickup"
          required
          options={[
            { value: 'raceDay', label: 'At the park on race day, from 17:00' },
            { value: 'expo', label: 'At the expo, Friday 12:00 to 20:00' },
          ]}
        />
      </Page>
      <Page
        title="Waiver"
        description="The short version: run within yourself and look after each other."
      >
        <Checkbox name="waiver" required>
          I am fit to run my chosen distance and accept the event waiver.
        </Checkbox>
        <Checkbox name="photos">Photos of me on the course may be used by Moonlap.</Checkbox>
      </Page>
      <Submit>Print my bib</Submit>
      <Success title="See you under the moon.">
        <Farewell />
      </Success>
    </Form>
  );
}
