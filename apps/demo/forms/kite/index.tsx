import {
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
  Text,
  Textarea,
  useFieldValue,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Where to next?',
  description:
    'Eight quick questions about how you like to travel. We use them to plan the routes Kite opens this year.',
});

function Farewell() {
  const name = useFieldValue<string>('name');
  return (
    <p className="of-description">
      {name ? `${name}, ` : ''}
      <T>your answers are in. We will send three trip ideas that fit them within a week.</T>
    </p>
  );
}

export default function KiteTripSurvey() {
  return (
    <Form theme={theme}>
      <Page>
        <Text
          name="name"
          label="First, what should we call you?"
          required
          autoComplete="given-name"
        />
      </Page>
      <Page>
        <RadioGroup
          name="company"
          label="Who do you usually travel with?"
          required
          options={[
            { value: 'solo', label: 'Just me' },
            { value: 'partner', label: 'My partner' },
            { value: 'friends', label: 'Friends' },
            { value: 'family', label: 'Family with kids' },
          ]}
        />
      </Page>
      <Page>
        <CheckboxGroup
          name="tripKinds"
          label="What kind of trip are you dreaming about?"
          description="Choose as many as you like."
          variant="cards"
          required
          options={[
            { value: 'beach', label: 'Beach' },
            { value: 'mountains', label: 'Mountains' },
            { value: 'city', label: 'City break' },
            { value: 'countryside', label: 'Countryside' },
          ]}
        />
      </Page>
      <Page>
        <RadioGroup
          name="length"
          label="How long is the ideal trip?"
          required
          options={[
            { value: 'weekend', label: 'A long weekend' },
            { value: 'week', label: 'About a week' },
            { value: 'fortnight', label: 'Two weeks' },
            { value: 'longer', label: 'As long as I can get away with' },
          ]}
        />
      </Page>
      <Page>
        <RadioGroup
          name="season"
          label="When do you most want to get away?"
          required
          options={[
            { value: 'spring', label: 'Spring' },
            { value: 'summer', label: 'Summer' },
            { value: 'autumn', label: 'Autumn' },
            { value: 'winter', label: 'Winter' },
          ]}
        />
      </Page>
      <Page>
        <Rating
          name="whim"
          label="How often do you book a trip on a whim?"
          description="Be honest. We won't tell your calendar."
          min={0}
          max={10}
          lowLabel="Never, I plan everything"
          highLabel="My bag is already packed"
          required
        />
      </Page>
      <Page>
        <Textarea
          name="perfectDay"
          label="Describe a perfect day away."
          description="Optional. A sentence is plenty."
          rows={3}
          maxLength={400}
        />
      </Page>
      <Page>
        <Email name="email" label="Where should we send your trip ideas?" required />
      </Page>
      <Submit>Send my answers</Submit>
      <Success title="Bon voyage.">
        <Farewell />
      </Success>
    </Form>
  );
}
