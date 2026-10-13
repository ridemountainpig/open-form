import { describe, expect, it } from 'vitest';
import { parseSource } from './loc-tags.ts';
import {
  elementNames,
  findTextSlots,
  replaceText,
  slotsForText,
  slotsOfElement,
  type TextSlot,
} from './text-slots.ts';

const FORM = [
  "import { Checkbox, defineForm, Form, Page, Select, Text, When } from '@open-form-build/core';",
  'export const config = defineForm({',
  "  title: 'Meetup',",
  '  success: { title: "You\'re in!" },',
  "  translations: { 'zh-TW': { Meetup: '聚會' } },",
  '});',
  'export default function Meetup() {',
  '  return (',
  '    <Form>',
  '      <Page title="About you">',
  '        <Text name="name" label="Name" description="As on your ID." />',
  "        <Select name=\"role\" label=\"Role\" options={['Student', { value: 'x', label: 'Other' }]} />",
  '        <When field="role" equals="Student">',
  '          <Checkbox name="ok">',
  '            I agree',
  '          </Checkbox>',
  '        </When>',
  '      </Page>',
  '    </Form>',
  '  );',
  '}',
].join('\n');

const parses = (source: string) => (parseSource(source).errors ?? []).length === 0;
const pick = (key: string, owner: string) =>
  findTextSlots(FORM).find((s) => s.key === key && s.owner === owner);

describe('text slots', () => {
  it('finds labels, children, option labels and config text — not values', () => {
    const values = findTextSlots(FORM).map((s) => `${s.owner}.${s.key}=${s.value}`);
    expect(values).toEqual([
      'config.title=Meetup',
      "config.success.title=You're in!",
      'Page.title=About you',
      'Text.label=Name',
      'Text.description=As on your ID.',
      'Select.label=Role',
      'Select.label=Other',
      'Checkbox.children=I agree',
    ]);
  });

  it('anchors element text on its element and config text on its property', () => {
    expect(pick('label', 'Text')?.anchor).toEqual({ line: 11, column: 9 });
    expect(pick('title', 'config')?.anchor).toEqual({ line: 3, column: 3 });
  });

  it('matches shown text, preferring the picked element', () => {
    const [title] = slotsForText(FORM, { line: 9, column: 5 }, 'About  you');
    expect(title?.owner).toBe('Page');
    expect(slotsForText(FORM, { line: 9, column: 5 }, 'Meetup')[0]?.owner).toBe('config');
    expect(slotsForText(FORM, null, 'Student')).toEqual([]);
  });

  it("lists an element's own text, and the form's title for <Form>", () => {
    expect(slotsOfElement(FORM, 11, 9).map((s) => s.key)).toEqual(['label', 'description']);
    expect(slotsOfElement(FORM, 9, 5).map((s) => s.key)).toEqual(['title']);
  });

  const name = pick('label', 'Text') as TextSlot;

  it('rewrites attributes, text and strings in place', () => {
    const agree = pick('children', 'Checkbox') as TextSlot;
    let out = replaceText(FORM, name.line, name.column, 'Name', 'Full name').source;
    expect(out).toContain('label="Full name"');
    out = replaceText(out, agree.line, agree.column, 'I agree', 'I agree to the <rules>').source;
    expect(out).toContain("            {'I agree to the <rules>'}\n          </Checkbox>");
    out = replaceText(out, 3, 10, 'Meetup', "Dev's meetup").source;
    expect(out).toContain("title: 'Dev\\'s meetup',");
    expect(parses(out)).toBe(true);
    expect(out.split('\n')).toHaveLength(FORM.split('\n').length);
  });

  it('switches quotes where an attribute cannot hold the text', () => {
    const out = replaceText(FORM, name.line, name.column, 'Name', 'Your "name"').source;
    expect(out).toContain('label=\'Your "name"\'');
    const amp = replaceText(FORM, name.line, name.column, 'Name', 'Name & surname').source;
    expect(amp).toContain("label={'Name & surname'}");
  });

  it('refuses stale or empty edits', () => {
    expect(() => replaceText(FORM, name.line, name.column, 'Nom', 'Name')).toThrow(/changed/);
    expect(() => replaceText(FORM, name.line, name.column, 'Name', '  ')).toThrow(/empty/);
    expect(() => replaceText(FORM, 13, 34, 'Student', 'Pupil')).toThrow(/No editable text/);
  });

  it('names each element by its tag and field name', () => {
    const names = elementNames(FORM);
    expect(names.get('9:5')).toEqual({ tag: 'Form' });
    expect(names.get('11:9')).toEqual({ tag: 'Text', name: 'name' });
  });
});
