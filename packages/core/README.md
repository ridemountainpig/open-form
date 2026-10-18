# @open-form-build/core

**The form framework built for agents.** Your agent writes the questions and logic — Open Form provides the runtime, validation, responsive UI, submission API, spam protection, SQLite storage and a Responses Studio.

```bash
pnpm create open-form my-forms
cd my-forms
pnpm dev
```

`npm create open-form@latest my-forms` works too; then it's `npm run dev`. Init prints the commands for the package manager you ran it with. The CLI is `open-form`.

```tsx
// forms/meetup/index.tsx
import { defineForm, Email, Form, Page, Select, Submit, Text, When } from '@open-form-build/core';

export const config = defineForm({
  title: 'Developer Meetup',
  submissions: { maxResponses: 100, uniqueBy: 'email' },
});

export default function Meetup() {
  return (
    <Form>
      <Page title="About you">
        <Text name="name" label="Name" required />
        <Email name="email" label="Email" required />
      </Page>
      <Page title="Background">
        <Select name="role" label="Role" options={['Student', 'Engineer', 'Designer']} />
        <When field="role" equals="Student">
          <Text name="school" label="School" required />
        </When>
      </Page>
      <Submit>Register</Submit>
    </Form>
  );
}
```

## Entry points

| Import | What |
| --- | --- |
| `@open-form-build/core` | DSL for forms: `Form`, `Page`, `When`, fields, `useField`, `defineForm`, `defineTheme`, `defineConfig` |
| `@open-form-build/core/schema` | Framework-agnostic schema, conditions and validation |
| `@open-form-build/core/server` | Web-standard `(Request) => Response` handler and storage interface |
| `@open-form-build/core/sqlite` | `node:sqlite` storage adapter |
| `@open-form-build/core/node` | Node HTTP adapter and production server |
| `@open-form-build/core/vite` | The Vite config and project helpers the CLI is built on (`createViteConfig`, `findForms`, `loadUserConfig`) |
| `@open-form-build/core/next` | Next.js route handlers (`createOpenFormRoute`) |
| `@open-form-build/core/styles.css` | Runtime styles (when rendering forms in your own React app with `<FormHost>`) |
| `@open-form-build/core/env` | Types for images and CSS imported from forms (`*.svg`, `*.png`, `*.css`, …); the workspace `tsconfig.json` loads it with `"types": ["@open-form-build/core/env"]` |

## Next.js

Install `@open-form-build/core` and keep `forms/` (and optionally `open-form.config.ts`) at the root of your Next.js app; a form's look travels with it in `forms/<id>/theme/`. Then mount the API and render forms with `<FormHost>`:

```ts
// app/api/[...openform]/route.ts
import { createOpenFormRoute } from '@open-form-build/core/next';

export const { GET, POST, PUT, DELETE, OPTIONS } = createOpenFormRoute();
```

Don't add `export const dynamic` to the route: Next.js 16 rejects it when Cache Components is on, the default in new apps.

```tsx
// app/rsvp/rsvp-form.tsx
'use client';
import { FormHost } from '@open-form-build/core';
import '@open-form-build/core/styles.css';
import Rsvp, { config } from '../../forms/rsvp';

export function RsvpForm() {
  return <FormHost id="rsvp" form={Rsvp} config={config} />;
}
```

```json
{
  "scripts": {
    "dev": "open-form build --server-only --watch & next dev",
    "build": "open-form build --server-only && next build"
  }
}
```

On Windows `cmd`, `&` doesn't run the two in parallel; run `open-form build --server-only --watch` and `next dev` in two terminals instead.

App Router route handlers can't render the forms to learn their fields, so the route reads the server bundle `open-form build --server-only` writes to `dist/server/entry.js` (outside production it reloads it after each rebuild) — validation still comes from the same form files as the browser. Next.js can't trace that file, so with `output: 'standalone'` or on Vercel add `outputFileTracingIncludes: { '/api/*': ['./dist/server/**/*'] }` to `next.config`, and set `OPEN_FORM_SECRET`, since serverless functions can't write the `secret` file generated next to the database. Responses go to SQLite in `.open-form/` by default, which needs a persistent disk; pass `storage` for anything else. The admin API exists only when `OPEN_FORM_ADMIN_PASSWORD` is set or you pass `adminAuth` (for example `authorize: async () => isAdmin(await auth())`). On Vercel, pass `waitUntil: after` (from `next/server`) so webhooks finish after the response.

## CLI

`open-form init | dev | build [--server-only] [--watch] | start | create <id> [--theme] | delete <id> | list | check [id] | comments [id] | responses export <id> | theme list|check|add|font | sync:skills`

Every command except `init` loads `.env` from the current folder when there is one; variables already set in the environment win.

Requires Node.js 22.13+.

MIT
