# Open Form — Architecture

English · [繁體中文](./ARCHITECTURE.zh.md)

> **The form framework built for agents.**
> Your agent writes the questions and logic. Open Form handles everything that makes them a form.

```
Questions + Logic  →  Production-ready Form  →  Responses
```

This document describes Open Form's overall architecture, module boundaries and key design decisions. It carries over what we learned from [open-slide](https://github.com/open-slide/open-slide)'s architecture: **the user's workspace holds only the artifact (`forms/`); Vite, React and the server all live inside the framework package**.

---

## 1. Deviations from the original plan (and why)

Most technology choices from the original plan were kept, but six were adjusted based on open-slide's actual architecture and the current state of npm:

| Original plan | Adopted | Why |
| --- | --- | --- |
| Next.js | **Vite (hidden inside the package) + a Web-standard `fetch` handler** | The core lesson from open-slide: the user's repo has only `forms/`, `open-form.config.ts` and `package.json` — no `app/`, no `next.config`. Next.js requires `app/` to live in the user's project, so it can't hide the whole app in `node_modules` the way Vite can. The server is written as `(Request) => Response`, so it can still be mounted in a Next.js Route Handler (the `@open-form-build/core/next` adapter, see §7). |
| 10 `@open-form/*` packages | **Two published packages under the `@open-form-build` npm org: `@open-form-build/core` (the framework, layered internally + subpath exports, with the `open-form` CLI) and `@open-form-build/cli` (the scaffolder), plus unscoped `create-open-form` for `npm create open-form`** | `@open-form/core` and `@open-form/cli` are already registered on npm by someone else, so we don't control the scope, and npm refuses unscoped `open-form` as too similar to the existing `openform`. Like open-slide (`@open-slide/core` + `@open-slide/cli`), workspaces depend on and import `@open-form-build/core`, and `npx @open-form-build/cli init` scaffolds one. Unlike open-slide, `create-open-form` also gives the `npm create open-form@latest` / `pnpm create open-form` convention; it runs the same `init`. Layers live in `src/<layer>/` with the dependency direction enforced by Biome `noRestrictedImports`, and are exposed through subpaths such as `@open-form-build/core`, `@open-form-build/core/schema`, `@open-form-build/core/server` and `@open-form-build/core/sqlite`. If we ever need to split into packages, the boundaries are already there. |
| Drizzle + SQLite driver | **`node:sqlite` (built into Node) + a hand-written storage adapter over 4 tables** | "Zero infrastructure to start": no native addon (better-sqlite3 needs compiling) and no ORM. With 4 tables and a dozen or so queries, an ORM only adds install size. Drizzle will be re-evaluated in the Postgres adapter phase. |
| Zod | **A built-in lightweight validation engine + Standard Schema support** | Client and server must run **the same** validation logic, and the schema must be serializable into the DB. The built-in engine handles required / length / pattern / range / options; the `validate` escape hatch accepts a function or any [Standard Schema](https://standardschema.dev) (implemented by Zod, Valibot and ArkType), so Zod works but isn't a dependency. |
| Radix / shadcn | **Native inputs + CSS variables for the form runtime; Tailwind for Studio** | Native `<select>` and `<input type=radio>` have the best a11y and experience on mobile, and the runtime stays at zero extra dependencies so it can be embedded in any React app. Studio (our own UI) follows open-slide's Tailwind approach. |
| `<Number />`, `<Date />` | **`<NumberInput />`, `<DateInput />`** | `import { Number, Date }` shadows the JS globals `Number()` / `new Date()` in the same file (Biome's `noShadowRestrictedNames` flags it too). Agents often write `Number(v)` inside validators; the rename avoids that trap. |

---

## 2. Repo layout

```text
open-form/                         ← this repo (pnpm + Turborepo monorepo)
├── packages/
│   ├── core/                      ← the framework published to npm (package name: @open-form-build/core)
│   │   ├── src/
│   │   │   ├── schema/            pure TS: FormSchema, validation, conditions, policy, config types
│   │   │   ├── react/             form runtime + DSL components + schema collector (browser-safe)
│   │   │   ├── server/            Web-standard fetch handler, submission pipeline, protection, export
│   │   │   ├── storage/           StorageAdapter interface + in-memory adapter (for tests)
│   │   │   ├── sqlite/            node:sqlite adapter (default storage)
│   │   │   ├── node/              Node http adapter, production server, secret management
│   │   │   ├── next/              `@open-form-build/core/next`: Next.js App Router route handler
│   │   │   ├── vite/              Vite plugin: form discovery, virtual modules, dev API middleware
│   │   │   ├── editing/           dev write-back to source (Babel AST): submission settings, theme tokens, text, translations, comments, folders, loc markers
│   │   │   ├── cli/               `open-form` CLI: init / dev / build / start / create / check / comments / list /
│   │   │   │                      responses export / theme list|check|add|font / sync:skills
│   │   │   ├── app/               hidden Vite app (shipped as source): public form page + Studio
│   │   │   └── index.ts           public DSL entry imported by forms
│   │   ├── themes/                starter themes (classic, editorial, terminal, brutalist, conversational): references for `theme add` and `create --theme`
│   │   ├── skills/                built-in agent skills (create-form, create-theme, form-authoring, current-form, apply-comments)
│   │   ├── template/              workspace template for `open-form init`
│   │   └── e2e/                   smoke test: scaffold → build → start → submit → export
│   ├── cli/                       ← @open-form-build/cli: `npx @open-form-build/cli init` runs core's CLI
│   └── create-open-form/          ← create-open-form: `npm create open-form@latest` runs core's `init`
├── apps/
│   └── demo/                      dogfood workspace, uses the local framework via workspace:*
└── docs/
    ├── ARCHITECTURE.md            this document
    ├── ARCHITECTURE.zh.md         Traditional Chinese version
    ├── ROADMAP.md
    └── ROADMAP.zh.md
```

A user workspace (generated by `npm create open-form@latest my-forms`):

```text
my-forms/
├── forms/
│   └── event-registration/
│       ├── index.tsx              ← where the agent writes
│       └── theme/                 ← the form's own look (tokens + the CSS and components it uses), only this form uses it
├── themes/
│   └── <id>/index.tsx + THEME.md  ← references for new forms (a starter added with theme add, or made by create-theme)
├── open-form.config.ts
├── AGENTS.md  (CLAUDE.md → AGENTS.md)
├── .agents/skills/                ← built-in skills (.claude/skills is a symlink)
├── .open-form/                    ← runtime data, gitignored
│   ├── open-form.db
│   └── secret
├── package.json
└── tsconfig.json
```

**Repo owns the artifact. Runtime data stays yours.** Git holds the questions, logic, validation, theme and submission policy; `.open-form/` holds responses, visitor hashes and rate-limit state, and never goes into git.

---

## 3. Layers and dependency direction

```text
                 schema   (pure TS: no React, no Node APIs)
                ↗      ↖
            react      server ──→ storage (interface)
              ↑          ↑           ↑
             app         │        sqlite (node:sqlite)
                         │           ↑
                       node ─────────┘      Node http adapter, production server
                       ↑  ↑
                    next  vite ⇄ editing    dev middleware; editing writes back to source via Babel AST
                           ↑
                          cli
```

| Layer | May import | May not import | Public subpath |
| --- | --- | --- | --- |
| `schema/` | — | react, node:*, other layers | `@open-form-build/core/schema` |
| `react/` | `schema/`, react | node:*, server, storage, sqlite, node, vite, cli | `open-form` (DSL) |
| `storage/` | `schema/` | react, node:*, other layers | `@open-form-build/core/server` (types, `createMemoryStorage`) |
| `server/` | `schema/`, `storage/` | react, node:*, sqlite, node, vite, cli, app | `@open-form-build/core/server` |
| `sqlite/` | `storage/`, `schema/`, node:sqlite | react (by convention) | `@open-form-build/core/sqlite` |
| `node/` | `server/`, `sqlite/`, `schema/`, node:* | — | `@open-form-build/core/node` |
| `next/` | `node/`, `server/`, `sqlite/`, `schema/` | — | `@open-form-build/core/next` |
| `editing/` | `schema/`, `vite/project.ts`, `@babel/parser`, node:* | — | (internal, used by vite / cli) |
| `vite/`, `cli/` | everything | — | `@open-form-build/core/vite` (internal) |
| `app/` | `react/`, `schema/`; from `editing/` only pure data and types (`folder-colors.ts`, the types in `folders.ts`) | node:*, server, storage, sqlite, node, vite, cli | (compiled by Vite, not public) |

There are also `@open-form-build/core/styles.css` (the runtime's base styles) and `@open-form-build/core/env` (ambient types for assets such as images that forms import; the workspace tsconfig pulls it in via `types`).

`server/` depends only on Web standards (`Request`, `Response`, `crypto.subtle`), so the same handler runs in Vite dev middleware, the Node production server and a Next.js Route Handler (`@open-form-build/core/next`), and could later run on Cloudflare Workers or Bun.

The `noRestrictedImports` overrides in `biome.json` enforce three of these groups: `schema/`, `react/` + `app/`, and `server/` + `storage/` (the "May not import" column above). `sqlite/`, `node/`, `next/`, `editing/`, `vite/` and `cli/` have no lint rules and are kept in line by convention.

---

## 4. Form file contract

```tsx
// forms/meetup/index.tsx
import { defineForm, Email, Form, Page, Select, Submit, Text, When } from '@open-form-build/core';

export const config = defineForm({
  title: 'Developer Meetup Registration',
  description: 'Join us on Oct 30 in Taipei.',
  submissions: { maxResponses: 100, uniqueBy: 'email', closesAt: '2026-10-30' },
});

export default function Meetup() {
  return (
    <Form>
      <Page title="About you">
        <Text name="name" label="Name" required />
        <Email name="email" label="Email" required />
      </Page>
      <Page title="Background">
        <Select name="role" label="Role" options={['Student', 'Engineer', 'Designer']} required />
        <When field="role" equals="Student">
          <Text name="school" label="School" required />
        </When>
      </Page>
      <Submit>Register</Submit>
    </Form>
  );
}
```

- `forms/<kebab-id>/index.tsx`: the `id` is the folder name and also the public URL, `/f/<id>`.
- `export const config = defineForm({...})`: title, submission policy, protection, success message. **All server-side rules live here.**
- `export default` a React component that returns `<Form>`. It can contain any React (custom components, `.map()`, `<div>` layout), as long as fields use DSL components or `useField()`.

---

## 5. Schema: TSX is the source of truth, the schema is derived

Server validation, the Responses columns, version history and export all need a serializable schema. Open Form doesn't do static AST analysis (which breaks down on custom components and `.map()`); it uses **render-to-collect** instead:

```text
forms/<id>/index.tsx
        │  (dev: Vite ssrLoadModule / prod: Vite SSR build)
        ▼
renderToString(<CollectProvider><FormComponent/></CollectProvider>)
        │  in collect mode:
        │   • <Form> renders *every* Page
        │   • <When> doesn't evaluate its condition; it pushes it onto a context stack and renders its children
        │   • every field (including custom components via useField) registers itself with the collector
        ▼
FormSchema { id, title, pages[], fields[{ name, type, label, required, options, page, when[] … }] }
        │
        ├─→ version = schemaVersion(): cyrb53 hash of stable JSON, 12 hex chars (synchronous; a fingerprint, not for security)
        ├─→ server validation (including custom validate functions, since the server really loads the module)
        ├─→ form_versions table (each submission records the schema version at that moment)
        └─→ Studio responses columns / CSV and Excel export columns
```

Client and server share `evaluateCondition()`, `validateField()` and `resolveVisibleFields()` from `schema/`, which guarantees that "the frontend says this can be submitted" and "the backend accepts it" always agree. The browser repeats the collect render once on load (into a detached node), so it holds the same schema as the server; `<When>`, step visibility, custom validators' `allValues`, `onSubmit` values and server-error routing all come from `coerceValues` + `resolveVisibleFields`.

---

## 6. Form Runtime (client)

`<Form>` owns a small external store (`useSyncExternalStore`; each field subscribes only to its own value):

- **State**: values, errors, touched, step, status (idle / submitting / success / error).
- **Multi-step**: `<Form>` splits its top-level children into steps (each `<Page>` is a step; a `<Page>` wrapped in `<When>` is a conditional step and is skipped automatically when its condition is false). Without any `<Page>`, it's a single-page form.
- **Validation**: fields register with a registry when they mount; pressing Next validates "the currently mounted fields" (hidden `<When>` fields aren't validated); on error, focus moves to the first invalid field.
- **Conditional**: `<When>` subscribes to the values of the fields it depends on; hidden fields keep their values in state (nothing is lost when switching back), conditions read the coerced answers of visible fields only, and the server strips hidden fields by condition on submit.
- **Submission**: `POST /api/forms/:id/submissions` with the protection token and honeypot; field errors returned by the server are routed back to the matching step.
- **UX**: progress, Back/Next, Enter to advance, focus management, `aria-invalid` / `aria-describedby`, loading, success, error, closed / full states.
- **Theme**: CSS variables (`--of-*`), overridden by the form's own `defineTheme()` in `forms/<id>/theme/index.tsx`, passed as `<Form theme>`.

### Appearance components (v0.2)

Built-in fields handle only **behavior** (`useField`: value, validation, focus, ARIA); **appearance** is delegated to replaceable components:

```text
<Text name="email" required />
   │  behavior: useField → value / setValue / error / controlProps / ref
   ▼
components.Field      ← label / description / error
  └ components.TextInput  ← the actual <input>
```

| Component | Built-in fields |
| --- | --- |
| `Field` | The wrapper for every field (`FieldShell` uses it too, so custom fields follow the theme) |
| `TextInput` | `Text`, `Email`, `Url`, `Tel`, `NumberInput`, `DateInput` |
| `Textarea`, `Select`, `ChoiceGroup`, `Checkbox`, `Rating` | The fields of the same name; `ChoiceGroup` covers both `RadioGroup` and `CheckboxGroup` |

Override order: `defaultComponents` ← the theme's `components` ← `<Form components>`. The theme comes from `<Form theme>` (the form's own look), else from a host (`FormHost`, the landing site, Studio's theme preview) through `runtime.theme`. A form's own theme is scoped to the form: the root gets `data-of-theme="<form-id>"`. It's imported by the form module, so it loads with the form (no second request) and also sits in the server bundle (its CSS is dropped there). Render-to-collect never applies theme components, so the field list the server reads is unaffected by appearance; field registration happens in the behavior layer.

### Layout and chrome (v0.2 Step 2)

The form's "chrome" is made of replaceable components too: `Layout`, `LanguageSwitch`, `Header`, `Progress`, `Nav`, `Button`, `Success`, `Notice`.

```text
<form class="of-frame">            ← framework: submit, Enter, honeypot (display: contents)
  <Layout state nav …regions />    ← decides the arrangement
     header    = <Header/>
     progress  = <Progress/>
     content   = <div class="of-step">current step</div>   ← rendered by the framework: focus, scope, field registration
                 (or <Success/> on success, <Notice/> when closed)
     alert     = live region (form-level errors)
     actions   = <Nav/> → <Button/>
     aside     = <Form aside>
```

`useFormNav()` exposes the current step, the list of visible steps, and `next()` / `back()` / `goTo()`. Three layouts are built in: `StepperLayout` (side steps), `SplitLayout` (brand panel) and `FocusLayout` (one question at a time; the form's title / description is shown first as a welcome screen, disabled with `cover={false}`). Because the framework still decides and renders the current step, no layout can affect validation, focus management or server-side field discovery.

### Starter themes, theme add and form-owned looks (v0.2 Step 3; starters and form-owned looks since v0.4)

```text
packages/core/themes/<id>/
  index.tsx     defineTheme({ tokens, components: { Layout, Field, … } })
  <id>.css      component styles (prefixed classes) + chrome overrides scoped to [data-of-theme="<id>"]
  THEME.md      visual language: palette, typography, components, copy tone, when to use, do / don't
```

| Theme | Layout | Positioning |
| --- | --- | --- |
| `classic` | Card | The baseline look; every token spelled out, easy to rebrand |
| `editorial` | `SplitLayout` | Serif magazine style |
| `terminal` | Terminal window | CLI prompt style |
| `brutalist` | Card | Neo-brutalism |
| `conversational` | `FocusLayout` | One question at a time, letter shortcuts, auto-advance |

As in open-slide, **themes are references, and each form owns its look**. A theme in the project's `themes/` is what an agent reads when it writes a form's look; no form renders from it, imports it or copies it. `open-form create <id>` always writes `forms/<id>/theme/index.ts` and wires it into the form (`import theme from './theme/index.ts'` above the form's CSS, `<Form theme={theme}>`); with `--theme <theme>` that file starts from the reference's tokens (`pickTokens()` on the loaded module, written by `formThemeSource()`), and the web fonts those tokens name come along (`writeFormTheme()` in `src/editing/theme-files.ts`). The reference's CSS and components never come in wholesale: the agent takes only what the form renders, in the order tokens → CSS on the runtime's own classes → components for markup or behavior CSS can't give (a window frame, an input wrapper, keyboard shortcuts). So a form carries no unused component, and the starters' later improvements never need copying into existing forms. Editing or deleting a theme in `themes/` never changes a form; editing a form's look changes only that form. A form without a `theme/` folder gets the runtime's base styles; there's no project default theme and no missing-theme fallback to manage.

The starters' and references' `index.tsx` and CSS stay complete, because Studio's gallery and `/theme-preview`, and the website's theme wall, render them; each `THEME.md` lists every token and which parts are CSS on runtime classes and which need components, so it works as a recipe.

The five above are **starters**: `open-form theme add <starter> [--as name]` copies one into `themes/` (renaming also rewrites the `data-of-theme` selector and the THEME.md title) to adapt as a reference — the shadcn model. `themes/` is empty after `init`. Builds include `themes/` only for Studio's read-only Themes pages: `virtual:open-form/themes` carries each reference's THEME.md (name, description, layout, body) and a lazy import of its entry, so each theme is its own chunk and no form page loads one; `/theme-preview/:themeId` is served wherever Studio is. `open-form build` first SSR-loads each reference (`unloadableThemes()` in `src/cli/build.ts`) and leaves out any that fails, with a warning, so a reference halfway through an edit never blocks a deploy. `open-form check` warns when a form imports from `themes/` or another form's folder (the repo's Biome config forbids it in `apps/demo`), since that would tie the form's look back to a file that can change. Class prefixes a form takes from a reference (`.tm-*`, …) stay global; only two forms on one page styling the same prefix differently could collide.

### Localization (v0.3 Step 1)

- `locale` is set in `defineForm()` or `open-form.config.ts`: `'en'` (default), `'zh-TW'`, `'zh-CN'`, `'ja'`. It only affects the framework's own text (buttons, validation, status pages); the question copy is written by the author in that language.
- The message catalogs live in `schema/messages.ts`, shared by client and server, so validation errors are word-for-word identical on both sides. Each catalog carries its own `locale`, and dates are formatted per locale with `Intl` (`formatDate` / `formatDateTime`).
- A single-language form doesn't switch with the browser: the questions are in the one language the author wrote, so translating only the buttons would be inconsistent.
- **Multilingual forms (v0.3 Step 2)**: translation files `forms/<id>/locales/<lang>.json` are keyed by the source text (gettext-style) and pulled in via `defineForm({ translations })`. Why: the form code stays in one language and readable; an agent generates a whole translation in one go; `check` can list exactly what's missing. Translation happens only in the display layer (`useTranslate()` / `<T>`); the schema, field names, option values, conditions and CSV column names stay in the source language, so responses in every language can live in the same table.
- The strings to translate are gathered by render-to-collect as well: in collect mode every `tr()` call is recorded (including conditional content inside `<When>`), and together with the text in config this forms the coverage baseline for `check` / Studio.
- Language selection: `?lang=` → the form's last choice (localStorage) → browser language → source language. The `locale` is sent on submit; the server accepts only languages the form provides, uses it for error messages, and stores it in `submissions.locale` (migration 2).
- Fonts: the runtime provides `--of-cjk` / `--of-cjk-serif` via `:lang()`, and themes append `var(--of-cjk)` after their Latin font stacks instead of hard-coding a region-specific font. For web fonts, see "Theme fonts" in §9.

---

## 7. Server: submission pipeline

`createOpenFormHandler({ registry, storage, secret, … })` returns `(Request) => Promise<Response>`.

```text
POST /api/forms/:id/submissions
  │
  ├─ request guard      same-origin (or embed.origins; an https Origin for the same host passes over an http URL, for proxies that end TLS), JSON only, body size limit
  ├─ load definition    registry.load(id) → schema + config + validators
  ├─ policy             config.submissions ← Studio overrides (storage.getFormOverrides, see §9)
  ├─ window             closed / opensAt / closesAt (interpreted in the form's timeZone)
  ├─ timing token       signed token (HMAC), checks minimumCompletionTime
  ├─ sanitize           compute visible fields by condition (a fixed point, re-evaluated against all coerced answers each round), strip hidden and unknown fields, coerce types
  ├─ validate           validateField() + custom validators (function / Standard Schema)
  │                      regexes only see bounded input: email ≤ 254, pattern without maxLength ≤ 1,000 (ReDoS)
  ├─ rate limit         storage.hitRateLimit(hmac(form, ip or IPv6 /64), window), valid submissions only
  ├─ visitor            device cookie (of_vid) → visitor_hash
  ├─ honeypot           filled in → the same full/duplicate checks and answer as a real submission, nothing stored
  ├─ storage.createSubmission(..., { maxResponses, uniqueKey })   ← checked atomically inside a transaction
  └─ webhooks           submission.created delivered asynchronously after responding (waitUntil)
        │
        └─ 201 { id, number }  /  400 too_fast|invalid_token|expired_token  /  409 duplicate
           410 closed|not_open|full  /  422 { errors }  /  429
```

**Time zones**: `YYYY-MM-DD` (whole day) and `YYYY-MM-DDTHH:mm` values in `opensAt` / `closesAt` are "wall-clock time", interpreted in Studio's overridden `timeZone` → the form's `timeZone` → the project's `timeZone` → `'UTC'` (`schema/time.ts`, converting IANA zones with `Intl`, no dependency). The runtime's local time zone is never used — otherwise the same config would differ by 8 hours between a laptop in Taiwan and a container on UTC. ISO timestamps with an offset are taken as-is. `open-form init` writes the creator's machine time zone into `open-form.config.ts`; `open-form check` warns when wall-clock times are used without a time zone. Studio's settings page can change the time zone (§9): changing it keeps the wall-clock time and moves the instant; when no time zone is set at all and there are no dates yet, it defaults to the browser's time zone and writes it on save. Studio's status is computed and returned by the server (`status`, `opensAt`, `closesAt` from `/forms/:id/schema`), not recomputed in the browser using the browser's own time zone.

**Webhooks**: `webhooks: [{ url, forms? }]` in `open-form.config.ts` (not in `defineForm` — form config is bundled into the browser, and the URL itself may be a secret). `open-form.config.ts` runs only when the server starts (the server entry `import`s it; it isn't a snapshot `JSON.stringify`-ed at build time), so `process.env.RESPONSES_WEBHOOK_URL` is read from the runtime environment, the value never ends up in `dist/`, and the build doesn't need it; if it's missing, the server fails at startup. Each new response is POSTed asynchronously after the response is sent, as `{ type: 'submission.created', timestamp, data: { form, submission } }`, signed with `OPEN_FORM_WEBHOOK_SECRET` per [Standard Webhooks](https://www.standardwebhooks.com) (`webhook-id` / `webhook-timestamp` / `webhook-signature: v1,…`; a `whsec_` prefix marks a base64 key). URLs must be `https://` (`http://` only for localhost, since the payload is the respondent's answers). Up to 5 delivery attempts (at 0, 5s, 30s, 2m, 10m — the first attempt plus 4 retries, all with the same `webhook-id`); `410 Gone` stops delivery; logs record only the origin, never the payload. Retries are held in memory and are lost when the server restarts; serverless platforms use the handler's `waitUntil` to keep delivering after the response.

**Next.js (`@open-form-build/core/next`)**: `createOpenFormRoute()` returns `{ GET, POST, PUT, DELETE, OPTIONS }`, mounted at `app/api/[...openform]/route.ts`. App Router route handlers run in the React Server Components layer (no `createContext` / `react-dom/server`) and can't render a form to derive its schema, so the adapter reads the `dist/server/entry.js` produced by `open-form build --server-only` (a single file that bundles its own React) — client and server still come from the same form source. Outside production, every request checks the bundle's mtime and, if it changed, re-imports it with `?v=<mtime>` (which is why the server entry must be a single file: split-out chunks would import the old entry without the query, giving two copies of React) and builds a new handler from the bundle's `config`, so `--watch` carries `open-form.config.ts` edits through. The bundle is imported by a runtime path, so Next's file tracing misses it: `output: 'standalone'` and Vercel need `outputFileTracingIncludes`, and serverless functions can't write `.open-form/secret`, so they need `OPEN_FORM_SECRET` (the adapter's errors say both). The client IP is taken from the right of `X-Forwarded-For` (1 hop by default: Next.js / Vercel put the client last). Pages use `<FormHost id form config />` (`react/host.tsx`), which fetches availability and the timing token and then renders. Build, start, dev + watch and submission have been tested on Next.js 16 (Turbopack).

**Embed**: `embed.origins` in `open-form.config.ts` (a list of origins or `'*'`) is the only switch. `/embed.js` (`src/app/embed.js`, copied unhashed to `dist/client/` at build time) replaces `[data-open-form]` with an iframe of `/f/<id>?embed`. In embed mode the page drops `100dvh`, reports the body height via `ResizeObserver` (`open-form:resize`), and posts `open-form:submitted` after submission — messages carry only the form id, hence `targetOrigin: '*'`. `success.redirect` leaves the host page via `window.open(url, '_top')`. `frame-ancestors` on `/f/:id` follows `embed.origins`; CORS is enabled only on public routes (form status, submission and its preflight), never with credentials, and never on admin routes. Third-party iframes can't store cookies (`SameSite=Lax`, blocked by browsers), so the runtime also keeps a random visitor id in localStorage (the `x-open-form-visitor` header / body `visitor`); the server prefers the cookie and falls back to it — neither is an identity, and both are equally strong.

Admin API (used by Studio):

```text
GET    /api/forms                                   admin: forms + response counts, status, latest response time
GET    /api/forms/:id                               public: status + timing token
POST   /api/forms/:id/submissions                   public: submit (see the pipeline above)
GET    /api/forms/:id/schema                        admin: schema + status / opensAt / closesAt with overrides applied
GET    /api/forms/:id/submissions?limit&offset&q    admin (limit defaults to 50, max 500)
GET    /api/forms/:id/submissions/:sid              admin
DELETE /api/forms/:id/submissions/:sid              admin
POST   /api/forms/:id/submissions/delete { ids }    admin: bulk delete (1–500), returns { deleted }
PUT    /api/forms/:id/overrides                     admin: Studio submission-setting overrides (see §9)
DELETE /api/forms/:id/overrides                     admin: revert to the settings in code
GET    /api/forms/:id/export?format=csv|xlsx|json   admin
GET    /api/studio/session                          sign-in state (signedIn, readOnly, whether sign-out is possible, sign-in method)
POST   /api/studio/session    { password }          password → session cookie (same-origin, 10 per IP (/64 for IPv6) / 10 minutes)
DELETE /api/studio/session                          sign out
```

**Admin protection**: the handler's `adminAuth` decides who can use Studio and the admin API; if it isn't passed, there are no admin routes (404, fail-closed).

- `adminAuth.password`: a user-chosen shared admin password (at least 16 characters; a passphrase works). The Studio page itself loads without signing in and shows a sign-in screen; `POST /api/studio/session` exchanges the password for a session cookie signed with the secret (`of_session`, `HttpOnly; SameSite=Strict`, `Secure` over HTTPS or when `Origin` is https, 7 days by default). HMACs of both sides are compared, so the password length doesn't leak; the cookie carries a fingerprint of the password, so changing the password signs everyone out. Signing out (`DELETE /api/studio/session`) records that session's signature via `StorageAdapter.revokeSession` (SQLite `revoked_sessions`, kept until the original expiry), after which the same cookie is always rejected — a copied cookie dies with it, and stays rejected across server restarts. Sign-in attempts are limited to 10 per IP (per /64 for IPv6) per 10 minutes.
- `adminAuth.authorize(request)`: custom logic (an SSO session, local connections); `signInUrl` makes Studio's sign-in screen redirect to an external sign-in page.
- dev: with no password set, `authorize` = a direct local connection (loopback connection, loopback `Host`, no `Forwarded` / `X-Forwarded-*` / `X-Real-IP`, and not a web page from another origin: `Sec-Fetch-Site` must be `same-origin` / `none`, and `Origin` must be same-origin). Vite's `server.cors` is also turned off, since otherwise it answers CORS for any localhost origin and lets pages from other dev servers read responses. Once `OPEN_FORM_ADMIN_PASSWORD` is set, local connections are no longer trusted and everyone signs in: nginx's default `proxy_pass` (no `X-Forwarded-For`, Host rewritten to 127.0.0.1) or plain TCP forwarding (`ssh -R`, `socat`) makes remote requests look local, so always set a password before exposing dev. The dev-only endpoints (a form's look, font search, folders, comments, source, current) sit behind the same gate.
- production (`open-form start`): only `OPEN_FORM_ADMIN_PASSWORD` is honored; without it, Studio and the admin API don't exist and only the public forms are served.
- public read-only Studio (`studio: { public: 'read-only' }` → the handler's `publicStudio`): the admin `GET` routes skip the gate, and `GET /api/studio/session` answers `readOnly: true` to anyone not signed in, so Studio renders without the sign-in screen and hides deleting and schedule editing. Writes still go through `adminAuth` (404 without it). Only `open-form start` passes it: dev keeps Studio local, and the Next.js route serves no Studio.
- Page headers: Studio `frame-ancestors 'self'`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy: same-origin`; `/f/:id` allows only same-origin embedding by default (`embed.origins` opens it up).

**Client IP**: with `trustProxy` (`true` or a number of proxy hops), the IP is counted from the right of `X-Forwarded-For`, skipping the entries your own proxies added; values further left were sent by the client itself and are ignored.

---

## 8. Storage (SQLite-first)

```sql
form_versions    (id, form_id, version, schema JSON, created_at)            UNIQUE(form_id, version)
submissions      (id, form_id, number, form_version_id, data JSON, visitor_hash,
                  unique_key, created_at, updated_at, locale)                UNIQUE(form_id, unique_key)
submission_files (id, submission_id, field_name, storage_key, filename,
                  mime_type, size, created_at)                               -- enabled in the File Upload phase
rate_limits      (key_hash, window_start, count, expires_at)                 PRIMARY KEY(key_hash, window_start)
form_overrides   (form_id, data JSON, updated_at)                            PRIMARY KEY(form_id)
form_counters    (form_id, last_number)                                      PRIMARY KEY(form_id)
revoked_sessions (id, expires_at)                                            PRIMARY KEY(id)  -- signed-out Studio sessions
meta             (key, value)                                                -- schema_version, etc.
```

- Migrations run in order, and `meta.schema_version` records the last one applied: ① the initial 4 tables ② `submissions.locale` (v0.3 localization) ③ `form_overrides` (Studio submission-setting overrides) ④ `form_counters` (response number counter) ⑤ `revoked_sessions` (revoke sessions on sign-out).

- Default path `.open-form/open-form.db` (override with `storage.path` or `OPEN_FORM_DB`), WAL mode.
- Responses are personal data: the `.open-form/` directory is `0700`, the DB and its `-wal` / `-shm` are `0600` (the DB is created `0600`, and existing files are fixed when opened), and `secret` is `0600` (also tightened on read).
- Search uses `CASE WHEN json_valid(data) THEN EXISTS(json_tree …) END`: `json_tree` fails the whole query on JSON it can't walk, so such rows are skipped instead of causing a 500. The write side also limits custom fields to at most 10 levels of nesting.
- `PRAGMA secure_delete = ON`, plus `wal_checkpoint(TRUNCATE)` after deleting responses: deleting in Studio really erases the data, leaving no copies in the DB or WAL file (leftovers from older versions need a single `VACUUM` to clear).
- The dev server's Vite `fs.allow` covers the whole project, so `fs.deny` (`devServerDeny` in `vite/config.ts`) explicitly excludes `**/.open-form/**` and any custom DB path (including `-wal` / `-shm`), and re-lists Vite's original defaults (a custom `deny` replaces them). Otherwise `/@fs/…/.open-form/open-form.db` would bypass Studio sign-in and serve the file directly.
- `StorageAdapter` is an async interface; the SQLite adapter's API is synchronous, but the interface stays async to accommodate future Postgres / Turso adapters.
- `maxResponses` and `uniqueBy` are checked inside the adapter's transaction, so there are no races.
- `number` is a per-form sequence number (Studio's "Response #147"). It's never renumbered after deletions, nor reused: numbers come from the monotonically increasing `form_counters`, incremented in the same transaction as the `maxResponses` / `uniqueBy` checks. `MAX(number) + 1` alone isn't used, because after deleting the latest response the next one would get the same number, which webhook receivers have already seen; but it still takes `max(counter + 1, MAX(number) + 1)`, so data from before the upgrade, or responses written by older code that bypassed the counter, never cause duplicate numbers.
- Search (`listSubmissions({ search })`, Studio's `?q=`) matches only answer values (strings and numbers from `json_tree`), not field names; otherwise searching "email" would match every row.
- Filters (`listSubmissions({ filter, now })`, Studio's `?filter=` JSON) are defined once in `schema/response-filter.ts`: `parseResponseFilter` validates them (the handler answers 400 on a bad one) and `responseFilterTest` evaluates them. The memory adapter calls the test directly; SQLite registers it as the `open_form_filter(data, created_at)` SQL function, so `COUNT`, `LIMIT` and `OFFSET` stay in SQL and both adapters agree. Day rules on the submission time are read in the `timeZone` Studio sends (the viewer's).
- Sorting (`listSubmissions({ sort })`, Studio's `?sort=` JSON) works the same way: `schema/response-sort.ts` turns an answer into a key (`responseSortKey`: numbers, lowercased text, or a choice's position in the `values` Studio sends, so options sort in form order) and defines the order (`compareResponseSortKeys`: SQLite's — numbers before text, empty answers last either way). SQLite registers the key as `open_form_sort_key(data)` and sorts in a subquery, so pages are still cut in SQL; ties fall back to `number DESC`.

**Deployment note**: SQLite suits environments with a persistent volume (VPS, Docker, Railway + Volume, Fly.io + Volume). Serverless platforms (Vercel and the like) aren't suited to local SQLite and need to wait for a remote adapter.

---

## 9. Dev / Build / Start

| Command | What it does |
| --- | --- |
| `open-form dev` | Vite dev server (root points at `src/app` inside the package). `/api/*` mounts the fetch handler; form modules are loaded with `ssrLoadModule`, so saving hot-reloads (client HMR + server schema sync). `open-form.config.ts` shapes the plugins, the handler and the server options, so saving it starts a new Vite server with the reloaded config on the same port (a broken config keeps the old one running). Refuses to run outside a workspace (`open-form.config.ts`, or a `package.json` that depends on `open-form`). |
| `open-form build` | ① client build → `dist/client` (app, Studio and every form, each with its own theme; the references in `themes/` come along only for Studio's read-only Themes pages, one lazy chunk each; one that fails to SSR-load is left out with a warning) ② SSR build → `dist/server/entry.js` (bundles all forms, config and the collector; a form's theme comes along through its import, minus its CSS, but collect never renders it). `process.env.NODE_ENV` is defined as `production` in the server entry (`development` with `--watch`), since nothing sets it for `start`. `--out-dir` only empties `client/` and `server/` in the default `dist/` or where an earlier build left `.open-form-build`. |
| `open-form build --server-only [--watch]` | Produces only `dist/server/entry.js` (a single file), for `@open-form-build/core/next`. |
| `open-form start` | Node http server: static files + SPA fallback + `/api/*`. Reads `PORT`, `OPEN_FORM_DB`, `OPEN_FORM_ADMIN_PASSWORD`, `OPEN_FORM_SECRET`, `OPEN_FORM_TRUST_PROXY` (`true`, `false` or the number of proxy hops; any other value fails startup), `OPEN_FORM_SECURE_COOKIES` (with trust proxy, cookies are marked `Secure` by default; `0` turns it off), `OPEN_FORM_WEBHOOK_SECRET`. |
| `open-form check [id]` | Loads forms the way the server does and prints the schema or errors; also checks for missing translations and time zones, and warns when a form imports from `themes/` or another form. |
| `open-form create <id> [--theme]` / `list` / `responses export <id>` | Create a form from the starter with its own `theme/index.ts` (from a theme's tokens with `--theme`) / list forms and response counts / export CSV, Excel or JSON. |
| `open-form delete <id> [--yes]` | Delete a form: `StorageAdapter.deleteForm` (responses, versions, overrides, counter), its `.folders.json` entry, then `forms/<id>/` (`src/editing/delete-form.ts`, shared with Studio's `DELETE /api/studio/forms/:id` under `open-form dev`). Asks for the id; `--yes` without a terminal. |
| `open-form theme list` / `check <id> [--form]` / `add <starter> [--as]` / `font <id> <family> [--form]` | List project themes and starters / check contrast / copy a starter into `themes/` / download a Google Fonts family into a theme (`--form`: the form's own look). |
| `open-form comments [id]` | List the `@form-comment` markers left from Studio (see §11). |

App routes:

```text
/                         → /studio (in dev, or when an admin password is set)
/f/:formId                → public form
/studio                   → Forms list (live thumbnails: /f/:id?thumb=1, not reported to current.json)
/studio/:formId           → Preview (desktop / tablet / mobile)
/studio/:formId/responses → Responses table, detail, delete, Excel / CSV / JSON export
/studio/:formId/responses/:responseId → same as above, with one response opened directly
/studio/:formId/schema    → fields by step as a table: data key, type, validation, conditions (read-only, derived)
/studio/:formId/settings  → submission window and limit (editable), plus an overview of the rest of the policy (read-only, set in code)
/studio/themes            → themes gallery: the references (read-only, dev and production)
/studio/themes/:themeId   → theme page: preview + tokens + THEME.md with an outline + "Use it in a form" / "Change this theme" prompts
/theme-preview/:themeId   → sample registration form in Studio's language via ?lang= (thumbnails and the theme page iframe)
```

Studio's layout follows open-slide: a left sidebar (Forms / Themes with counts, quick switching between all forms, version) and an embedded content panel on the right; below `lg` it becomes a top bar + drawer. The Forms and Themes pages are both grids of 16:10 live thumbnails (iframes rendered 1200px wide and scaled down, non-interactive).

### Submission window: code is the default, Studio can adjust it

The open / close times, response limit and pausing submissions (`submissions.opensAt` / `closesAt` / `maxResponses` / `closed`), along with the `timeZone` those dates are interpreted in, are the settings most often changed after launch — and often by the organizer rather than an engineer — so Studio can edit them directly:

- **`open-form dev`**: `PUT /api/studio/forms/:id/schedule` (dev middleware) writes changes back to `config.submissions` and `config.timeZone` in `forms/<id>/index.tsx` (`src/editing/form-config.ts`, sharing the AST editing in `source-object.ts` with theme tokens). Code stays the single source of truth and ships with the deploy.
- **production**: `PUT /api/forms/:id/overrides` (admin, same-origin) stores them via `StorageAdapter.setFormOverrides` (SQLite `form_overrides`); they take effect immediately with no redeploy, and `DELETE` reverts to the settings in code.
- Only keys that differ from the code are stored (`scheduleEdit`: dates are compared as instants in the new time zone, and `timeZone` is stored only if it differs from the code's), so later code changes still take effect on fields that aren't overridden. `null` means clearing the code's value.
- Everywhere the handler reads policy (status, submission, `maxResponses`, the Studio list and settings, the xlsx export time zone), it applies `applyOverrides` first and uses the overridden `timeZone`; client and server share the validation and merging in `src/schema/schedule.ts`.
- **Unpublishing** (`config.published: false`, or the `published` override) takes a form offline without removing it from the build: `GET /api/forms/:id` and submissions answer `404 not_found` exactly like an unknown id, while the admin routes keep working, so Studio lists it as `unpublished`, keeps its responses and drops its public links. Studio's preview and thumbnails go through `/f/:id?preview`; on that 404 the page asks the admin `/schema` route, and renders only when it answers. The module still ships in the client bundle, so this hides a form, it doesn't make its questions secret.
- This is the only exception to "a form's settings come only from the collector and `config`", deliberately limited to the four submission keys above plus `timeZone` and `published`. Settings like `uniqueBy`, which would leave existing data inconsistent if changed mid-collection, can still only be changed in code.
- Local dev and `open-form start` share `.open-form/open-form.db`, so the dev Studio shows overrides too; saving in dev writes to code and clears the override, so the override doesn't mask the value just written.

### Studio folders, search and preferences (v0.2.1)

- **Folders** are stored in `forms/.folders.json`: `{ folders: [{ id: 'f-xxxxxxxx', name, icon: { type: 'emoji' | 'color', value } }], assignments: { formId: folderId } }`. Array order is sidebar order; forms without an assignment belong to the virtual "Unfiled" folder. Folders are purely an organizing layer: forms are still flat `forms/<id>/`, and ids, URLs and responses don't change.
- The dev endpoints `/api/studio/folders` (GET / POST, `PUT assign`, `PUT reorder`, `PATCH` / `DELETE :id`) build a new manifest with pure functions from `src/editing/folders.ts` and write the whole file back, with writes serialized; the same-origin + JSON body protection applies. Reading is tolerant (a broken or hand-edited file keeps only its valid parts).
- File changes (including an agent's hand edits) sync live via `open-form:folders-changed`; `open-form build` snapshots them into the server entry (`folders`), which the admin route `GET /api/studio/folders` serves to signed-in Studio only (never in a client chunk), and the production Studio is read-only.
- Sorting data: `StorageAdapter.latestByForm?()` (latest response time) and `FormRegistry.updatedAt?()` (form file mtime; snapshotted at build time). Both are optional, so custom adapters don't need to implement them.
- **Preferences** (appearance, interface language, sort) are stored in the browser's localStorage; appearance is applied before first paint by an inline script in `index.html` (Tailwind `dark:` keys off `html[data-studio-scheme]` instead).
- **Interface language**: `studio/messages.ts` holds dictionaries for four languages (types enforce that every language is complete; tests check that placeholders match), `useT()` looks up strings and `t.n()` handles plurals. This is unrelated to a form's `locale`, which is the language respondents see.

### Preview inspect mode (v0.3 Step 3)

Studio sends commands to the preview iframe via postMessage (`open-form:preview-command`: `{ type: 'goto', step, quiet? }` or `{ type: 'done' }`); the preview page turns them into `runtime.previewControl` for the runtime, which reports the current step and whether it's on the completion page via `open-form:preview-nav`. Both sides share `app/lib/preview-channel.ts`. Step switching on the theme page uses `quiet` (no inspecting banner, so it doesn't distract from judging the theme), and `done` shows the completion page directly without submitting. After a jump, the runtime enters inspecting mode: every page is treated as visible, `<When>` shows hidden content and annotates its condition via `InspectContext`, navigation doesn't validate, and submitting shows a notice instead. Only `preview` mode creates a previewControl, so live forms can never enter it.

### Studio design panel (v0.2 Step 5)

```text
Studio design panel ──postMessage(open-form:theme-draft)──▶ preview iframe (/f/:id?preview=1)
      │                                                  └─ draft tokens replace the form's theme tokens; components and CSS unchanged
      └─ Save ─▶ PUT /api/studio/forms/:id/theme { patch } ─▶ src/editing/theme-tokens.ts (Babel AST)
                                                              └─ write file → Vite watcher → the preview reloads the theme
```

The panel (`DesignPanel`) edits a form's own look; references in `themes/` are read-only in Studio (see *Theme page* below). The server side is one set of helpers in `src/vite/theme-design.ts` that work on a theme file path (`themeDesign`, `saveThemeTokens`, `addThemeFont`), mounted in `studio-forms.ts`:

- **A form's look**: the form's Preview tab has a third mode, **Adjust**, beside Preview and Edit (`FormDesign` in `app/studio/form-design.tsx`). `GET /api/studio/forms/:id/theme` returns the tokens, fonts and contrast of `forms/<id>/theme/index.ts(x)`, or `{ missing: true, file }`; `PUT` saves a patch; `POST …/theme/fonts` downloads a Google font into `theme/fonts/`; `POST …/theme` writes an empty `theme/index.ts` and wires it into `index.tsx` (`wireFormTheme()` in `src/editing/form-theme.ts`: the import above the form's CSS and `theme={theme}` on its one `<Form>`). The draft goes to the form's preview iframe on the `form:<id>` channel (`formDraftKey`); the public page passes it as `runtime.themeDraft`, which `<Form>` lays over its own theme's tokens only in preview, keeping its components. Studio sends the draft forced to the palette being edited (`forceScheme`), so the dark palette can be seen on a light system.

- **Only tokens are editable** (`schema/theme-patch.ts` defines the keys and `diffTokens()` computes the patch, shared by frontend and backend). Components, CSS and `THEME.md` are still written by hand, by people or agents.
- **Write-back strategy**: every edit re-parses and replaces only the character range of the value; new properties follow the existing indentation and quotes; `null` removes a property; `dark: false` ↔ an object can be converted either way. Computed values (`colors: palette`) are rejected outright with a request to edit by hand, rather than guessed at.
- **Security**: `/api/studio/forms/:id/theme` is dev server middleware (not part of the production handler), uses Studio's loopback / admin password authorization, and writes require same-origin + a JSON body; patches are validated against a whitelist (known keys, single-line strings, no backticks).
- **References change outside Studio**: all themes live in the project's `themes/`, and changing one is an edit to its files, by hand or by an agent (the theme page hands over a prompt). No form imports it, so only forms started from it later see the change.
- **Theme fonts (Google Fonts)**: the font dropdown gains "Add from Google Fonts…", with the CLI counterpart `open-form theme font <id> <family>` (`--form` adds it to a form's own look); both share `src/editing/google-fonts.ts` + `theme-fonts.ts`. As in open-slide, fonts are **downloaded into the project**, but instead of grabbing a single TTF the way it does:
  - The catalog comes from `fonts.google.com/metadata/fonts` (no API key, cached for an hour by the dev server); `GET /api/studio/fonts?q=&category=&cjk=1` searches (`studio-fonts.ts`) and `POST /api/studio/forms/:id/theme/fonts { family }` downloads.
  - woff2 is requested from `css2` with a browser UA: variable fonts take the whole `wght` axis (the file is the same size), static fonts only 400–700; Google's `unicode-range` subsets are kept, and only `fonts.gstatic.com` URLs are accepted.
  - Files are written to `fonts/<slug>/` next to the theme entry, a `fonts/<slug>.css` is generated (its header records the family and the `font` stack, which Studio uses to list the theme's fonts), and `import './fonts/<slug>.css'` is added to the theme file. At build time Vite bundles them as assets, so **respondents never connect to Google** (loading Google Fonts directly sends respondents' IPs to Google, which a German court ruled a GDPR violation in 2022).
  - CJK fonts come in about 100 subsets totalling several MB (e.g. Noto Sans TC 400–700 is about 4 MB), but browsers only download the subsets a page uses; the UI labels them "several MB" and shows the actual size after adding.
  - Studio's own search preview loads Google's `css2?text=` directly (in the author's browser, not the respondent's); the Adjust panel loads a form's font CSS via `/@fs/`, and the theme page registers the faces its preview frame reports under private names (see *Theme page*).
- **Theme page** (v0.2.1; aligned with open-slide in v0.4): understand, then hand changes to the agent. Like open-slide's, the Themes pages are read-only and part of every build: Studio reads the catalog from `virtual:open-form/themes` (no API), and under dev a changed THEME.md arrives with the `open-form:theme-changed` event (`info`), so the page updates in place. The list shows the project's references: thumbnail, name and one-line description, with a flag when THEME.md is missing, under a note that each form's look is its own; with no themes, an empty state points to `/create-theme` and `open-form theme add <starter>`. The detail page never imports the reference into Studio's document: the preview iframe loads it and posts `open-form:theme-loaded` (`app/lib/theme-preview.ts`) with `pickTokens()` and the `@font-face` rules its font stacks name (URLs made absolute), or why it failed to load. Studio derives everything from that: a header with its key colors, file, schemes and layout; a large preview (scheme, device, step) in one toolbar; **Tokens**, what `create --theme` copies (`effectivePalettes()` swatches per scheme, a one-line contrast verdict whose dialog lists every pair, type specimens, a shape specimen drawn in the theme's colors); and THEME.md (rendered as-is, hex codes with swatches, an outline of its `##` sections) beside a "Use it in a form" card (`open-form create <form> --theme <id>` and a copy-to-agent prompt) and a "Change this theme" card that turns a description into a prompt. Studio adds the reported faces to `document.fonts` under private names (`of-specimen-<id>-<family>`) while the page is open and deletes them after, so neither the reference's CSS nor a family Studio also uses ("Noto Sans TC") ever reaches Studio's document. A reference that fails to load shows its error on the page and in the frame, instead of passing for the built-in look. There's no "used by" list: no form depends on a reference. "New theme" produces an instruction to copy to an agent and shows `open-form theme add <starter>`; filling in a missing THEME.md is also a copy-to-agent instruction.

---

## 10. Agent integration

Following open-slide's approach:

- **Skills** live in the package's `skills/` and are copied to the workspace's `.agents/skills/` on `init`, with `.claude/skills/*` as symlinks. `dev` syncs them automatically on startup (built-in skills are always overwritten, so don't edit them in place) and keeps watching the package's `skills/` while running (syncing immediately when open-form is linked from source and they change); `open-form sync:skills` syncs manually without starting dev. Both refuse to run outside a workspace, where `.claude/skills/` could be the user-wide folder. `OPEN_FORM_SKIP_SKILLS_SYNC=1` turns syncing off.
  - `create-form`: the workflow from requirements to a complete form (clarify the questions → **decide the aesthetic direction first**: read each theme's `THEME.md` and propose 3 directions based on the form and its audience → choose an id → start the form from the chosen theme's tokens (`create --theme`) → plan the structure and copy according to the direction → write the file and the form's own look, taking only what it uses from the reference → self-check).
  - `create-theme`: generates a reference `themes/<id>/` (tokens, components, CSS, `THEME.md`) from the repo's existing design system (Tailwind, CSS variables, shadcn, fonts), images or a description, starting from the closest starter via `theme add --as`, and checks contrast.
  - `form-authoring`: technical reference (file contract, components, conditions, validation, policy, themes, appearance components, layouts, anti-patterns).
  - `current-form`: reads `node_modules/.open-form/current.json` (reported by Studio via `POST /api/studio/current`, behind Studio's gate; its contents enter the agent's context, so unauthorized writes aren't allowed) to know which form and step the user is "looking at right now", which element they selected in Studio (`selection`), the form's own theme (`formThemePath`), or which reference theme is open (`themeId` / `themePath`).
  - `apply-comments`: uses `open-form comments` to find the `@form-comment` markers left from Studio, applies them one by one and removes the markers, then runs `open-form check`; unclear ones are kept and asked about (see §11).
- **AGENTS.md** (CLAUDE.md is a symlink) holds only the hard rules; everything else is in skills.

---

## 11. Edit mode and comments (v0.4, dev only)

```text
forms/**/*.tsx ──▶ vite/loc-plugin.ts (enforce: pre, serve only)
                     adds data-of-loc="forms/<id>/index.tsx:line:col" to every JSX opening tag
                     (inserted inside the tag only, so line numbers don't change; Fragments are skipped;
                      forms/<id>/theme/ is skipped: it draws every field, so tagging it would select the theme)
                          │
     ┌────────────────────┼──────────────────────────────┐
     ▼                    ▼                              ▼
 the user's DOM       built-in fields: useField puts     <Form> / <Page> / <Row> / <Heading>:
 elements carry the   it in controlProps (every theme    form.tsx / layout.tsx forward it to
 attribute directly   and custom field must spread it)   .of-root / .of-step / the matching element
                      → it lands on the native control
```

- **Layout**: the Preview tab mirrors open-slide's editor page: a single toolbar (device, language | Preview / Edit, reload), placed in the preview column with its left edge aligned to the canvas; a left step rail (each step's title, question count and condition, ending with the "completion page"; in edit mode it always collapses to numbers, and hover or keyboard focus pops out that step's title, question count, display condition and question list) whose header row matches the toolbar's height, with the first step aligned to the top of the canvas; and the edit panel on the right. Column widths come from a container query on the content area's width rather than the window, since the Studio sidebar takes up part of the width; when it's too narrow, the step rail turns back into horizontal chips above the preview and the panel moves below.
- **Modes**: the toolbar's "Preview / Edit" toggle (following open-slide's Preview / Edit). Edit mode pins a panel on the right (`studio/edit-panel.tsx`, below the preview under `lg`) and starts `app/public/inspector.ts` inside the iframe via `open-form:inspect` (along with a "loc → component name, field name" map from `GET /api/studio/source?form=<id>`). Switching back to preview, closing the panel, or pressing Esc with nothing selected leaves edit mode and clears both the iframe's outlines and Studio's selection; with something selected, Esc only deselects.
- **Selection**: clicks are swallowed in the capture phase (fields don't focus, buttons don't change pages); hover shows a dashed outline + name label, and clicking shows a solid outline and reports `open-form:inspect-pick`. It first finds the "owner": walking up to the first element that carries `data-of-loc` itself, whose associated label control carries it, or whose descendants share exactly one location; the outline then expands to the largest ancestor that "still belongs only to this location". Fields are selected whole (label, description and control are edited together). Within other owners, anything drawn by the runtime or theme (titles, descriptions, progress, buttons, theme decorations) can be selected on its own as a "part": the whole run of text at the click point (the outermost element containing only inline elements), or the element itself if there's no text; an outer wrapper around other marked elements doesn't count as a part. A part is described by its "source text" (the iframe reverse-looks-up the current language via `config.translations`) or its "child position under the owner", so after the form re-renders (source edits, page changes) the iframe can find it again with a MutationObserver. Breadcrumbs and "Select parent" have Studio send `open-form:inspect-select` to set the outline. Selections are tied to the form they were made on; if the iframe can't find a requested selection once the page has settled, it reports `open-form:inspect-missing` and Studio clears it. The iframe posts `open-form:inspect-ready` once it listens, so the inspector restarts after a preview reload.
- **Direct text editing**: `POST /api/studio/source/slots { loc, text?, locale? }` (`vite/studio-source.ts` → `editing/text-slots.ts`) returns the selection's "text slots": parts are matched by text (first within that element, then across the whole file — e.g. `<Form>`'s title lives in `config`), while elements list their own `label` / `description` / `title` / `placeholder`… and child text (`<Form>` adds the config title and description). Strings that double as values (`options={['Student']}`, `equals="Student"`) aren't listed, since changing them would change data. `PUT /api/studio/source/text { at, from, to }` uses `from` to check the source hasn't changed and rewrites it in place by position (JSX attributes switch quotes or become `{'…'}` when needed), and renames the same key in every locale's translation table (`import x from './locales/<l>.json'` or an inline object); if the old text is still used elsewhere, it copies instead. With `locale`, only that locale's translation value changes. After the edit, HMR remounts the form; the preview page remembers the current step and returns to it with `goto` instead of jumping back to the first page.
- **For agents**: Studio writes the selection to `selection` in `current.json` (`file` / `line` / `column` / field `name` / the part's display text), which the `current-form` skill uses to resolve "make this required". The panel shows `file:line` and "Copy location" (including the field and text, ready to paste to an agent).
- **Comments**: `POST /api/studio/comments { loc, text }` (`vite/studio-comments.ts`, Studio authorization + same-origin, paths restricted to `forms/`) uses Babel to find the JSXElement at that location (or a property in `config`, such as the title) and inserts a line above it: `{/* @form-comment: … */}` (as a JSX child) or `/* @form-comment: … */` (in expression position), with the text squashed onto one line and `*/` neutralized. When a part is selected, the comment goes on the element or property where its text lives; if no unique source is found, it goes on the owner with `(on “…”)` noting which part. When a whole line is inserted, `shifted` is returned and Studio moves the selection's line number down accordingly. `GET ?form=<id>` on the same endpoint lists the form's markers, and `DELETE { file, line }` removes one. `open-form comments [id]` lists all markers; the `apply-comments` skill applies them one by one and removes the markers. Comments live right in the source, consistent with how git, PRs and agents work, with no separate database.

---

## 12. Non-goals

Typeform / Google Forms clone, drag-and-drop builder, CRM, marketing automation, database SaaS, auth provider, workflow platform. **No dragging fields from a sidebar onto a canvas** — that would erase the agent-first design.
