import {
  defineForm,
  Email,
  Form,
  NumberInput,
  RadioGroup,
  Row,
  Submit,
  Text,
  Textarea,
  Url,
  useFieldValue,
  useTranslate,
  When,
} from '@open-form-build/core';
import zhTW from './locales/zh-TW.json';
import { PLANS, PlanPicker } from './plan-picker.tsx';
import theme from './theme/index.tsx';
import './contact.css';

export const config = defineForm({
  title: 'Talk to sales',
  description: 'Tell us about your team and we will get back to you within one business day.',
  locale: 'en',
  translations: { 'zh-TW': zhTW },
  protection: { rateLimit: { max: 3, window: '1h' } },
  submissions: {
    closedMessage: 'We are not taking requests through this form at the moment.',
  },
  success: {
    title: 'Thank you.',
    message: 'Your request is with our team. Expect a reply within one business day.',
  },
});

// The returned message is source text too: the runtime translates it like a label.
const notFreeMail = (value: unknown) =>
  /@(gmail|yahoo|hotmail|outlook)\./i.test(String(value))
    ? 'Please use your work email.'
    : undefined;

/** Fills the ink panel with the request as it's being written. Display only. */
function RequestSummary() {
  const tr = useTranslate();
  const company = useFieldValue<string>('company')?.trim();
  const teamSize = useFieldValue<string>('teamSize');
  const planId = useFieldValue<string>('plan');
  const seats = useFieldValue<number | string>('seats');
  const plan = PLANS.find((p) => p.id === planId);

  const rows: Array<[string, string | undefined]> = [
    ['Company', company],
    ['Team size', teamSize && tr('{size} people', { size: teamSize })],
    ['Plan', plan && `${tr(plan.name)} · ${tr(plan.price)}`],
  ];
  if (planId === 'enterprise')
    rows.push(['Seats', seats ? tr('{n} seats', { n: seats }) : undefined]);

  return (
    <section className="sales-summary" aria-label={tr('Your request')}>
      <p className="sales-summary-title">{tr('Your request')}</p>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label} className="sales-summary-row">
            <dt>{tr(label)}</dt>
            <dd data-empty={value ? undefined : ''}>{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function Contact() {
  return (
    <Form theme={theme} aside={<RequestSummary />}>
      <Row>
        <Text name="name" label="Name" required autoComplete="name" />
        <Email name="email" label="Work email" required validate={notFreeMail} />
      </Row>
      <Row>
        <Text name="company" label="Company" required autoComplete="organization" />
        <Url name="website" label="Website" placeholder="https://" />
      </Row>
      <RadioGroup
        name="teamSize"
        label="Team size"
        required
        options={['1–10', '11–50', '51–200', '200+']}
      />
      <PlanPicker name="plan" label="Which plan are you considering?" />
      <When field="plan" equals="enterprise">
        <NumberInput name="seats" label="How many seats?" min={10} integer required unit="seats" />
      </When>
      <Textarea name="message" label="What are you hoping to build?" maxLength={1000} rows={5} />
      <Submit>Contact sales</Submit>
    </Form>
  );
}
