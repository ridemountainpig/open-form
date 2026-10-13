import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { collectFormSchema } from './collect.tsx';
import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  FieldShell,
  type FieldUIProps,
  Form,
  FormRuntimeContext,
  RadioGroup,
  Text,
  type TextInputUIProps,
  useField,
} from './index.ts';

function UnderlineInput({ field, value, onChange, type }: TextInputUIProps) {
  return (
    <input
      {...field.controlProps}
      className="underline"
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CapsField({ field, children }: FieldUIProps) {
  return (
    <div className="caps">
      <span className="caps-label">{field.label?.toUpperCase()}</span>
      {children}
      {field.error && <em>{field.error}</em>}
    </div>
  );
}

function Chips({ options, selected }: ChoiceGroupUIProps) {
  return (
    <div className="chips">
      {options.map((o) => (
        <span key={o.value} data-on={selected.includes(o.value) || undefined}>
          {o.label}
        </span>
      ))}
    </div>
  );
}

function Rsvp() {
  return (
    <Form>
      <Text name="name" label="Name" required />
      <RadioGroup name="going" label="Going?" options={['Yes', 'No']} defaultValue="Yes" />
    </Form>
  );
}

const render = (node: React.ReactNode, theme?: ReturnType<typeof defineTheme>) =>
  renderToString(
    <FormRuntimeContext.Provider value={{ mode: 'interactive', theme }}>
      {node}
    </FormRuntimeContext.Provider>,
  );

describe('replaceable components', () => {
  it('uses theme components and keeps behavior wiring', () => {
    const theme = defineTheme({ components: { TextInput: UnderlineInput, Field: CapsField } });
    const html = render(<Rsvp />, theme);
    expect(html).toContain('<span class="caps-label">NAME</span>');
    expect(html).toMatch(
      /<input id="of-name-[^"]+" aria-required="true" class="underline" type="text" name="name"/,
    );
    expect(html).not.toContain('of-label');
  });

  it('lets <Form components> override the theme, one component at a time', () => {
    const theme = defineTheme({ components: { Field: CapsField } });
    const Themed = () => (
      <Form components={{ ChoiceGroup: Chips }}>
        <RadioGroup name="going" label="Going?" options={['Yes', 'No']} defaultValue="Yes" />
      </Form>
    );
    const html = render(<Themed />, theme);
    expect(html).toContain(
      '<div class="chips"><span data-on="true">Yes</span><span>No</span></div>',
    );
    expect(html).toContain('GOING?');
  });

  it('applies the theme Field to custom fields through FieldShell', () => {
    function Stars() {
      const field = useField({ name: 'stars', label: 'Stars' });
      return (
        <FieldShell field={field}>
          <b>★★★</b>
        </FieldShell>
      );
    }
    const html = render(
      <Form>
        <Stars />
      </Form>,
      defineTheme({ components: { Field: CapsField } }),
    );
    expect(html).toContain('<span class="caps-label">STARS</span><b>★★★</b>');
  });

  it('exposes the defaults for wrapping', () => {
    function Framed(props: TextInputUIProps) {
      return (
        <div className="frame">
          <defaultComponents.TextInput {...props} />
        </div>
      );
    }
    const html = render(
      <Form components={{ TextInput: Framed }}>
        <Text name="city" label="City" />
      </Form>,
    );
    expect(html).toMatch(/<div class="frame"><input id="of-city-/);
  });

  it("prefers the form's own theme, under <Form components>", () => {
    const own = defineTheme({ components: { Field: CapsField, ChoiceGroup: Chips } });
    const host = defineTheme({ components: { TextInput: UnderlineInput } });
    const Themed = () => (
      <Form theme={own} components={{ ChoiceGroup: defaultComponents.ChoiceGroup }}>
        <Text name="name" label="Name" />
        <RadioGroup name="going" label="Going?" options={['Yes', 'No']} />
      </Form>
    );
    const html = render(<Themed />, host);
    expect(html).toContain('<span class="caps-label">NAME</span>');
    expect(html).not.toContain('class="underline"');
    expect(html).not.toContain('class="chips"');
  });

  it("keeps a form's own theme out of schema collection", () => {
    function Broken(): never {
      throw new Error('theme components must not run while collecting');
    }
    const Themed = () => (
      <Form theme={defineTheme({ components: { Field: Broken, TextInput: Broken } })}>
        <Text name="name" label="Name" required />
        <RadioGroup name="going" label="Going?" options={['Yes', 'No']} />
      </Form>
    );
    expect(collectFormSchema(Themed, { id: 'x' }).schema.fields).toEqual(
      collectFormSchema(Rsvp, { id: 'x' }).schema.fields,
    );
  });

  it('does not change the collected schema', () => {
    const Themed = () => (
      <Form components={{ TextInput: UnderlineInput, ChoiceGroup: Chips }}>
        <Text name="name" label="Name" required />
        <RadioGroup name="going" label="Going?" options={['Yes', 'No']} />
      </Form>
    );
    const plain = collectFormSchema(Rsvp, { id: 'x' }).schema;
    const themed = collectFormSchema(Themed, { id: 'x' }).schema;
    expect(themed.fields).toEqual(plain.fields.map((f) => ({ ...f })));
  });
});
