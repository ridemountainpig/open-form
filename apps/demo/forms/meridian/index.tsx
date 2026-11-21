import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  Email,
  Form,
  RadioGroup,
  Row,
  Select,
  Submit,
  Success,
  Text,
  Textarea,
} from '@open-form-build/core';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Talk to our team.',
  description:
    'Tell us a little about your organisation and what you are evaluating. A solutions engineer, not a script, will pick it up within one business day.',
});

const PERSONAL = /@(gmail|yahoo|hotmail|outlook|icloud|proton|protonmail)\./i;

function Promises() {
  const points = [
    ['A 30-minute scoping call', 'With an engineer who has deployed Meridian at your scale.'],
    ['A written proposal', 'Pricing, rollout plan and security review pack, within a week.'],
    ['A pilot on your own data', 'Fourteen days, your region, no card required.'],
  ];
  return (
    <>
      <ol className="md-points">
        {points.map(([title, body]) => (
          <li key={title}>
            <b>{title}</b>
            <span>{body}</span>
          </li>
        ))}
      </ol>
      <p className="md-caption">Trusted by teams at</p>
      <p className="md-marks">
        <span>Northwind</span>
        <span>Atelier &amp; Co.</span>
        <span>KUMO LABS</span>
        <span>Halden</span>
      </p>
    </>
  );
}

export default function MeridianContactSales() {
  return (
    <Form theme={theme} aside={<Promises />}>
      <Row>
        <Text name="firstName" label="First name" required autoComplete="given-name" />
        <Text name="lastName" label="Last name" required autoComplete="family-name" />
      </Row>
      <Email
        name="email"
        label="Work email"
        required
        validate={(value) =>
          typeof value === 'string' && PERSONAL.test(value)
            ? 'Please use your work email.'
            : undefined
        }
      />
      <Row>
        <Text name="company" label="Company" required autoComplete="organization" />
        <Select
          name="region"
          label="Region"
          required
          options={[
            { value: 'amer', label: 'Americas' },
            { value: 'emea', label: 'Europe, Middle East and Africa' },
            { value: 'apac', label: 'Asia Pacific' },
          ]}
        />
      </Row>
      <RadioGroup
        name="companySize"
        label="Company size"
        variant="cards"
        required
        options={[
          { value: '1-50', label: '1–50' },
          { value: '51-200', label: '51–200' },
          { value: '201-1000', label: '201–1,000' },
          { value: '1000+', label: '1,000+' },
        ]}
      />
      <CheckboxGroup
        name="interests"
        label="What are you interested in?"
        description="Select all that apply."
        variant="cards"
        options={[
          { value: 'platform', label: 'Platform' },
          { value: 'analytics', label: 'Analytics' },
          { value: 'sso', label: 'Single sign-on' },
          { value: 'privateCloud', label: 'Private cloud' },
        ]}
      />
      <Textarea
        name="notes"
        label="Anything we should know?"
        placeholder="Timeline, current tools, security requirements…"
        rows={3}
        maxLength={1000}
      />
      <Checkbox name="consent" required>
        I agree to Meridian's privacy policy and to being contacted about this request.
      </Checkbox>
      <Submit>Contact sales</Submit>
      <Success title="Thanks. It is with an engineer now.">
        <p className="of-description">
          You will hear from a named person within one business day, with two or three times for a
          scoping call.
        </p>
      </Success>
    </Form>
  );
}
