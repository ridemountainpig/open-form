import {
  Checkbox,
  DateInput,
  defineForm,
  Email,
  Form,
  NumberInput,
  Page,
  Paragraph,
  RadioGroup,
  Row,
  Select,
  Submit,
  Success,
  Tel,
  Text,
  Textarea,
  Url,
  When,
} from '@open-form-build/core';
import { Review } from './review.tsx';
import theme from './theme/index.tsx';

export const config = defineForm({
  title: 'Senior Product Designer',
  description: 'Design · Platform team',
  drafts: true,
  submissions: {
    closesAt: '2026-12-15',
    uniqueBy: 'email',
    closedMessage: 'Applications for this role closed on 15 December 2026.',
    duplicateMessage: 'We already have an application from this email. One is all we need.',
  },
});

function RoleFacts() {
  return (
    <>
      <section className="nw-card">
        <h2>About the role</h2>
        <dl className="nw-facts">
          <dt>Team</dt>
          <dd>Platform design, 7 people</dd>
          <dt>Reports to</dt>
          <dd>Head of Design</dd>
          <dt>Salary band</dt>
          <dd>NT$ 1.6M – 2.2M</dd>
          <dt>Location</dt>
          <dd>Taipei, hybrid</dd>
        </dl>
      </section>
      <section className="nw-card">
        <h2>What happens next</h2>
        <ol className="nw-timeline">
          <li data-on="">
            <b>Application</b>
            <span>About ten minutes. Your draft is saved in this browser.</span>
          </li>
          <li>
            <b>Portfolio review</b>
            <span>We reply to everyone within 7 days.</span>
          </li>
          <li>
            <b>Two conversations</b>
            <span>With the hiring manager, then the team.</span>
          </li>
          <li>
            <b>Offer</b>
            <span>Typically three weeks from today.</span>
          </li>
        </ol>
      </section>
      <p className="nw-eeo">
        Northwind is an equal-opportunity employer. Your answers are only seen by the hiring team
        and are deleted after 12 months.
      </p>
    </>
  );
}

export default function NorthwindApplication() {
  return (
    <Form theme={theme} aside={<RoleFacts />}>
      <Page title="About you" description="So we know who is applying and how to reach you.">
        <Row>
          <Text name="firstName" label="First name" required autoComplete="given-name" />
          <Text name="lastName" label="Last name" required autoComplete="family-name" />
        </Row>
        <Row>
          <Email name="email" label="Email" required />
          <Tel name="phone" label="Phone" />
        </Row>
        <Text name="city" label="Where are you based?" required placeholder="City, country" />
      </Page>
      <Page title="Experience" description="Tell us where you are now.">
        <Row>
          <Text name="currentTitle" label="Current title" required />
          <Text name="currentCompany" label="Current company" />
        </Row>
        <Row>
          <Select
            name="experience"
            label="Years of design experience"
            required
            options={[
              { value: '0-2', label: '0–2 years' },
              { value: '3-5', label: '3–5 years' },
              { value: '6-9', label: '6–9 years' },
              { value: '10+', label: '10 years or more' },
            ]}
          />
          <DateInput name="startDate" label="Earliest start date" required />
        </Row>
        <Url
          name="portfolio"
          label="Portfolio or résumé link"
          description="A website, PDF link or Figma file. Make sure it is viewable without signing in."
          required
        />
        <Url name="linkedin" label="LinkedIn profile" placeholder="https://linkedin.com/in/" />
        <RadioGroup
          name="workAuth"
          label="Are you authorised to work in Taiwan?"
          required
          options={[
            { value: 'yes', label: 'Yes, without sponsorship' },
            { value: 'permit', label: 'I would need a work permit' },
          ]}
        />
        <When field="workAuth" equals="permit">
          <Paragraph>
            That is fine. We sponsor work permits for this role; it usually adds four to six weeks.
          </Paragraph>
        </When>
        <NumberInput
          name="salary"
          label="Expected annual salary"
          unit="NT$ / year"
          min={0}
          integer
        />
      </Page>
      <Page title="Questions" description="Short answers are welcome. We read every one.">
        <Textarea
          name="proudWork"
          label="Tell us about a piece of work you are proud of."
          description="What was the problem, and what did you personally do?"
          required
          rows={5}
          maxLength={1200}
        />
        <Textarea
          name="whyNorthwind"
          label="Why this team, and why now?"
          rows={4}
          maxLength={800}
        />
        <Select
          name="source"
          label="How did you hear about this role?"
          options={[
            { value: 'referral', label: 'Someone at Northwind' },
            { value: 'linkedin', label: 'LinkedIn' },
            { value: 'community', label: 'A design community' },
            { value: 'other', label: 'Somewhere else' },
          ]}
        />
        <When field="source" equals="referral">
          <Text name="referrer" label="Who referred you?" required />
        </When>
      </Page>
      <Page title="Review & submit" description="Check your answers. Earlier steps stay editable.">
        <Review />
        <Checkbox name="confirm" required>
          Everything above is accurate, and Northwind may contact me about this application.
        </Checkbox>
      </Page>
      <Submit>Submit application</Submit>
      <Success title="Application received.">
        <p className="of-description">
          A person on the design team reads every portfolio. You will hear from us within seven
          days, whichever way it goes.
        </p>
      </Success>
    </Form>
  );
}
