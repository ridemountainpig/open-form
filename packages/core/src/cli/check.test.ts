import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stripVTControlCharacters } from 'node:util';
import { resolveConfig } from 'vite';
import { describe, expect, it } from 'vitest';
import type { FieldSchema, FormSchema } from '../schema/index.ts';
import { createViteConfig } from '../vite/config.ts';
import {
  checkForms,
  configSecretProblems,
  languageLines,
  uniqueWarnings,
  unusedComponentWarnings,
  withSsrServer,
} from './check.ts';

const email = (extra: Partial<FieldSchema> = {}): FieldSchema => ({
  name: 'email',
  type: 'email',
  page: 0,
  when: [],
  ...extra,
});
const form = (field: FieldSchema, uniqueBy = 'email') => ({
  schema: { id: 'f', pages: [{ index: 0, when: [] }], fields: [field] } as FormSchema,
  config: { submissions: { uniqueBy } },
});

describe('uniqueWarnings', () => {
  it('flags a uniqueBy field that can be left blank or hidden', () => {
    expect(uniqueWarnings(form(email({ required: true })))).toEqual([]);
    expect(uniqueWarnings(form(email()))[0]).toMatch(/blank or hidden/);
    expect(
      uniqueWarnings(form(email({ required: true, when: [{ field: 'x', equals: 'y' }] })))[0],
    ).toMatch(/blank or hidden/);
    expect(uniqueWarnings(form(email(), 'phone'))[0]).toMatch(/isn't a field/);
    expect(uniqueWarnings(form(email(), 'device'))).toEqual([]);
  });
});

describe('withSsrServer', () => {
  it("keeps its pre-bundled deps apart from a running dev server's", async () => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'open-form-ssr-'));
    try {
      const dev = await resolveConfig(
        await createViteConfig({ userCwd: root, config: {} }),
        'serve',
      );
      const ssr = await withSsrServer(root, async (server) => server.config.cacheDir);
      expect(ssr).not.toBe(dev.cacheDir);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('unusedComponentWarnings', () => {
  const C = () => null;
  const file = 'forms/f/theme/index.tsx';

  it('names theme components for parts the form never renders', () => {
    expect(
      unusedComponentWarnings(file, { TextInput: C, Rating: C, Select: C }, ['Field', 'TextInput']),
    ).toEqual([
      `${file} defines Rating, Select, but the form never uses them — a form's look holds only what it uses, so remove them.`,
    ]);
  });

  it('never flags chrome, and stays quiet when everything is used or nothing is known', () => {
    const chrome = { Layout: C, Header: C, Progress: C, Nav: C, Button: C, Success: C };
    expect(unusedComponentWarnings(file, { ...chrome, Notice: C, Field: C }, [])).toEqual([]);
    expect(unusedComponentWarnings(file, { TextInput: C }, ['TextInput'])).toEqual([]);
    expect(unusedComponentWarnings(file, { Rating: C }, undefined)).toEqual([]);
    expect(unusedComponentWarnings(file, undefined, ['TextInput'])).toEqual([]);
  });
});

describe('checkForms', () => {
  it("warns about the form's own theme components it never renders", async () => {
    // Inside the package, so the form resolves react the way an installed workspace does.
    const root = mkdtempSync(path.join(import.meta.dirname, '..', '..', '.check-'));
    try {
      const write = (file: string, text: string) => {
        mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
        writeFileSync(path.join(root, file), text);
      };
      write(
        'forms/rsvp/index.tsx',
        `import { Form, Text } from '@open-form-build/core';
import theme from './theme/index.tsx';
export default function RsvpForm() {
  return <Form theme={theme}><Text name="name" label="Name" /></Form>;
}
`,
      );
      write(
        'forms/rsvp/theme/index.tsx',
        `import { defineTheme } from '@open-form-build/core';
const Line = () => <input />;
export default defineTheme({ components: { Header: () => null, TextInput: Line, Rating: () => null } });
`,
      );
      write(
        'forms/waitlist/index.tsx',
        `import { Form, Text } from '@open-form-build/core';
export default function WaitlistForm() {
  return <Form><Text name="name" label="Name" /></Form>;
}
`,
      );
      write(
        'forms/waitlist/theme/index.ts',
        'export default { components: { Rating: () => null } };\n',
      );
      const [rsvp, waitlist] = await checkForms(root);
      expect(rsvp).toMatchObject({ id: 'rsvp', ok: true, theme: 'forms/rsvp/theme/index.tsx' });
      expect(rsvp?.ok && rsvp.warnings).toEqual([
        "forms/rsvp/theme/index.tsx defines Rating, but the form never uses it — a form's look holds only what it uses, so remove it.",
      ]);
      // A look file the form never imports is reported as such, not combed for unused parts.
      expect(waitlist).toMatchObject({ id: 'waitlist', ok: true, theme: null });
      expect(waitlist?.ok && waitlist.warnings).toEqual([
        "forms/waitlist/theme/index.ts isn't applied: forms/waitlist/index.tsx doesn't import it. Import it and pass it to <Form theme={theme}>, or delete it.",
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 30000);
});

describe('languageLines', () => {
  it('says how many unseen translations it left out', () => {
    const unused = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`old ${i}`, `舊 ${i}`]),
    );
    const definition = {
      schema: { id: 'f', pages: [], fields: [] },
      config: { language: 'en', translations: { 'zh-TW': { Hello: '你好', ...unused } } },
      texts: ['Hello'],
    } as unknown as Parameters<typeof languageLines>[0];
    const lines = languageLines(definition).map((line) => stripVTControlCharacters(line));
    expect(lines.filter((line) => line.includes('not seen "'))).toHaveLength(8);
    expect(lines.at(-1)).toMatch(/… 2 more/);
  });
});

describe('configSecretProblems', () => {
  it('flags a connection string with its password written into the config', () => {
    const problems = configSecretProblems(`import { defineConfig } from '@open-form-build/core';
export default defineConfig({
  storage: {
    url: 'postgres://app:s3cret@db.example.com:5432/forms',
  },
  webhooks: [{ url: \`https://user:token@hooks.example.com/\${'x'}\` }],
});
`);
    expect(problems).toHaveLength(2);
    expect(
      configSecretProblems(
        `export default { storage: { url: 'postgres://app@db/forms?sslmode=require&password=s3cret' } };`,
      ),
    ).toHaveLength(1);
    expect(problems[0]).toMatch(/^open-form\.config\.ts:4 holds a URL with a password/);
    expect(problems[0]).not.toContain('s3cret');
  });

  it('accepts URLs read from the environment, and URLs without a password', () => {
    expect(
      configSecretProblems(`export default {
  storage: { url: process.env.DATABASE_URL },
  webhooks: [
    { url: 'https://hooks.slack.com/services/T0/B0/x' },
    { url: 'https://example.com:8443/hook?to=me@example.com' },
    { url: 'postgres://app@localhost/forms' },
  ],
};`),
    ).toEqual([]);
  });
});
