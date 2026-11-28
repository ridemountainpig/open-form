import { describe, expect, it } from 'vitest';
import type { FormSchema } from '../schema/index.ts';
import { prefillAnswers, prefillOverDraft, readLinkPrefill, withoutPrefill } from './prefill.ts';

const schema: FormSchema = {
  id: 'meetup',
  pages: [],
  fields: [
    { name: 'name', type: 'text', page: 0, when: [] },
    { name: 'email', type: 'email', page: 0, when: [] },
    { name: 'guests', type: 'number', page: 0, when: [] },
    { name: 'conduct', type: 'checkbox', page: 0, when: [] },
    {
      name: 'role',
      type: 'radio',
      page: 0,
      when: [],
      options: [
        { value: 'engineer', label: 'Engineer' },
        { value: 'designer', label: 'Designer' },
      ],
    },
    {
      name: 'topics',
      type: 'checkbox-group',
      page: 0,
      when: [],
      options: [
        { value: 'ai', label: 'AI' },
        { value: 'web', label: 'Web' },
      ],
    },
    { name: 'seat', type: 'custom', page: 0, when: [] },
  ],
};

describe('readLinkPrefill', () => {
  it('reads only the allowed fields, from the fragment or the query string', () => {
    expect(
      readLinkPrefill(['name', 'email'], '?email=q%40example.com&admin=1', '#name=Ada%20L'),
    ).toEqual({ name: 'Ada L', email: 'q@example.com' });
  });

  it('prefers the fragment over the query string', () => {
    expect(readLinkPrefill(['name'], '?name=Query', '#name=Hash')).toEqual({ name: 'Hash' });
  });

  it('keeps repeated keys as a list and caps their length', () => {
    const long = 'x'.repeat(5000);
    const out = readLinkPrefill(['topics', 'name'], `?topics=ai&topics=web&name=${long}`, '');
    expect(out.topics).toEqual(['ai', 'web']);
    expect((out.name as string).length).toBe(1000);
  });
});

describe('prefillAnswers', () => {
  it('coerces to each field type and drops what the field cannot hold', () => {
    const raw = {
      name: '  Ada  ',
      guests: '2',
      conduct: 'true',
      role: 'ceo',
      topics: ['ai', 'blockchain'],
      seat: '{"row":1}',
      email: '',
    };
    expect(
      prefillAnswers(schema, ['name', 'guests', 'conduct', 'role', 'topics', 'seat', 'email'], raw),
    ).toEqual({ name: 'Ada', guests: 2, conduct: true, topics: ['ai'] });
  });

  it('ignores fields the form did not allow, even when the link names them', () => {
    expect(prefillAnswers(schema, ['name'], { name: 'Ada', role: 'engineer' })).toEqual({
      name: 'Ada',
    });
  });

  it('drops a number that is not one', () => {
    expect(prefillAnswers(schema, ['guests'], { guests: 'two' })).toEqual({});
  });

  it('leaves markup as plain text for React to escape', () => {
    expect(prefillAnswers(schema, ['name'], { name: '<img src=x onerror=alert(1)>' })).toEqual({
      name: '<img src=x onerror=alert(1)>',
    });
  });
});

describe('prefillOverDraft', () => {
  it('lets the draft win field by field and fills the rest from the link', () => {
    expect(
      prefillOverDraft({ name: 'Ada', email: 'ada@example.com' }, { name: 'Ada Lovelace' }),
    ).toEqual({ email: 'ada@example.com' });
  });

  it('keeps a field the respondent cleared in the draft empty', () => {
    expect(prefillOverDraft({ name: 'Ada' }, { name: '' })).toEqual({});
  });

  it('uses the link as is without a draft', () => {
    expect(prefillOverDraft({ name: 'Ada' }, undefined)).toEqual({ name: 'Ada' });
  });
});

describe('withoutPrefill', () => {
  it('removes the prefilled answers and keeps the rest of the link', () => {
    expect(
      withoutPrefill('https://x.test/f/meetup?lang=ja&email=a%40b.co#name=Ada', ['name', 'email']),
    ).toBe('https://x.test/f/meetup?lang=ja');
  });

  it('returns null when the link carries no prefilled answers', () => {
    expect(withoutPrefill('https://x.test/f/meetup?lang=ja#top', ['name'])).toBeNull();
  });
});
