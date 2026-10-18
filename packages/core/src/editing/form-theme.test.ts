import { describe, expect, it } from 'vitest';
import { importsOwnTheme, wireFormTheme } from './form-theme.ts';

describe('wireFormTheme', () => {
  it('imports the look above the form’s own CSS and passes it to <Form>', () => {
    const source = `import { Form, Text } from '@open-form-build/core';
import './meetup.css';

export default function MeetupForm() {
  return (
    <Form className="mt-root">
      <Text name="name" label="Name" />
    </Form>
  );
}
`;
    expect(wireFormTheme(source)).toBe(`import { Form, Text } from '@open-form-build/core';
import theme from './theme/index.ts';
import './meetup.css';

export default function MeetupForm() {
  return (
    <Form theme={theme} className="mt-root">
      <Text name="name" label="Name" />
    </Form>
  );
}
`);
  });

  it('adds the import after the last one when the form has no CSS', () => {
    const wired = wireFormTheme(
      "import { Form } from '@open-form-build/core';\nexport default () => <Form />;\n",
    );
    expect(wired).toBe(
      "import { Form } from '@open-form-build/core';\nimport theme from './theme/index.ts';\nexport default () => <Form theme={theme} />;\n",
    );
  });

  it('keeps an existing import and theme prop', () => {
    const source =
      "import { Form } from '@open-form-build/core';\nimport look from './theme';\nexport default () => <Form>x</Form>;\n";
    expect(wireFormTheme(source)).toContain('<Form theme={look}>');
    const done =
      "import { Form } from '@open-form-build/core';\nimport theme from './theme/index.ts';\nexport default () => <Form theme={theme} />;\n";
    expect(wireFormTheme(done)).toBe(done);
  });

  it('needs exactly one <Form>', () => {
    expect(() => wireFormTheme('export default () => null;\n')).toThrow(/Could not find <Form>/);
    expect(() => wireFormTheme('export default () => <><Form /><Form /></>;\n')).toThrow(
      /more than one/,
    );
  });

  it('refuses a <Form> that already gets another theme', () => {
    const inline =
      "import { defineTheme, Form } from '@open-form-build/core';\nconst theme = defineTheme({});\nexport default () => <Form theme={theme} />;\n";
    expect(() => wireFormTheme(inline)).toThrow(/already gets theme=\{theme\}/);
    const shared =
      "import { Form } from '@open-form-build/core';\nimport brand from '../../themes/brand/index.tsx';\nexport default () => <Form theme={brand} />;\n";
    expect(() => wireFormTheme(shared)).toThrow(/already gets theme=\{brand\}/);
  });

  it('picks another name when `theme` is taken', () => {
    const wired = wireFormTheme(
      "import { Form } from '@open-form-build/core';\nconst theme = 'dark';\nexport default () => <Form className={theme} />;\n",
    );
    expect(wired).toContain("import formTheme from './theme/index.ts';");
    expect(wired).toContain('<Form theme={formTheme} className={theme} />');
  });
});

describe('importsOwnTheme', () => {
  it('spots an import of the form’s own theme folder', () => {
    expect(importsOwnTheme("import theme from './theme/index.tsx';")).toBe(true);
    expect(importsOwnTheme("import look from './theme';")).toBe(true);
    expect(importsOwnTheme("import theme from '../../themes/brand';")).toBe(false);
    expect(importsOwnTheme('const = ;')).toBe(false);
  });
});
