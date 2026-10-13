import { describe, expect, it } from 'vitest';
import { addLocTags } from './loc-tags.ts';

const FILE = 'forms/meetup/index.tsx';

describe('addLocTags', () => {
  it('stamps each element with file, line and column, keeping lines in place', () => {
    const source = [
      "import { Form, Text } from '@open-form-build/core';",
      'export default function Meetup() {',
      '  return (',
      '    <Form>',
      '      <Text name="name" label="Name" />',
      '      <div className="note">Hi</div>',
      '    </Form>',
      '  );',
      '}',
    ].join('\n');
    const out = addLocTags(source, FILE);
    expect(out.split('\n')).toHaveLength(9);
    expect(out).toContain(`<Form data-of-loc="${FILE}:4:5">`);
    expect(out).toContain(`<Text data-of-loc="${FILE}:5:7" name="name"`);
    expect(out).toContain(`<div data-of-loc="${FILE}:6:7" className="note">`);
    expect(out).toContain('</Form>');
  });

  it('skips fragments and elements already stamped, and keeps type arguments intact', () => {
    const source =
      'const a = <><Fragment key="k"><Ui.Fragment /><List<string> items={[]} /></Fragment></>;';
    const out = addLocTags(source, FILE);
    expect(out).toContain('<Fragment key="k">');
    expect(out).toContain('<Ui.Fragment />');
    expect(out).toContain(`<List<string> data-of-loc="${FILE}:1:`);
    expect(addLocTags(out, FILE)).toBe(out);
  });

  it('leaves code it cannot parse alone', () => {
    expect(addLocTags('const = <', FILE)).toBe('const = <');
  });
});
