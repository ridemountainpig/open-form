'use client';

import {
  Checkbox,
  CheckboxGroup,
  DateInput,
  defineForm,
  Email,
  FieldShell,
  Form,
  type FormValues,
  Matrix,
  NumberInput,
  RadioGroup,
  Rating,
  Select,
  Submit,
  Tel,
  Text,
  Textarea,
  Url,
  useField,
} from '@open-form-build/core';
import { type ComponentType, createContext, type ReactNode, useContext } from 'react';
import { fakeSubmit } from './live-form';

export type Specimen = {
  name: string;
  stored: string;
  note: string;
  docs: string;
  code: string[];
  form: ComponentType;
};

export const specimenConfig = defineForm({
  success: { title: 'Accepted', message: 'This answer passed the same check the server runs.' },
});

/** Receives the values a specimen would store, after the same coercion the server applies. */
export const StoredContext = createContext<(values: FormValues) => void>(() => {});

const FIELDS_DOCS = '/docs/components/fields#built-in-fields';

type Scene = { title: string; context: string; action: string };

function specimen(field: ReactNode, { title, context, action }: Scene): ComponentType {
  return function SpecimenForm() {
    const onStored = useContext(StoredContext);
    return (
      <Form
        title={title}
        description={context}
        onSubmit={async (values) => {
          await fakeSubmit();
          onStored(values);
        }}
      >
        {field}
        <Submit>{action}</Submit>
      </Form>
    );
  };
}

function Budget({ name, label }: { name: string; label: string }) {
  const field = useField({
    name,
    label,
    description: 'Rough is fine. We reply with a quote.',
    type: 'number',
    min: 0,
    max: 10000,
    defaultValue: 2500,
  });
  return (
    <FieldShell field={field}>
      <span className="flex items-center gap-4">
        <input
          {...field.controlProps}
          ref={field.ref}
          type="range"
          min={0}
          max={10000}
          step={500}
          value={Number(field.value ?? 0)}
          onChange={(event) => field.setValue(Number(event.target.value))}
          className="flex-1 accent-[color:var(--of-primary)]"
        />
        <output className="nums w-16 text-right">${String(field.value ?? 0)}</output>
      </span>
    </FieldShell>
  );
}

export const specimens: Specimen[] = [
  {
    name: 'Text',
    stored: 'string',
    note: 'Length limits and patterns, trimmed before it is checked.',
    docs: FIELDS_DOCS,
    code: ['<Text name="name" label="Name on your badge" required maxLength={40} />'],
    form: specimen(
      <Text
        name="name"
        label="Name on your badge"
        description="First name and surname. Up to 40 characters."
        placeholder="Ada Lovelace"
        required
        maxLength={40}
      />,
      { title: 'Badge pickup', context: 'DevConf 2026', action: 'Print my badge' },
    ),
  },
  {
    name: 'Email',
    stored: 'string',
    note: 'Checks the address format on both sides.',
    docs: FIELDS_DOCS,
    code: ['<Email name="email" label="Work email" required />'],
    form: specimen(
      <Email
        name="email"
        label="Work email"
        description="One email a month. Unsubscribe anytime."
        placeholder="you@company.com"
        required
      />,
      { title: 'The Monthly', context: 'Newsletter', action: 'Subscribe' },
    ),
  },
  {
    name: 'Url',
    stored: 'string',
    note: 'Needs http:// or https://.',
    docs: FIELDS_DOCS,
    code: ['<Url name="portfolio" label="Portfolio" required />'],
    form: specimen(
      <Url
        name="portfolio"
        label="Portfolio"
        description="Your site, GitHub or Dribbble."
        placeholder="https://"
        required
      />,
      { title: 'Portfolio review', context: 'Design team', action: 'Send for review' },
    ),
  },
  {
    name: 'Tel',
    stored: 'string',
    note: 'With a country, stored as one international number.',
    docs: '/docs/components/fields#phone-numbers',
    code: ['<Tel name="phone" label="Mobile" defaultCountry="TW" required />'],
    form: specimen(
      <Tel
        name="phone"
        label="Mobile"
        description="Only for delivery updates."
        defaultCountry="TW"
        required
      />,
      { title: 'Delivery details', context: 'Order #4821', action: 'Continue' },
    ),
  },
  {
    name: 'Textarea',
    stored: 'string',
    note: 'Shows a counter when there is a limit.',
    docs: FIELDS_DOCS,
    code: ['<Textarea name="bio" label="Speaker bio" rows={3} maxLength={200} />'],
    form: specimen(
      <Textarea
        name="bio"
        label="Speaker bio"
        placeholder="What you work on, in a sentence or two."
        rows={3}
        maxLength={200}
      />,
      { title: 'Call for speakers', context: 'Closes 30 Nov', action: 'Save bio' },
    ),
  },
  {
    name: 'NumberInput',
    stored: 'number',
    note: 'Range, whole numbers and a unit.',
    docs: FIELDS_DOCS,
    code: ['<NumberInput name="seats" label="Seats" min={1} max={8} integer unit="people" />'],
    form: specimen(
      <NumberInput
        name="seats"
        label="Seats"
        description="Tables take up to eight."
        required
        min={1}
        max={8}
        integer
        unit="people"
      />,
      { title: 'Table booking', context: 'Saturday dinner', action: 'Book a table' },
    ),
  },
  {
    name: 'DateInput',
    stored: 'YYYY-MM-DD',
    note: 'A plain date, the same in every time zone.',
    docs: FIELDS_DOCS,
    code: ['<DateInput name="day" label="Workshop day" min="2026-11-01" required />'],
    form: specimen(
      <DateInput
        name="day"
        label="Workshop day"
        description="Sessions start on 1 November."
        min="2026-11-01"
        required
      />,
      { title: 'Workshop sign-up', context: '3 hours', action: 'Hold my spot' },
    ),
  },
  {
    name: 'Select',
    stored: 'string',
    note: 'For longer lists. Answers outside the options are rejected.',
    docs: '/docs/components/fields#options',
    code: ['<Select name="city" label="Nearest meetup" options={[\'Taipei\', \'Tokyo\', …]} />'],
    form: specimen(
      <Select
        name="city"
        label="Nearest meetup"
        description="We host one every month."
        required
        options={['Taipei', 'Tokyo', 'Berlin', 'Lisbon']}
      />,
      { title: 'Meetups near you', context: 'Community', action: 'Find meetups' },
    ),
  },
  {
    name: 'RadioGroup',
    stored: 'string',
    note: 'One choice, as a list or as cards.',
    docs: '/docs/components/fields#options',
    code: ['<RadioGroup name="plan" label="Plan" variant="cards" options={plans} />'],
    form: specimen(
      <RadioGroup
        name="plan"
        label="Plan"
        required
        variant="cards"
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro · $12/mo' },
          { value: 'team', label: 'Team · $40/mo' },
          { value: 'enterprise', label: 'Enterprise' },
        ]}
      />,
      { title: 'Upgrade workspace', context: 'Billed monthly', action: 'Choose plan' },
    ),
  },
  {
    name: 'CheckboxGroup',
    stored: 'string[]',
    note: 'Several choices, with a minimum and a maximum.',
    docs: '/docs/components/fields#options',
    code: ['<CheckboxGroup name="tracks" label="Tracks" maxSelected={2} options={tracks} />'],
    form: specimen(
      <CheckboxGroup
        name="tracks"
        label="Tracks"
        description="Pick up to two."
        maxSelected={2}
        options={['AI agents', 'Frontend', 'Design']}
      />,
      { title: 'Your schedule', context: 'Day one', action: 'Save tracks' },
    ),
  },
  {
    name: 'Checkbox',
    stored: 'boolean',
    note: 'A single yes, like agreeing to terms.',
    docs: FIELDS_DOCS,
    code: ['<Checkbox name="terms" required>I agree to the terms</Checkbox>'],
    form: specimen(
      <Checkbox name="terms" description="You can delete your account at any time." required>
        I agree to the terms
      </Checkbox>,
      { title: 'Create your account', context: 'Last step', action: 'Create account' },
    ),
  },
  {
    name: 'Rating',
    stored: 'number',
    note: 'A scale with labels at each end. Use 0–10 for NPS.',
    docs: FIELDS_DOCS,
    code: ['<Rating name="talk" label="How was the talk?" lowLabel="Meh" highLabel="Loved it" />'],
    form: specimen(
      <Rating name="talk" label="How was the talk?" required lowLabel="Meh" highLabel="Loved it" />,
      { title: 'Session feedback', context: 'Hall A', action: 'Send feedback' },
    ),
  },
  {
    name: 'Matrix',
    stored: 'one per row',
    note: 'Several questions that share one set of answers.',
    docs: '/docs/components/fields#matrix',
    code: [
      '<Matrix',
      '  label="Rate the course"',
      "  columns={['Poor', 'Fair', 'Good', 'Great']}",
      "  rows={[{ name: 'content', label: 'Content' }, …]} />",
    ],
    form: specimen(
      <Matrix
        label="Rate the course"
        columns={['Poor', 'Fair', 'Good', 'Great']}
        rows={[
          { name: 'content', label: 'Content' },
          { name: 'teacher', label: 'Teacher' },
        ]}
        required
      />,
      { title: 'Course survey', context: 'Week 6', action: 'Send feedback' },
    ),
  },
  {
    name: 'useField',
    stored: 'your own',
    note: 'Any React input becomes a field the server checks and stores too.',
    docs: '/docs/components/custom-fields',
    code: [
      "const field = useField({ name, label, type: 'number', min: 0, max: 10000 });",
      '<FieldShell field={field}><input type="range" {...field.controlProps} /></FieldShell>',
    ],
    form: specimen(<Budget name="budget" label="Budget" />, {
      title: 'Project brief',
      context: 'New client',
      action: 'Send brief',
    }),
  },
];
