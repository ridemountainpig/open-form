import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { defineForm, validateSubmission } from '../schema/index.ts';
import { collectFormSchema } from './collect.tsx';
import { createCollection } from './collector.ts';
import { CollectorContext } from './context.ts';
import {
  Checkbox,
  Email,
  FieldShell,
  Form,
  FormRuntimeContext,
  type NoticeUIProps,
  NumberInput,
  Page,
  RadioGroup,
  Rating,
  Row,
  Select,
  Submit,
  T,
  Text,
  useField,
  useFieldValue,
  useFormValues,
  When,
} from './index.ts';

function Stars({ name, label }: { name: string; label: string }) {
  const field = useField({
    name,
    label,
    type: 'custom',
    required: true,
    validate: () => undefined,
  });
  return (
    <FieldShell field={field}>
      <span>{String(field.value ?? '')}</span>
    </FieldShell>
  );
}

const config = defineForm({ title: 'Meetup', description: 'Join us' });

function Meetup() {
  return (
    <Form>
      <Page title="About you">
        <Row>
          <Text name="first" label="First name" required />
          <Text name="last" label="Last name" />
        </Row>
        <Email name="email" label="Email" required />
      </Page>
      <Page title="Background">
        <Select name="role" label="Role" options={['Student', 'Engineer']} required />
        <When field="role" equals="Student">
          <Text name="school" label="School" required />
        </When>
        {['frontend', 'backend'].map((area) => (
          <NumberInput key={area} name={`years_${area}`} label={area} min={0} integer />
        ))}
      </Page>
      <When field="role" equals="Engineer">
        <Page title="Work">
          <Text name="company" label="Company" />
          <Stars name="vibe" label="Vibe" />
        </Page>
      </When>
      <Page title="Wrap up">
        <Rating name="excitement" label="Excitement" max={5} />
        <Checkbox name="coc" label="I agree to the code of conduct" required />
        <Submit>Register</Submit>
      </Page>
    </Form>
  );
}

describe('collectFormSchema', () => {
  it('derives pages, fields and conditions from a real render', () => {
    const { schema, validators } = collectFormSchema(Meetup, { id: 'meetup', config });

    expect(schema.title).toBe('Meetup');
    expect(schema.pages).toEqual([
      { index: 0, title: 'About you', when: [] },
      { index: 1, title: 'Background', when: [] },
      { index: 2, title: 'Work', when: [{ field: 'role', equals: 'Engineer' }] },
      { index: 3, title: 'Wrap up', when: [] },
    ]);

    const byName = Object.fromEntries(schema.fields.map((f) => [f.name, f]));
    expect(Object.keys(byName)).toEqual([
      'first',
      'last',
      'email',
      'role',
      'school',
      'years_frontend',
      'years_backend',
      'company',
      'vibe',
      'excitement',
      'coc',
    ]);
    expect(byName.role).toMatchObject({
      type: 'select',
      page: 1,
      required: true,
      options: [
        { value: 'Student', label: 'Student' },
        { value: 'Engineer', label: 'Engineer' },
      ],
    });
    expect(byName.school).toMatchObject({ page: 1, when: [{ field: 'role', equals: 'Student' }] });
    expect(byName.years_backend).toMatchObject({ type: 'number', min: 0, integer: true });
    expect(byName.vibe).toMatchObject({
      type: 'custom',
      page: 2,
      when: [{ field: 'role', equals: 'Engineer' }],
      hasCustomValidator: true,
    });
    expect(byName.excitement).toMatchObject({ type: 'number', min: 1, max: 5, integer: true });
    expect(validators.has('vibe')).toBe(true);
  });

  it('rejects modules that do not render a Form', () => {
    expect(() => collectFormSchema(() => <div />, { id: 'x' })).toThrow(/must render a <Form>/);
  });

  it('stops a form that renders itself', () => {
    function Contact(): React.ReactElement {
      return (
        <Form>
          <Contact />
        </Form>
      );
    }
    expect(() => collectFormSchema(Contact, { id: 'contact' })).toThrow(/exactly one <Form>/);
  });

  it('rejects one name used with two types', () => {
    const Bad = () => (
      <Form>
        <Text name="a" />
        <NumberInput name="a" />
      </Form>
    );
    expect(() => collectFormSchema(Bad, { id: 'bad' })).toThrow(/both text and number/);
  });

  it('lets one name live in exclusive branches, each with its own validator', async () => {
    const us = (v: unknown) => (/^\d{5}$/.test(String(v)) ? undefined : 'US zip');
    const ca = (v: unknown) =>
      /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/.test(String(v)) ? undefined : 'CA postal';
    const Address = () => (
      <Form>
        <Select name="country" options={['US', 'CA']} />
        <When field="country" equals="US">
          <Text name="postal" validate={us} />
        </When>
        <When field="country" equals="CA">
          <Text name="postal" validate={ca} />
        </When>
      </Form>
    );
    const { schema, validators } = collectFormSchema(Address, { id: 'address' });
    const check = (answers: Record<string, string>) =>
      validateSubmission(schema, answers, { validators });
    expect((await check({ country: 'CA', postal: 'K1A 0B1' })).ok).toBe(true);
    expect((await check({ country: 'US', postal: '10001' })).ok).toBe(true);
    const wrong = await check({ country: 'CA', postal: '10001' });
    expect(!wrong.ok && wrong.errors).toEqual({ postal: 'CA postal' });
  });

  it('rejects one name rendered twice where both copies show', () => {
    const Twice = () => (
      <Form>
        <Page>
          <Text name="email" />
        </Page>
        <Page>
          <Text name="email" />
        </Page>
      </Form>
    );
    expect(() => collectFormSchema(Twice, { id: 'twice' })).toThrow(
      /"email" is rendered twice under the same conditions/,
    );
  });

  it('rejects fields the server could not check as written', () => {
    const Broken = () => (
      <Form>
        <Select name="plan" options={[]} />
        <RadioGroup name="size" options={[]} />
        <Text name="code" pattern="(" />
        <Text name="__proto__" />
      </Form>
    );
    const run = () => collectFormSchema(Broken, { id: 'broken' });
    expect(run).toThrow(/"plan" \(select\) has no options/);
    expect(run).toThrow(/"size" \(radio\) has no options/);
    expect(run).toThrow(/"code": pattern "\(" isn't a valid regular expression/);
    expect(run).toThrow(/"__proto__" is reserved/);
  });

  it('keeps patterns browsers accept without the u flag, and number steps', () => {
    const Ok = () => (
      <Form>
        <Text name="phone" pattern="\d{3}\-\d{4}" />
        <NumberInput name="price" min={0} step={0.5} />
      </Form>
    );
    const { schema } = collectFormSchema(Ok, { id: 'ok' });
    expect(schema.fields[1]).toMatchObject({ name: 'price', type: 'number', min: 0, step: 0.5 });
  });

  it('collects the same schema from a render that runs twice, when deduping', () => {
    const collection = createCollection(config, { dedupe: true });
    for (let i = 0; i < 2; i++) {
      renderToString(
        <FormRuntimeContext.Provider value={{ mode: 'collect', formId: 'meetup', config }}>
          <CollectorContext.Provider value={collection.collector}>
            <Meetup />
          </CollectorContext.Provider>
        </FormRuntimeContext.Provider>,
      );
    }
    const { collected, problems } = collection.finish('meetup');
    expect(problems).toEqual([]);
    expect(collected.schema).toEqual(collectFormSchema(Meetup, { id: 'meetup', config }).schema);
  });
});

describe('interactive render', () => {
  it('renders the first step with progress and accessible labels', () => {
    const html = renderToString(
      <FormRuntimeContext.Provider value={{ mode: 'interactive', config }}>
        <Meetup />
      </FormRuntimeContext.Provider>,
    );
    expect(html).toContain('Step 1 of 3');
    expect(html).toContain('About you');
    expect(html).not.toContain('Background');
    expect(html).toMatch(/<label class="of-label" for="of-email-[^"]+">Email/);
    expect(html).toContain('aria-required="true"');
    expect(html).toContain('>Next<');
  });

  it('renders a single-page form without progress', () => {
    const Contact = () => (
      <Form title="Contact">
        <Email name="email" label="Email" required />
        <Submit>Send</Submit>
      </Form>
    );
    const html = renderToString(<Contact />);
    expect(html).not.toContain('of-progress');
    expect(html).toContain('>Send<');
  });

  it('renders an aside that reads answers, and a forced color scheme', () => {
    function Summary() {
      const name = useFieldValue<string>('name');
      const values = useFormValues();
      return (
        <p>
          Hi {name} ({Object.keys(values).length})
        </p>
      );
    }
    const Pass = () => (
      <Form aside={<Summary />} defaultValues={{ name: 'Amy', role: 'Student' }}>
        <Text name="name" label="Name" />
      </Form>
    );
    const html = renderToString(
      <FormRuntimeContext.Provider
        value={{ mode: 'interactive', theme: { colorScheme: 'dark' }, themeId: 'night' }}
      >
        <Pass />
      </FormRuntimeContext.Provider>,
    );
    expect(html).toContain('data-scheme="dark"');
    expect(html).toContain('data-aside=""');
    expect(html).toMatch(
      /<aside class="of-aside"><p>Hi <!-- -->Amy<!-- --> \(<!-- -->2<!-- -->\)<\/p><\/aside>/,
    );
    expect(html).toContain('.of-root[data-of-theme="night"]{color-scheme:dark}');
  });

  it('keeps the aside out of the collected schema', () => {
    const Pass = () => (
      <Form aside={<Text name="sneaky" />}>
        <Text name="name" />
      </Form>
    );
    const { schema } = collectFormSchema(Pass, { id: 'pass' });
    expect(schema.fields.map((f) => f.name)).toEqual(['name']);
  });
});

describe('translations', () => {
  const zh = defineForm({
    title: '報名',
    locale: 'zh-TW',
    translations: {
      en: {
        報名: 'Sign up',
        關於你: 'About you',
        姓名: 'Name',
        例如王小明: 'e.g. Alex Chen',
        身分: 'Role',
        學生: 'Student',
        工程師: 'Engineer',
        需要協助嗎: 'Need help?',
        送出報名: 'Register',
      },
    },
  });

  function Signup({ asRole }: { asRole?: string }) {
    return (
      <Form defaultValues={asRole ? { role: asRole } : undefined}>
        <Page title="關於你">
          <Text name="name" label="姓名" placeholder="例如王小明" required />
          <Select
            name="role"
            label="身分"
            options={[
              { value: 'student', label: '學生' },
              { value: 'engineer', label: '工程師' },
            ]}
          />
          <When field="role" equals="student">
            <Text name="school" label="學校" />
          </When>
          <T>需要協助嗎</T>
        </Page>
        <Submit>送出報名</Submit>
      </Form>
    );
  }

  it('collects every string respondents can see, conditional ones included', () => {
    const { texts, schema } = collectFormSchema(Signup, { id: 'signup', config: zh });
    expect(texts).toEqual(
      expect.arrayContaining([
        '報名',
        '關於你',
        '姓名',
        '例如王小明',
        '身分',
        '學生',
        '工程師',
        '學校',
        '需要協助嗎',
        '送出報名',
      ]),
    );
    // The schema keeps the source text: it names columns and versions the form.
    expect(schema.fields.find((f) => f.name === 'role')?.options?.[0]).toEqual({
      value: 'student',
      label: '學生',
    });
  });

  it('collects text that only some answers show', () => {
    function Followup() {
      const role = useFieldValue<string>('role');
      const score = useFieldValue<number>('score');
      return (
        <>
          {role === 'engineer' && <T>你用哪些工具</T>}
          {score !== undefined && score < 3 && <T>哪裡可以更好</T>}
        </>
      );
    }
    function Survey() {
      return (
        <Form>
          <Select
            name="role"
            label="身分"
            options={[
              { value: 'student', label: '學生' },
              { value: 'engineer', label: '工程師' },
            ]}
          />
          <NumberInput name="score" label="分數" min={0} max={5} />
          <Followup />
        </Form>
      );
    }
    const { texts } = collectFormSchema(Survey, { id: 'survey', config: zh });
    expect(texts).toEqual(expect.arrayContaining(['你用哪些工具', '哪裡可以更好']));
  });

  it('collects text that needs two answers at once', () => {
    function Both() {
      const role = useFieldValue<string>('role');
      const score = useFieldValue<number>('score');
      return role === 'engineer' && score === 4 ? <T>工程師給四分</T> : null;
    }
    function Survey() {
      return (
        <Form>
          <Select name="role" label="身分" options={['student', 'engineer']} />
          <NumberInput name="score" label="分數" min={0} max={5} />
          <Both />
        </Form>
      );
    }
    const { texts } = collectFormSchema(Survey, { id: 'survey', config: zh });
    expect(texts).toContain('工程師給四分');
  });

  it('collects the text of a custom closed screen', () => {
    function Closed({ state, title }: NoticeUIProps) {
      return <h2>{state === 'full' ? <T>名額已滿</T> : title}</h2>;
    }
    function Closable() {
      return (
        <Form components={{ Notice: Closed }}>
          <Text name="name" label="姓名" />
        </Form>
      );
    }
    const { texts } = collectFormSchema(Closable, { id: 'closable', config: zh });
    expect(texts).toContain('名額已滿');
  });

  it('renders the requested language, falling back to the source text', () => {
    const html = renderToString(
      <FormRuntimeContext.Provider
        value={{ mode: 'interactive', formId: 'signup', config: zh, requestedLocale: 'en' }}
      >
        <Signup asRole="student" />
      </FormRuntimeContext.Provider>,
    );
    expect(html).toContain('lang="en"');
    expect(html).toContain('>Sign up</h1>');
    expect(html).toContain('>About you</h2>');
    expect(html).toContain('placeholder="e.g. Alex Chen"');
    expect(html).toContain('>Student</option>');
    expect(html).toContain('value="student"');
    expect(html).toContain('Need help?');
    // Text with no translation stays readable in the source language.
    expect(html).toContain('>學校</label>');
    // A picker shows the current language by its own name; the list opens on click.
    expect(html).toContain('aria-haspopup="listbox"');
    expect(html).toContain('aria-label="Language: English"');
  });
});
