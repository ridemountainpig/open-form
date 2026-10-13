import { describe, expect, it } from 'vitest';
import { componentName, starterForm, withoutControls } from './commands.ts';

describe('withoutControls', () => {
  it('neutralizes terminal escape sequences but keeps tabs and line breaks', () => {
    expect(withoutControls('a\u001b[2Jb\u001b]52;c;aGk=\u0007\tc\r\n\u009bd')).toBe(
      'a�[2Jb�]52;c;aGk=�\tc\r\n�d',
    );
  });
});

describe('componentName', () => {
  it('never matches an import of the starter or a global', () => {
    const imports = ['defineForm', 'Email', 'Form', 'Submit', 'Text', 'Textarea'];
    for (const id of ['form', 'email', 'text', 'submit', 'date', 'number', 'map', 'promise']) {
      const name = componentName(id);
      expect(imports).not.toContain(name);
      expect(name in globalThis, name).toBe(false);
      expect(name).toMatch(/^[A-Z][A-Za-z0-9]*$/);
    }
  });

  it('reads like the id', () => {
    expect(componentName('contact')).toBe('ContactForm');
    expect(componentName('event-registration')).toBe('EventRegistrationForm');
    expect(componentName('contact-form')).toBe('ContactForm');
    expect(componentName('form')).toBe('MyForm');
    expect(componentName('2026-survey')).toBe('Form2026Survey');
    expect(starterForm('email', 'Email')).toContain('export default function EmailForm()');
  });
});
