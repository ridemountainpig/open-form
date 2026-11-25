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
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import { Receipt } from './blend.tsx';
import { BASE, CONCENTRATION, HEART, options, SIZES, TOP } from './notes.ts';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Compose your fragrance',
  description:
    'Pick three notes and we blend them by hand in the Lisbon atelier. Ships in about ten days.',
});

export default function PerfumeAtelier() {
  return (
    <Form theme={theme}>
      <Page title="The notes" description="Each note you pick drops into the water as its own ink.">
        <RadioGroup
          name="top"
          label="Top note"
          description="The first thing you smell. It fades within the hour."
          required
          variant="cards"
          options={options(TOP)}
        />
        <RadioGroup
          name="heart"
          label="Heart note"
          description="The character of the scent, once the top has lifted."
          required
          variant="cards"
          options={options(HEART)}
        />
        <RadioGroup
          name="base"
          label="Base note"
          description="What stays on your skin at the end of the day."
          required
          variant="cards"
          options={options(BASE)}
        />
      </Page>
      <Page title="The bottle">
        <RadioGroup
          name="concentration"
          label="Strength"
          required
          defaultValue="edp"
          options={Object.entries(CONCENTRATION).map(([value, c]) => ({
            value,
            label: `${c.name} · ${c.detail}`,
          }))}
        />
        <RadioGroup
          name="size"
          label="Size"
          description="Extrait adds €30."
          required
          defaultValue="50"
          variant="cards"
          options={Object.entries(SIZES).map(([value, s]) => ({
            value,
            label: `${s.name} · €${s.price}`,
          }))}
        />
        <Text
          name="engraving"
          label="Name it"
          description="Engraved on the cap. Up to 16 characters."
          maxLength={16}
          placeholder="e.g. Late August"
        />
        <Row>
          <Text name="name" label="Your name" required autoComplete="name" />
          <Email name="email" label="Email" required />
        </Row>
        <Select
          name="country"
          label="Ship to"
          required
          options={[
            'Portugal',
            'Spain',
            'France',
            'Germany',
            'Netherlands',
            'United Kingdom',
            'United States',
            'Japan',
            'Taiwan',
          ]}
        />
        <Checkbox name="gift">Wrap it as a gift</Checkbox>
        <When field="gift" equals={true}>
          <Textarea
            name="giftNote"
            label="Card message"
            description="Handwritten on the card. We leave the price out."
            maxLength={200}
            rows={3}
          />
        </When>
      </Page>
      <Submit>Blend it</Submit>
      <Success title="It's in the water">
        <Receipt />
      </Success>
    </Form>
  );
}
