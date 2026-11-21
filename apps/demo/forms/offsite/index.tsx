import {
  CheckboxGroup,
  defineForm,
  Form,
  NumberInput,
  RadioGroup,
  Submit,
  Success,
  Text,
  Textarea,
} from '@open-form-build/core';
import theme from './theme/index.tsx';
import { Tally, Tile } from './tiles.tsx';

export const config = defineForm({
  title: 'Offsite in Hualien',
  description:
    "12 to 14 March, three days by the sea. Tell us you're in and we'll sort trains, rooms and dinner.",
  submissions: {
    closesAt: '2027-02-20T23:59:00+08:00',
    closedMessage: 'RSVPs are closed. Message the people team if your plans changed.',
  },
});

export default function OffsiteRsvp() {
  return (
    <Form theme={theme} aside={<Tally />}>
      <Tile name="attending">
        <RadioGroup
          name="attending"
          label="Are you coming?"
          required
          options={[
            { value: 'yes', label: "I'm in" },
            { value: 'maybe', label: 'Maybe' },
            { value: 'no', label: "Can't" },
          ]}
        />
      </Tile>
      <Tile name="name">
        <Text name="name" label="Your name" placeholder="Mira Lin" required autoComplete="name" />
      </Tile>
      <Tile name="guests">
        <NumberInput
          name="guests"
          label="Bringing anyone?"
          integer
          min={0}
          max={3}
          defaultValue={0}
        />
      </Tile>
      <Tile name="travel">
        <RadioGroup
          name="travel"
          label="How are you getting there?"
          options={[
            { value: 'train', label: 'Team train' },
            { value: 'driving', label: 'Driving' },
            { value: 'own', label: 'On my own' },
          ]}
        />
      </Tile>
      <Tile name="room">
        <RadioGroup
          name="room"
          label="Room"
          options={[
            { value: 'twin', label: 'Share a twin' },
            { value: 'single', label: 'Room to myself' },
          ]}
        />
      </Tile>
      <Tile name="diet">
        <CheckboxGroup
          name="diet"
          label="Food"
          options={[
            { value: 'none', label: 'No restrictions' },
            { value: 'vegetarian', label: 'Vegetarian' },
            { value: 'vegan', label: 'Vegan' },
            { value: 'no-seafood', label: 'No seafood' },
            { value: 'halal', label: 'Halal' },
          ]}
        />
      </Tile>
      <Tile name="activities">
        <CheckboxGroup
          name="activities"
          label="Saturday afternoon?"
          variant="cards"
          options={[
            { value: 'hike', label: 'Hike Taroko' },
            { value: 'surf', label: 'Surf lesson' },
            { value: 'cook', label: 'Cook with a chef' },
            { value: 'nothing', label: 'Do nothing at all' },
          ]}
        />
      </Tile>
      <Tile name="notes">
        <Textarea
          name="notes"
          label="Anything else?"
          placeholder="Allergies, late arrival, a song for the bus…"
          rows={3}
          maxLength={400}
        />
      </Tile>
      <Submit>Send RSVP</Submit>
      <Success title="You're on the list.">
        We will send train tickets and room details a week before we leave. See you in Hualien.
      </Success>
    </Form>
  );
}
