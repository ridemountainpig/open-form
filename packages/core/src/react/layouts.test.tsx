import type { ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  type ButtonUIProps,
  FocusLayout,
  Form,
  type FormRuntime,
  FormRuntimeContext,
  type LayoutUIProps,
  Page,
  SplitLayout,
  StepperLayout,
  Submit,
  Text,
  useFormNav,
} from './index.ts';

function Where() {
  const nav = useFormNav();
  return (
    <output>
      {nav.position + 1}/{nav.total} {nav.isFirst ? 'first' : ''}{' '}
      {nav.steps.map((s) => s.title).join('|')}
    </output>
  );
}

function Trip({ layout }: { layout?: (props: LayoutUIProps) => ReactNode }) {
  return (
    <Form title="Trip" components={layout ? { Layout: layout } : undefined}>
      <Page title="Who">
        <Text name="name" label="Name" />
        <Where />
      </Page>
      <Page>
        <Text name="city" label="City" />
      </Page>
      <Submit>Book</Submit>
    </Form>
  );
}

const render = (node: ReactNode, runtime: Partial<FormRuntime> = {}) =>
  renderToString(
    <FormRuntimeContext.Provider value={{ mode: 'interactive', ...runtime }}>
      {node}
    </FormRuntimeContext.Provider>,
  );

describe('theme scope', () => {
  it('keeps a crafted theme id out of the generated CSS selector', () => {
    const theme = { colorScheme: 'light' as const, colors: { primary: '#123456' } };
    const html = render(<Trip />, {
      themeId: 'x"]{}.of-root{outline:9px solid red}.z[a="',
      theme,
    });
    expect(html).not.toContain('outline:9px');
    expect(html).toContain('.of-root[data-of-theme="default"]');
    expect(render(<Trip />, { themeId: 'brand', theme })).toContain(
      '.of-root[data-of-theme="brand"]',
    );
  });

  it("scopes a form's own theme to the form and lets it win over the host's", () => {
    const own = { layout: 'plain' as const, colors: { primary: '#00aa55' } };
    const host = { colors: { primary: '#ff0000' } };
    const Own = () => (
      <Form theme={own}>
        <Text name="name" label="Name" />
      </Form>
    );
    const html = render(<Own />, { formId: 'meetup', themeId: 'brand', theme: host });
    expect(html).toContain('.of-root[data-of-theme="meetup"]{--of-primary:#00aa55}');
    expect(html).toContain('data-of-theme="meetup"');
    expect(html).toContain('data-layout="plain"');
    expect(html).not.toContain('#ff0000');
    expect(render(<Own />, { formId: 'x"]{}' })).toContain('.of-root[data-of-theme="default"]');
  });

  it("previews Studio's unsaved tokens over a form's own theme, keeping its components", () => {
    const own = {
      colors: { primary: '#00aa55' },
      components: { Header: () => <p>own header</p> },
    };
    const draft = { colors: { primary: '#123abc' } };
    const Own = () => (
      <Form theme={own}>
        <Text name="name" label="Name" />
      </Form>
    );
    const previewed = render(<Own />, { formId: 'meetup', preview: true, themeDraft: draft });
    expect(previewed).toContain('{--of-primary:#123abc}');
    expect(previewed).toContain('own header');
    const live = render(<Own />, { formId: 'meetup', themeDraft: draft });
    expect(live).toContain('{--of-primary:#00aa55}');
  });
});

describe('layout slots', () => {
  it('hands every region to a custom Layout inside the <form>', () => {
    function Bare(p: LayoutUIProps) {
      return (
        <main data-state={p.state} data-step={p.nav.position}>
          <div className="h">{p.header}</div>
          <div className="c">{p.content}</div>
          <div className="a">{p.actions}</div>
          {p.alert}
        </main>
      );
    }
    const html = render(<Trip layout={Bare} />);
    expect(html).toMatch(/<form class="of-frame"[^>]*><main data-state="form" data-step="0">/);
    expect(html).toContain(
      '<div class="h"><header class="of-header"><h1 class="of-title">Trip</h1>',
    );
    expect(html).toMatch(/<div class="c"><div class="of-step" tabindex="-1">/);
    expect(html).toContain('role="alert"');
    expect(html).not.toContain('of-progress');
  });

  it('exposes navigation state through useFormNav()', () => {
    const html = render(<Trip />);
    expect(html).toMatch(
      /<output>1<!-- -->\/<!-- -->2<!-- --> <!-- -->first<!-- --> <!-- -->Who\|Step 2<\/output>/,
    );
  });

  it('localizes generated step titles', () => {
    const html = render(<Trip />, { locale: 'zh-TW' });
    expect(html).toContain('Who|第 2 步');
  });

  it('replaces chrome components one at a time', () => {
    function Pill({ variant, ...props }: ButtonUIProps) {
      return <button {...props} className={`pill pill-${variant}`} />;
    }
    const html = render(
      <Form components={{ Button: Pill, Header: () => <h2>Custom header</h2> }}>
        <Text name="a" label="A" />
        <Submit>Go</Submit>
      </Form>,
    );
    expect(html).toContain('<h2>Custom header</h2>');
    expect(html).toContain('<button type="submit" class="pill pill-primary">Go</button>');
  });

  it('renders the Notice through the Layout when the form is closed', () => {
    const html = render(<Trip />, {
      availability: { state: 'closed', message: 'See you next year.' },
    });
    expect(html).toContain('data-state="unavailable"');
    expect(html).toContain('<p class="of-description">See you next year.</p>');
    expect(html).not.toContain('<form');
  });
});

describe('built-in layouts', () => {
  it('SplitLayout puts header and progress in a brand panel', () => {
    const html = render(<Trip layout={SplitLayout} />);
    expect(html).toMatch(
      /<section class="of-split-brand"><div class="of-split-brand-inner"><header/,
    );
    expect(html).toContain('Step 1 of 2');
  });

  it('StepperLayout lists steps with the current one marked', () => {
    const html = render(<Trip layout={StepperLayout} />);
    expect(html).toContain(
      '<li data-state="current"><button type="button" disabled="" aria-current="step">',
    );
    expect(html).toContain('<span class="of-stepper-title">Step 2</span>');
  });

  it('FocusLayout opens on a welcome screen with the title', () => {
    const html = render(<Trip layout={FocusLayout} />);
    expect(html).toContain('data-cover="true"');
    expect(html).toContain('<h1 class="of-title">Trip</h1>');
    expect(html).toContain('>Start</button>');
    expect(html).not.toContain('of-focus-count');
  });

  it('FocusLayout without a cover shows a step counter and the keyboard hint', () => {
    const html = render(<Trip layout={(props) => <FocusLayout {...props} cover={false} />} />);
    expect(html).toContain('<span class="of-focus-current">1</span>');
    expect(html).toContain('Step 1 of');
    expect(html).toContain('press Enter ↵');
    expect(html).toContain('for a new line');
  });
});
