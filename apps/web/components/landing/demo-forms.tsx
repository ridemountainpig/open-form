'use client';

import {
  Checkbox,
  CheckboxGroup,
  defineForm,
  defineTheme,
  Email,
  Form,
  type FormTheme,
  type NoticeUIProps,
  Page,
  RadioGroup,
  Rating,
  Row,
  Select,
  Submit,
  Text,
  Textarea,
  When,
} from '@open-form-build/core';
import brutalist from '@starters/brutalist';
import classic from '@starters/classic';
import conversational from '@starters/conversational';
import editorial from '@starters/editorial';
import terminal from '@starters/terminal';
import type { CSSProperties } from 'react';
import { fakeSubmit } from './live-form';

const DEMO_SUCCESS = 'This is a demo, so nothing was sent. In your workspace it lands in Studio.';

export const starters: { id: string; label: string; theme: FormTheme }[] = [
  { id: 'terminal', label: 'Terminal', theme: terminal },
  { id: 'editorial', label: 'Editorial', theme: editorial },
  { id: 'conversational', label: 'Conversational', theme: conversational },
  { id: 'brutalist', label: 'Brutalist', theme: brutalist },
  { id: 'classic', label: 'Classic', theme: classic },
];

// The site's own monochrome theme for the feature panels, the way a project
// would write one in themes/.
export const ink = defineTheme({
  font: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  headingFont: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  radius: '10px',
  buttonRadius: '999px',
  spacing: 'compact',
  width: '520px',
  layout: 'plain',
  colors: {
    primary: '#0a0a0a',
    primaryForeground: '#ffffff',
    background: '#ffffff',
    surface: '#ffffff',
    foreground: '#0a0a0a',
    muted: '#6b6b6b',
    border: '#e8e8e8',
    control: '#8f8f8f',
    input: '#ffffff',
    error: '#c62a1f',
    success: '#15803d',
  },
  dark: {
    primary: '#f4f4f5',
    primaryForeground: '#0a0a0a',
    background: '#202020',
    surface: '#202020',
    foreground: '#f4f4f5',
    muted: '#a1a1a1',
    border: '#333333',
    control: '#6e6e6e',
    input: '#1a1a1a',
    error: '#f97066',
    success: '#4ade80',
  },
});

export const meetupConfig = defineForm({
  title: 'Developer Meetup',
  description: 'Thursday, 7 PM. Free entry, 100 seats.',
  success: { title: "You're in!", message: DEMO_SUCCESS },
});

const roles = ['Student', 'Engineer', 'Designer', 'Product', 'Other'];

export function MeetupForm() {
  return (
    <Form onSubmit={fakeSubmit}>
      <Page title="About you">
        <Row>
          <Text name="firstName" label="First name" required autoComplete="given-name" />
          <Text name="lastName" label="Last name" required autoComplete="family-name" />
        </Row>
        <Email name="email" label="Email" required description="Your ticket goes here." />
      </Page>
      <Page title="Background">
        <Select name="role" label="What best describes you?" required options={roles} />
        <When field="role" equals="Student">
          <Text name="school" label="School" required />
        </When>
        <When field="role" in={['Engineer', 'Designer', 'Product']}>
          <Text name="company" label="Company" autoComplete="organization" />
        </When>
        <RadioGroup
          name="experience"
          label="Years of experience"
          required
          variant="cards"
          options={['Under 1 year', '1–3 years', '3–5 years', '5+ years']}
        />
      </Page>
      <Page title="Almost done">
        <CheckboxGroup
          name="interests"
          label="Topics you're into"
          description="Pick up to three."
          maxSelected={3}
          options={['AI agents', 'Frontend', 'Backend', 'Design systems']}
        />
        <Rating
          name="excitement"
          label="How excited are you?"
          lowLabel="Curious"
          highLabel="Can't wait"
        />
        <Checkbox name="codeOfConduct" required>
          I agree to follow the code of conduct
        </Checkbox>
      </Page>
      <Submit>Register</Submit>
    </Form>
  );
}

// Conversational themes ask one question per screen, so the same meetup is
// written that way for it — what create-form does for this direction.
export function MeetupConversational() {
  return (
    <Form onSubmit={fakeSubmit}>
      <Page>
        <Text name="firstName" label="First, what's your name?" required autoComplete="name" />
      </Page>
      <Page>
        <Email name="email" label="Where should we send your ticket?" required />
      </Page>
      <Page>
        <RadioGroup name="role" label="What best describes you?" required options={roles} />
      </Page>
      <When field="role" equals="Student">
        <Page>
          <Text name="school" label="Which school?" required />
        </Page>
      </When>
      <Page>
        <Rating
          name="excitement"
          label="How excited are you?"
          lowLabel="Curious"
          highLabel="Can't wait"
        />
      </Page>
      <Submit>Register</Submit>
    </Form>
  );
}

export const betaConfig = defineForm({
  title: 'Join the beta',
  success: { title: 'Request received', message: DEMO_SUCCESS },
});

export function BetaForm() {
  return (
    <Form onSubmit={fakeSubmit}>
      <Text name="name" label="Name" required autoComplete="name" />
      <Email name="email" label="Work email" required />
      <Select name="team" label="Team size" options={['1–10', '11–50', '51–200', '200+']} />
      <Submit>Request access</Submit>
    </Form>
  );
}

export const roleConfig = defineForm({
  title: 'Workshop sign-up',
  success: { title: 'Signed up', message: DEMO_SUCCESS },
});

export function RoleForm() {
  return (
    <Form onSubmit={fakeSubmit}>
      <Email name="email" label="Email" required />
      <RadioGroup name="role" label="Role" required options={['Student', 'Engineer', 'Designer']} />
      <When field="role" equals="Student">
        <Text name="school" label="School" required />
      </When>
      <Submit>Sign up</Submit>
    </Form>
  );
}

export const talkConfig = defineForm({
  title: 'Call for speakers',
  success: { title: 'Proposal sent', message: DEMO_SUCCESS },
});

export function TalkForm() {
  return (
    <Form onSubmit={fakeSubmit}>
      <Page title="About you">
        <Text name="name" label="Name" required autoComplete="name" />
        <Email name="email" label="Email" required />
      </Page>
      <Page title="Your talk">
        <Text name="talkTitle" label="Talk title" required maxLength={80} />
        <Textarea name="abstract" label="Abstract" rows={3} maxLength={400} />
      </Page>
      <Submit>Apply</Submit>
    </Form>
  );
}

export const launchConfig = defineForm({
  title: 'Launch party',
  submissions: {
    maxResponses: 100,
    uniqueBy: 'email',
    closedMessage: 'Sign-ups closed on Oct 30.',
    fullMessage: 'All 100 spots are taken.',
  },
  success: { title: 'See you there', message: DEMO_SUCCESS },
});

const SEATS = Array.from({ length: 100 }, (_, i) => i);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
// October 2026 starts on a Thursday.
const OCTOBER = [
  ...['a', 'b', 'c', 'd'].map((key) => ({ key, day: null })),
  ...Array.from({ length: 31 }, (_, i) => ({ key: `d${i + 1}`, day: i + 1 })),
];

function LaunchClosed({ state, eyebrow, title, message }: NoticeUIProps) {
  const full = state === 'full';
  const closed = state === 'closed';
  return (
    <div className="lc">
      <span className={`lc-status ${full ? 'lc-full' : ''}`}>
        <i aria-hidden="true" />
        {full ? 'Sold out' : closed ? 'Registration closed' : 'Unavailable'}
      </span>
      {eyebrow && <p className="lc-eyebrow">{eyebrow}</p>}
      <h1 className="lc-title">
        {full ? 'That’s a full house.' : closed ? 'Sign-ups have ended.' : title}
      </h1>
      <p className="lc-message">{message}</p>
      {full && (
        <div className="lc-seats" role="img" aria-label="100 of 100 seats taken">
          {SEATS.map((seat) => (
            <i key={seat} style={{ '--i': seat } as CSSProperties} />
          ))}
        </div>
      )}
      {closed && (
        <div className="lc-calendar" role="img" aria-label="Closed on October 30">
          {WEEKDAYS.map((day) => (
            <b key={day}>{day[0]}</b>
          ))}
          {OCTOBER.map(({ key, day }) => (
            <span key={key} className={day === 30 ? 'lc-end' : day === 31 ? 'lc-after' : undefined}>
              {day}
            </span>
          ))}
        </div>
      )}
      <p className="lc-next">Already registered? Your ticket is in your inbox.</p>
    </div>
  );
}

export function LaunchForm() {
  return (
    <Form onSubmit={fakeSubmit} components={{ Notice: LaunchClosed }}>
      <Text name="name" label="Name" required autoComplete="name" />
      <Email name="email" label="Email" required />
      <Submit>Save my spot</Submit>
    </Form>
  );
}
