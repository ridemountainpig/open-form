import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { validateSubmission } from '../schema/index.ts';
import { collectFormSchema } from './collect.tsx';
import {
  type ChoiceGroupUIProps,
  defaultComponents,
  defineTheme,
  FieldShell,
  type FieldUIProps,
  Form,
  FormRuntimeContext,
  Matrix,
  type MatrixRowUIProps,
  RadioGroup,
  type SelectUIProps,
  Tel,
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

  it('records the slots the form renders, minus those <Form components> replaces', () => {
    const Survey = () => (
      <Form components={{ TextInput: UnderlineInput }}>
        <Text name="name" label="Name" required />
        <Tel name="phone" label="Phone" defaultCountry="TW" countries={['TW', 'HK']} />
        <Matrix label="Rate" columns={['Bad', 'Good']} rows={[{ name: 'speed', label: 'Speed' }]} />
      </Form>
    );
    expect(collectFormSchema(Survey, { id: 'x' }).components).toEqual([
      'Field',
      'Matrix',
      'MatrixRow',
      'PhoneInput',
      'Select',
    ]);
  });
});

describe('Tel with a country picker', () => {
  const Phone = () => (
    <Form>
      <Tel name="phone" label="Phone" defaultCountry="TW" countries={['TW', 'HK']} required />
    </Form>
  );

  it('renders the theme Select for the country beside the theme TextInput', () => {
    function PlainSelect({ field, options, value }: SelectUIProps) {
      return (
        <select {...field.controlProps} className="plain" value={value} onChange={() => {}}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
    }
    const html = render(
      <Form components={{ Select: PlainSelect, TextInput: UnderlineInput }}>
        <Tel name="phone" label="Phone" defaultCountry="TW" countries={['TW', 'HK']} />
      </Form>,
    );
    expect(html).toMatch(/<div class="of-phone"><select id="of-phone-[^"]+-country"/);
    expect(html).toContain('aria-label="Country code"');
    expect(html).toContain('<option value="TW" selected="">Taiwan +886</option>');
    expect(html).toContain('<option value="HK">Hong Kong SAR China +852</option>');
    expect(html).toMatch(/<input id="of-phone-[^"]+" class="underline" type="tel"/);
    expect(html).toMatch(/<label class="of-label" for="of-phone-[^"-]+"/);
  });

  it('lists every country in the form language when none are given', () => {
    const html = renderToString(
      <FormRuntimeContext.Provider value={{ mode: 'interactive', locale: 'zh-TW' }}>
        <Form>
          <Tel name="phone" label="電話" defaultCountry="TW" />
        </Form>
      </FormRuntimeContext.Provider>,
    );
    expect(html).toContain('aria-label="國碼"');
    expect(html).toContain('<option value="TW" selected="">台灣 +886</option>');
    expect(html.match(/<option value="[A-Z]{2}"/g)?.length).toBeGreaterThan(200);
  });

  it('collects an international field limited to the listed countries', () => {
    expect(collectFormSchema(Phone, { id: 'x' }).schema.fields[0]).toMatchObject({
      name: 'phone',
      type: 'tel',
      international: true,
      countries: ['TW', 'HK'],
      required: true,
    });
    const Plain = () => (
      <Form>
        <Tel name="phone" />
      </Form>
    );
    expect(collectFormSchema(Plain, { id: 'x' }).schema.fields[0]).not.toHaveProperty(
      'international',
    );
    expect(render(<Plain />)).not.toContain('class="of-phone"');
  });

  it('rejects unknown countries', () => {
    const Broken = () => (
      <Form>
        <Tel name="phone" defaultCountry={'XX' as 'TW'} />
      </Form>
    );
    expect(() => collectFormSchema(Broken, { id: 'x' })).toThrow(/unknown country "XX"/);
    const Outside = () => (
      <Form>
        <Tel name="phone" defaultCountry="TW" countries={['HK', 'MO']} />
      </Form>
    );
    expect(() => collectFormSchema(Outside, { id: 'x' })).toThrow(
      /`defaultCountry` "TW" isn't in `countries`/,
    );
  });

  it('stores a national default with its country code', () => {
    const html = render(
      <Form>
        <Tel name="phone" label="Phone" defaultCountry="TW" defaultValue="0912-345-678" />
      </Form>,
    );
    expect(html).toMatch(/<input[^>]+type="tel"[^>]+value="912345678"/);
  });
});

describe('Matrix', () => {
  const scale = [
    { value: '1', label: 'Poor' },
    { value: '2', label: 'Fine' },
    { value: '3', label: 'Great' },
  ];
  const Course = () => (
    <Form>
      <Matrix
        label="Rate the course"
        columns={scale}
        rows={[
          { name: 'content', label: 'Content' },
          { name: 'teacher', label: 'Teacher' },
          { name: 'venue', label: 'Venue', required: false },
        ]}
        required
      />
    </Form>
  );

  it('collects one single-choice field per row, sharing the columns', async () => {
    const { schema } = collectFormSchema(Course, { id: 'x' });
    expect(schema.fields.map((f) => [f.name, f.type, f.label, Boolean(f.required)])).toEqual([
      ['content', 'radio', 'Content', true],
      ['teacher', 'radio', 'Teacher', true],
      ['venue', 'radio', 'Venue', false],
    ]);
    expect(schema.fields[0]?.options).toEqual(scale);
    const result = await validateSubmission(schema, { content: '3', teacher: '4' });
    expect(result).toMatchObject({
      ok: false,
      errors: { teacher: 'Choose one of the listed options.' },
    });
  });

  it('renders column headings once and a labelled radio per cell', () => {
    const html = render(<Course />);
    expect(html).toContain('<legend class="of-label">Rate the course</legend>');
    expect(html).toContain(
      '<div class="of-matrix-head" aria-hidden="true"><span></span><span>Poor</span><span>Fine</span><span>Great</span></div>',
    );
    expect(html).toMatch(/role="radiogroup" aria-labelledby="of-content-[^"]+-label"/);
    expect(html).toMatch(/<input type="radio" class="of-radio" name="teacher" value="2"/);
    expect(html).toContain('<span class="of-matrix-option">Great</span>');
  });

  it('marks required rows one by one when only some are required', () => {
    const Mixed = () => (
      <Form>
        <Matrix
          label="Rate"
          columns={scale}
          rows={[
            { name: 'a', label: 'A', required: true },
            { name: 'b', label: 'B' },
          ]}
        />
      </Form>
    );
    const html = render(<Mixed />);
    expect(html).toContain('<legend class="of-label">Rate</legend>');
    expect(html).toMatch(/>A<span class="of-required"/);
    expect(html).not.toMatch(/>B<span class="of-required"/);
  });

  it('lets a theme draw the rows', () => {
    function Stars({ field, columns, value }: MatrixRowUIProps) {
      return (
        <p className="stars">
          {field.label}: {columns.find((c) => c.value === value)?.label ?? '-'}
        </p>
      );
    }
    const html = render(<Course />, defineTheme({ components: { MatrixRow: Stars } }));
    expect(html).toContain('<p class="stars">Content<!-- -->: <!-- -->-</p>');
  });
});
