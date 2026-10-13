import { describe, expect, it } from 'vitest';
import { cleanCommentText, insertComment, listComments, removeComment } from './comments.ts';
import { parseSource } from './loc-tags.ts';

const FORM = [
  "import { Email, Form, Text } from '@open-form-build/core';",
  'export default function Meetup() {',
  '  return (',
  '    <Form>',
  '      <Text name="name" label="Name" />',
  '      <Email name="email" label="Email" required />',
  '      <p>Hi <b>there</b></p>',
  '    </Form>',
  '  );',
  '}',
].join('\n');

const parses = (source: string) => (parseSource(source).errors ?? []).length === 0;

describe('form comments', () => {
  it('adds a marker line above an element inside JSX', () => {
    const { source } = insertComment(FORM, 6, 7, 'make this optional');
    expect(source.split('\n')[5]).toBe('      {/* @form-comment: make this optional */}');
    expect(source.split('\n')[6]).toBe('      <Email name="email" label="Email" required />');
    expect(parses(source)).toBe(true);
    expect(listComments(source)).toEqual([{ line: 6, text: 'make this optional' }]);
  });

  it('uses a plain comment where JSX is an expression', () => {
    const { source } = insertComment(FORM, 4, 5, 'shorter title');
    expect(source.split('\n')[3]).toBe('    /* @form-comment: shorter title */');
    expect(parses(source)).toBe(true);
  });

  it('comments elements that share a line', () => {
    const { source } = insertComment(FORM, 7, 13, 'bold is too much');
    expect(source.split('\n')[6]).toBe(
      '      <p>Hi {/* @form-comment: bold is too much */}<b>there</b></p>',
    );
    expect(parses(source)).toBe(true);
    expect(removeComment(source, 7)).toBe(FORM);
  });

  it('notes a property in config on its own line, and says lines moved', () => {
    const config = "export const config = defineForm({\n  title: 'Meetup',\n});";
    const result = insertComment(config, 2, 3, 'shorter');
    expect(result.source.split('\n')[1]).toBe('  /* @form-comment: shorter */');
    expect(result.shifted).toBe(true);
    expect(parses(result.source)).toBe(true);
    expect(insertComment(FORM, 7, 13, 'x').shifted).toBe(false);
  });

  it('removes a marker and its line', () => {
    const { source } = insertComment(FORM, 6, 7, 'x');
    expect(removeComment(source, 6)).toBe(FORM);
    expect(() => removeComment(FORM, 6)).toThrow(/No @form-comment/);
  });

  it('leaves the braces around an inline marker that belong to the code', () => {
    expect(removeComment("defineForm({/* @form-comment: x */ title: 'x' });", 1)).toBe(
      "defineForm({title: 'x' });",
    );
    expect(removeComment('<Page>{/* @form-comment: x */}<Text name="a" /></Page>', 1)).toBe(
      '<Page><Text name="a" /></Page>',
    );
  });

  it('keeps comment text on one line and unable to close the comment', () => {
    expect(cleanCommentText('  two\nlines */ {x}  ')).toBe('two lines * / {x}');
    expect(() => cleanCommentText('   ')).toThrow(/empty/);
    expect(() => cleanCommentText('x'.repeat(501))).toThrow(/500/);
    expect(() => insertComment(FORM, 2, 1, 'x')).toThrow(/No element/);
  });
});
