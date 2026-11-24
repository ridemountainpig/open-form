import { defineForm, Form, Submit, Success, T, useFieldValue } from '@open-form-build/core';
import { Blank, Pick, Progress } from './blanks.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'New project enquiry',
  description: 'Fill in the blanks. We reply within two days.',
});

function Farewell() {
  const name = useFieldValue<string>('name');
  return (
    <p className="of-description">
      {name ? `${name}, ` : ''}
      <T>
        thank you. Your letter is with the studio, and a real reply is on its way within two days.
      </T>
    </p>
  );
}

export default function OdaEnquiry() {
  return (
    <Form theme={theme} aside={<Progress total={6} />}>
      <p className="od-letter">
        Hello, I'm{' '}
        <Blank name="name" label="Your name" placeholder="your name" autoComplete="name" required />{' '}
        from{' '}
        <Blank
          name="company"
          label="Company"
          placeholder="company"
          autoComplete="organization"
          required
        />
        . We're looking for help with{' '}
        <Pick
          name="need"
          label="What you need"
          placeholder="what?"
          required
          options={[
            { value: 'website', label: 'a new website' },
            { value: 'identity', label: 'a brand identity' },
            { value: 'launch', label: 'a product launch' },
            { value: 'other', label: 'something else' },
          ]}
        />{' '}
        and we'd like it live{' '}
        <Pick
          name="deadline"
          label="Deadline"
          placeholder="when?"
          required
          options={[
            { value: 'month', label: 'within a month' },
            { value: 'quarter', label: 'this quarter' },
            { value: 'year', label: 'this year' },
            { value: 'flexible', label: 'whenever it is right' },
          ]}
        />
        . You can reach me at{' '}
        <Blank
          name="email"
          label="Email"
          type="email"
          placeholder="email"
          autoComplete="email"
          required
        />
        . Our budget is{' '}
        <Pick
          name="budget"
          label="Budget"
          placeholder="around…"
          required
          options={[
            { value: 'under300k', label: 'under NT$ 300k' },
            { value: '300k-600k', label: 'NT$ 300k–600k' },
            { value: '600k-1m', label: 'NT$ 600k–1M' },
            { value: 'over1m', label: 'over NT$ 1M' },
            { value: 'unsure', label: 'not decided yet' },
          ]}
        />
        .
      </p>
      <Submit>Send it</Submit>
      <Success title="Letter sent.">
        <Farewell />
      </Success>
    </Form>
  );
}
