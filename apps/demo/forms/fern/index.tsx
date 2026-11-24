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
  useFieldValue,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Let’s plan your garden',
  description: 'Five questions, about a minute. Every answer plants something new.',
});

function Farewell() {
  const name = useFieldValue<string>('name');
  return (
    <p className="of-description">
      {name ? `${name}, ` : ''}
      <T>your planting plan is on its way. Look for it in your inbox this afternoon.</T>
    </p>
  );
}

export default function FernWelcome() {
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
        <CheckboxGroup
          name="reasons"
          label="What brings you to Fern?"
          description="Choose as many as you like."
          required
          options={[
            { value: 'garden', label: 'Planning a garden from scratch' },
            { value: 'houseplants', label: 'Keeping houseplants alive' },
            { value: 'balcony', label: 'Growing food on a balcony' },
            { value: 'curious', label: 'Just curious' },
          ]}
        />
      </Page>
      <Page>
        <RadioGroup
          name="light"
          label="How much light does your space get?"
          required
          options={[
            { value: 'full', label: 'Sun most of the day' },
            { value: 'partial', label: 'A few bright hours' },
            { value: 'shade', label: 'Mostly shade' },
            { value: 'unsure', label: 'I have never checked' },
          ]}
        />
      </Page>
      <Page>
        <Rating
          name="confidence"
          label="How confident are you with plants?"
          lowLabel="I have lost a cactus"
          highLabel="Everything thrives"
          required
        />
      </Page>
      <Page>
        <Email name="email" label="Where should we send your planting plan?" required />
      </Page>
      <Submit>Send my plan</Submit>
      <Success title="Your garden is planted.">
        <Farewell />
      </Success>
    </Form>
  );
}
