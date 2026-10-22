import { describe, expect, it } from 'vitest';
import { defineForm } from '../schema/index.ts';
import { toFormDefinition } from './definition.ts';
import { Email, Form, Text } from './index.ts';

const Signup = () => (
  <Form>
    <Text name="name" label="Name" />
    <Email name="email" label="Email" />
  </Form>
);

describe('toFormDefinition', () => {
  it('refuses a default export named like the component it renders', () => {
    function Email() {
      return <Email />;
    }
    expect(() => toFormDefinition('email', { default: Email })).toThrow(
      /default export is named `Email` like an Open Form component/,
    );
    function EmailForm() {
      return <Signup />;
    }
    expect(() => toFormDefinition('email', { default: EmailForm })).not.toThrow();
  });

  it('accepts a valid policy', () => {
    const def = toFormDefinition('signup', {
      default: Signup,
      config: defineForm({ submissions: { uniqueBy: 'email', closesAt: '2026-10-31' } }),
    });
    expect(def.version).toMatch(/^[0-9a-f]{12}$/);
  });

  it('rejects uniqueBy that names no field, listing the real ones', () => {
    expect(() =>
      toFormDefinition('signup', {
        default: Signup,
        config: defineForm({ submissions: { uniqueBy: 'emial' } }),
      }),
    ).toThrow(/uniqueBy is "emial", which is not a field\. Use 'device' or one of: name, email/);
  });

  it('rejects an unsupported locale and suggests the right tag', () => {
    expect(() =>
      toFormDefinition('signup', {
        default: Signup,
        config: defineForm({ locale: 'zh-Hant' as never }),
      }),
    ).toThrow(/locale "zh-Hant" isn't supported\. Did you mean 'zh-TW'\?/);
  });

  it('rejects unparseable dates and durations', () => {
    expect(() =>
      toFormDefinition('signup', {
        default: Signup,
        config: defineForm({
          submissions: { closesAt: 'next friday' },
          protection: { minimumCompletionTime: 'soon' as never },
        }),
      }),
    ).toThrow(/submissions: Invalid date "next friday"[\s\S]*protection: Invalid duration "soon"/);
  });
});

describe('success.calendar', () => {
  it('refuses an event that would not open in a calendar', () => {
    expect(() =>
      toFormDefinition('meetup', {
        default: Signup,
        config: defineForm({ success: { calendar: { start: '2026-11-15T19:00' } } }),
      }),
    ).toThrow(/success\.calendar needs a `title`/);
    expect(() =>
      toFormDefinition('meetup', {
        default: Signup,
        config: defineForm({
          title: 'Meetup',
          success: { calendar: { start: '2026-11-15T19:00' } },
        }),
      }),
    ).toThrow(/success\.calendar: start "2026-11-15T19:00" has no time zone/);
    expect(() =>
      toFormDefinition('meetup', {
        default: Signup,
        config: defineForm({
          title: 'Meetup',
          timeZone: 'Asia/Taipei',
          success: { calendar: { start: '2026-11-15T19:00', location: 'Taipei' } },
        }),
      }),
    ).not.toThrow();
  });
});
