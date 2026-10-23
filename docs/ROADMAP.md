# Open Form — Roadmap

English · [繁體中文](./ROADMAP.zh.md)

> Goal: v0.1 closes the full loop **Create → Preview → Submit → Store → Responses**,
> and proves with the "Developer Meetup Registration" demo that an agent writing only questions + logic gets a complete form application.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for architecture details. Status: ✅ Done　🚧 In progress　⬜ Not started

---

## v0.1 — MVP

### Phase 0 — Monorepo foundation ✅

- ✅ pnpm workspace + Turborepo + Biome + Vitest + Changesets
- ✅ Scaffolding for `packages/core` (framework) and `apps/demo` (dogfood workspace)
- ✅ Layered import rules (Biome `noRestrictedImports`)
- ✅ AGENTS.md / CLAUDE.md, README, CI workflow
- ✅ ARCHITECTURE.md, ROADMAP.md

### Phase 1 — Schema layer (`@open-form-build/core/schema`) ✅

- ✅ `FormSchema` / `FieldSchema` / `Condition` types
- ✅ `evaluateCondition()`: equals, notEquals, in, notIn, filled, empty, contains, gt/gte/lt/lte, all/any/not
- ✅ `validateField()`: required, min/maxLength, pattern, email, url, number range / integer, options membership, date range, checkbox group count
- ✅ `coerceValue()` and `resolveVisibleFields()` (fixed-point removal of hidden fields)
- ✅ `defineForm()` / `defineConfig()` / `defineTheme()`, duration parsing (`'2s'`, `'10m'`)
- ✅ Standard Schema interface (custom validators)
- ✅ `schemaVersion()`: stable JSON hash
- ✅ i18n messages (en, zh-TW)

### Phase 2 — React runtime + DSL (`@open-form-build/core`) ✅

- ✅ External store + `useField()` (works for custom field components too)
- ✅ `<Form>`, `<Page>`, `<When>`, `<Row>`, `<Heading>`, `<Paragraph>`, `<Submit>`, `<Success>`
- ✅ Fields: `Text`, `Email`, `Url`, `Tel`, `NumberInput`, `Textarea`, `Select`, `RadioGroup`, `Checkbox`, `CheckboxGroup`, `DateInput`, `Rating`
- ✅ Multi-step: progress, Back/Next, conditional steps, advance only after validation, focus management, Enter to advance
- ✅ Submission: loading / success / error / closed / full, server field errors routed back to the matching step
- ✅ Honeypot, timing token
- ✅ Responsive CSS, CSS variables theme, dark mode, a11y (label, aria-invalid, aria-describedby, fieldset/legend)
- ✅ Collector: render-to-collect produces `FormSchema`
- ✅ `useFormValues()` / `useFieldValue()`, `<Form aside>` sidebar, theme `colorScheme` (force dark / light)

### Phase 3 — Server + Storage ✅

- ✅ Web-standard fetch handler + router
- ✅ Submission pipeline: window, honeypot, timing, rate limit, sanitize, validate, unique, max
- ✅ `StorageAdapter` interface + in-memory adapter
- ✅ SQLite adapter (`node:sqlite`, WAL, migrations, form_versions / submissions / rate_limits / meta)
- ✅ Admin API: list / get / delete / export (CSV, JSON)
- ✅ Device cookie (`once-per-device`)
- ✅ Node http adapter

### Phase 4 — Framework runtime (dev / build / start) ✅

- ✅ Vite config hidden inside the package (root = `src/app`)
- ✅ Form discovery + virtual modules (client: lazy load; server: SSR entry)
- ✅ Dev: `/api` middleware, `ssrLoadModule`, HMR, live schema sync
- ✅ Public form page `/f/:formId`
- ✅ Build: two stages, client + SSR
- ✅ `open-form start`: static files + API + protected Studio (a sign-in screen + session since v0.3)

### Phase 5 — Studio ✅

- ✅ Forms list (title, field count, response count, status)
- ✅ Preview (desktop / tablet / mobile iframe)
- ✅ Responses: table, pagination, search, detail page, delete
- ✅ Export CSV / JSON
- ✅ Settings: policy, protection, schema overview (read-only)

### Phase 6 — CLI, Template, Agent skills ✅

- ✅ `open-form init | dev | build | start | list | create | responses export | sync:skills`
- ✅ Workspace template (AGENTS.md, tsconfig, .gitignore, sample form)
- ✅ Skills: `create-form`, `form-authoring`, `current-form` (+ `current.json`)
- ✅ Demo: Developer Meetup Registration, Feedback, Contact

### Phase 7 — Hardening ✅

- ✅ Unit tests (schema, server pipeline, sqlite, collector, CSV)
- ✅ E2E smoke: scaffold → dev → submit → responses → export
- ✅ README (Before / After)

---

## v0.2 — Design system: customizable like open-slide

> Principle: **The runtime owns behavior and accessibility; the agent owns appearance and layout.**
> Today there are only two extremes — change the colors (tokens), or write everything yourself (`useField`). v0.2 fills in the middle layer,
> so that "make me a registration form" starts from design thinking every time instead of reusing the same look.

### Step 1 — Split fields into "behavior + appearance", with swappable appearance sets ✅

- ✅ Define the appearance component contract (`Field`, `TextInput`, `Textarea`, `Select`, `ChoiceGroup`, `Checkbox`, `Rating`) and its types
- ✅ Built-in fields become behavior (`useField`) + appearance components; the existing look becomes `defaultComponents`
- ✅ Override sources: theme `defineTheme({ components })` and form `<Form components>`, layered over the defaults in that order
- ✅ Themes support `.tsx` and folders (`themes/<id>/index.tsx`), loaded on demand
- ✅ `FieldShell` follows the theme: custom fields get the theme's wrapper automatically
- ✅ Tests, docs (form-authoring skill, ARCHITECTURE), verified with demo themes

### Step 2 — Layout slots ✅

- ✅ The `Layout` component receives regions such as `header`, `progress`, `content`, `alert`, `actions` and `aside` (the current step is still rendered by the framework)
- ✅ `useFormNav()`: current step, step list, `next()` / `back()` / `goTo()`, submitting; `useFormMessages()`
- ✅ Replaceable `Header`, `Progress`, `Nav`, `Button`, `Success`, `Notice`
- ✅ Built-in layouts: `FocusLayout` (one question at a time), `SplitLayout` (left/right split), `StepperLayout` (side steps)

### Step 3 — Built-in themes + eject ✅

- ✅ 5 very different built-in themes: `classic`, `editorial`, `terminal`, `brutalist`, `conversational` (with components, layouts and CSS)
- ✅ `open-form theme list` / `theme eject <id> [--as name]`: copies into `themes/` and rewrites selectors so the project owns it (the shadcn model); local themes take precedence over built-in ones
- ✅ Each theme ships a `THEME.md` describing its visual language

### Step 4 — Agent side ✅

- ✅ `create-form`: before starting, reads each theme's `THEME.md` and proposes 3 aesthetic directions (theme + layout + concrete visuals) based on the form's subject and audience; directions must fit the form's length
- ✅ `create-theme` skill: generates `themes/<id>/` from the repo's design system (Tailwind, CSS variables, a shadcn mapping table, fonts), images or a description; when brand colors clash with contrast, it keeps the hue, adjusts the lightness and tells the user
- ✅ form-authoring: full coverage of themes, appearance components, layouts and tokens
- ✅ Tested the skills (create-form / create-theme) with two independent agents, and fixed the skills, APIs and tooling based on their reports:
  - `open-form check [id]`: see a form's derived schema and policy, or the exact error, without starting a server
  - `open-form theme check <id>`: WCAG contrast of a theme in light / dark (supports hex / rgb / hsl / oklch)
  - Config validation: a `uniqueBy` pointing at a nonexistent field, or unparsable dates / times, now error out immediately
  - New tokens: `control` (control border, ≥ 3:1 by default) and `buttonRadius`; focus on options / ratings changed to a solid outline
  - Removed the implicit `default` theme; `theme list` marks the project default; eject also renames `THEME.md`

### Step 5 — Studio ✅

- ✅ Themes gallery `/studio/themes` (like open-slide's `/themes`): a live thumbnail of each theme, its source (built-in / local / overriding built-in), the project default, and how many forms use it
- ✅ Theme detail page: preview with a sample form (containing every component) or any real form; light / dark / auto and desktop / mobile toggles; a `THEME.md` guide tab
- ✅ Design panel: live preview of colors (light / dark palettes), fonts, radius, width, spacing and borders (postMessage drafts, no file writes); live WCAG contrast check
- ✅ Write back to source: Babel AST locates `defineTheme({...})` and changes only the touched values (preserving comments, formatting, quotes and components); built-in themes must be ejected first (unsaved changes are carried into the copy)
- ✅ Theme file hot reload (`open-form:theme-changed`); `current.json` reports the theme being edited (`themeId` / `themePath`)
- ✅ Theme pages only appear in `open-form dev`; production doesn't load that chunk
- ✅ Studio moved to an open-slide-style sidebar (Forms / Themes, quick form switching, mobile drawer); the Forms page became a live thumbnail grid
- ✅ `FocusLayout` welcome screen (title / description on its own page + a start button), `1 / 4` counter, next button and Enter hint on one row; `conversational` theme redesigned

## v0.2.1 — Studio experience (aligned with open-slide) ✅

- ✅ Light / dark / system toggle (sidebar bottom, ⌘K), applied before first paint without flashing; public forms still follow the respondent's system
- ✅ ⌘K / Ctrl K command palette: forms, responses (shown only after typing), folders, themes, appearance, language; fuzzy matching and keyboard navigation
- ✅ Search (title / id / description) and sort (recently edited, latest response, most responses, name) at the top right of the Forms page; the sort is remembered in the browser
- ✅ Folders: `forms/.folders.json` (committed with the repo and shared across the team), with form ids / URLs / responses unaffected; create, rename, change icon (color / emoji), delete, drag to reorder; "Unfiled" is a virtual folder; read-only in the production Studio
- ✅ Drag forms onto sidebar folders (native HTML5 DnD, with drop-target hints while dragging); cards also have a "Move to folder" menu (usable on touch devices)
- ✅ Studio interface languages: English / 繁體中文 / 简体中文 / 日本語 (about 240 strings), defaulting to the browser language and switchable from ⌘K
- ✅ No new dependencies: the command palette, toasts, popovers and icon picker are all homemade (open-slide uses cmdk / sonner / next-themes / emoji-picker-react)
- ✅ Unified dropdowns: Studio uses a homemade `Dropdown` everywhere (groups, keyboard navigation), and the form's language menu became a themed listbox; the form's `Select` field deliberately stays native (system pickers on mobile, autofill, screen readers)
- ✅ Scrollbars: form pages set thin scrollbars and the page background from the theme's colors (dark themes look right on a light system too); Studio switched to thin scrollbars
- ✅ Theme page made agent-first (like open-slide): "Describe the change you want" → an instruction to copy to an agent (with the file path, THEME.md, contrast check, and ejecting built-in themes first); the panel keeps only quick adjustments for primary color, background, fonts, radius and color scheme, with the rest under "All tokens"
- ✅ Theme page redesign: the list flags only exceptions (project default / local), and thumbnails use a realistic sample registration form (in Studio's language); "New theme" is also a copy-to-agent instruction; the detail page = a large preview (jump straight to step N / the completion page) + THEME.md + the actual token spec (swatches and contrast, type specimens, shapes) + the forms using it; editing moved into an "Adjust" drawer, and ejecting a built-in theme was renamed "Save as local theme"
- ✅ New logo (a step track with a check mark, silver on black) and favicon; Studio accents switched to black, white and gray, no longer using a brand color

## v0.3 — Integrations ✅

### Step 1 — Localization ✅

- ✅ `locale`: `'en' | 'zh-TW' | 'zh-CN' | 'ja'` (buttons, validation messages, status pages, Enter hint); Simplified Chinese uses mainland conventions (您, 提交, 邮箱), and Japanese uses the です・ます style
- ✅ Dates formatted per locale (min / max dates in validation messages, open times): `2026年12月6日`, `December 6, 2026`
- ✅ `lang` set on the form root and the page; CJK fonts switched to `var(--of-cjk)` / `var(--of-cjk-serif)`, picking Traditional Chinese / Simplified Chinese / Japanese fonts per locale (the same Han character has different glyph shapes in each region)
- ✅ Japanese breaks lines by phrase (`word-break: auto-phrase`), still breaking when a phrase is too long
- ✅ An unsupported `locale` errors out on load with the correct spelling suggested (`'zh-Hant'` → `'zh-TW'`), checked in both forms and `open-form.config.ts`
- ✅ Tests: every locale has every message with matching placeholders; the demo adds a Japanese form, `type-workshop`

### Step 2 — Multilingual forms ✅

- ✅ A form is written in one language (`locale`), with translations in `forms/<id>/locales/<lang>.json`, keyed by the source text and pulled in via `defineForm({ translations })`; missing entries fall back to the source text instead of breaking
- ✅ Translated automatically: title, description, completion page, policy messages, page titles, label / description / placeholder / unit, option text, Rating end labels, Checkbox text, Submit, Heading / Paragraph, and messages returned by `validate`; custom content uses `<T>` / `useTranslate()`
- ✅ Respondent language: `?lang=` → previous choice → browser language → source language; a language menu in the corner (disable with `languageSwitch: false`, replace with `LanguageSwitch`); `<html lang>` and the tab title switch along with it
- ✅ The language is recorded on submit (new `submissions.locale` column), and server error messages use the respondent's language; it's shown in Studio's response detail and the CSV `Language` column
- ✅ `open-form check` shows `N/N translated` per language plus missing / extra entries; Studio's settings page shows language coverage; having translations without setting `locale` errors out
- ✅ Skills: `create-form` settles the language up front (asking only when necessary), uses explicit option values for multilingual forms, and finishes by generating the locale files and verifying with `check`; `form-authoring` gains a Languages section; AGENTS.md adds "when changing source text, update every locale file"
- ✅ `tr()` supports placeholders (`tr('Workshops × {n}', { n })`), so dynamic text in custom components can be translated too; `aside` and completion page content are included in coverage checks
- ✅ Demo: every form has Chinese and English — English forms gain Traditional Chinese, `產品回饋` (Traditional Chinese) gains English and 日本語, and `タイポグラフィ勉強会` (Japanese) gains Traditional Chinese and English; `conference-pass`, with custom fields, live tickets and a price breakdown, is fully translated too

### Step 3 — Preview inspect mode ✅

- ✅ A step bar above Studio's preview: jump straight to any page (including conditional pages, marked with a dashed style) without filling in every page
- ✅ Jumping enters inspect mode: conditional pages and `<When>` content are all shown with their conditions marked, Next / Back don't validate, and **the last step doesn't submit**; "Start over" returns to normal filling
- ✅ Single-page forms with conditional questions offer "Show conditional questions"
- ✅ Multilingual forms can switch language in the preview
- ✅ Steps are named after the page title or first question (no longer "Step n"); conditional pages are labeled "Conditional" with an explanation of when they appear
- ✅ Conditions are written as plain sentences using question and option text ("Shown when 'Pass' is 'Builder' or 'Patron'"; numeric comparisons keep symbols like `≥`); Studio follows the interface language and annotations inside the preview follow the form's language, in all four languages (`explainCondition`); the CLI still uses field names (`describeCondition`, for agents)

### Step 4 — Security hardening ✅

> The upcoming Webhook, Next.js adapter and Embed steps all widen the external surface, so the existing admin and submission paths get shored up first.

- ✅ Admin API off by default: if `createOpenFormHandler` isn't given `adminAuth`, no Studio endpoints exist (404)
- ✅ dev only allows "direct local connections": loopback connection + loopback `Host` + no proxy headers; anything coming through a tunnel such as ngrok / cloudflared or a reverse proxy always requires `OPEN_FORM_ADMIN_PASSWORD`, with a one-time hint in the terminal on rejection
- ✅ `trustProxy` takes the client IP from the right of `X-Forwarded-For` (`true` or a number of proxy hops), so IPs can no longer be spoofed to bypass rate limits
- ✅ Request body limits are enforced while reading, so chunked transfers (no `content-length`) are caught too
- ✅ Admin password of at least 16 characters (checked at startup; a passphrase of a few words works); sign-in attempts limited to 10 per IP per 10 minutes; HMACs are compared so the password length doesn't leak
- ✅ Security headers: Studio `frame-ancestors 'self'`, `X-Frame-Options`, `Referrer-Policy: same-origin`; `/f/:id` allows only same-origin embedding by default; API responses get `nosniff`
- ✅ CSV formula escaping covers array values (everything except numbers is checked)
- ✅ Deployment docs: HTTPS, the `OPEN_FORM_TRUST_PROXY` hop count, the admin password length requirement, and that changing the password signs everyone out
- ✅ Follow-up hardening after a hands-on security review:
  - The dev server's `fs.deny` excludes `.open-form/` and the DB files (previously `/@fs/` could bypass sign-in and download the whole DB and secret, reachable from the LAN with `--host`)
  - `secure_delete` + `wal_checkpoint(TRUNCATE)` after deletes: no copies remain in the DB or WAL after deleting responses
  - `.open-form/` is `0700` and DB files `0600` (existing files fixed on open)
  - production shows a one-time hint when it detects a proxy (`X-Forwarded-For`) but `OPEN_FORM_TRUST_PROXY` isn't set
  - Webhook URLs must be `https://` (`http://` only for localhost)

### Step 5 — Studio sign-in ✅

> No account system: by default, a single user-chosen admin password; multi-user / SSO is handed off to Clerk or Auth.js via `adminAuth.authorize` + `signInUrl`.

- ✅ `AdminAuth` (`password` / `authorize(request)` / `signInUrl` / `sessionMaxAge`); without it there are no admin routes; `open-form start` reads `OPEN_FORM_ADMIN_PASSWORD`
- ✅ A Studio sign-in screen replaces Basic Auth: `POST /api/studio/session` exchanges the password for a session cookie signed with the secret (`HttpOnly; SameSite=Strict`, `Secure` over HTTPS), 7 days by default, with sign-out in the sidebar; the cookie carries a password fingerprint and becomes invalid when the password changes
- ✅ Any 401 returns to the sign-in screen; when dev is reached from another machine without a password set, it explains that `OPEN_FORM_ADMIN_PASSWORD` must be set
- ✅ The dev file-writing endpoints (themes, folders) share the same gate as the admin API
- ✅ Sign-in UI text in all four Studio languages

### Step 6 — Webhook ✅

- ✅ `webhooks: [{ url, forms? }]` lives in `open-form.config.ts` (the originally planned `onSubmit.webhook` sat in the form config, but form config is bundled into the browser, and the URL itself may be a secret)
- ✅ Standard Webhooks format: `webhook-id` / `webhook-timestamp` / `webhook-signature`, signed with `OPEN_FORM_WEBHOOK_SECRET` (`whsec_…` can be verified directly with the official libraries, tested); a hint at startup when no secret is set
- ✅ Delivered only after the response is sent; failures are retried on a 5-step schedule (0, 5s, 30s, 2m, 10m) with the same id so receivers can dedupe; `410 Gone` stops delivery; each attempt times out after 10 seconds
- ✅ Logs record only the origin, never the payload or URL path; a `waitUntil` option for serverless platforms
- ✅ Studio's settings page lists the form's webhooks (origin only) and whether they're signed
- ✅ form-authoring skill: "send responses to Slack / Zapier" goes in `open-form.config.ts`, not a `fetch` inside the form

### Step 7 — Next.js adapter ✅

- ✅ `@open-form-build/core/next`: `createOpenFormRoute()` → `{ GET, POST, DELETE, OPTIONS }`, mounted at `app/api/[...openform]/route.ts`; defaults to SQLite, `OPEN_FORM_SECRET` and `OPEN_FORM_ADMIN_PASSWORD`, all replaceable
- ✅ App Router route handlers can't render forms, so it reads the server bundle from `open-form build --server-only`; `--watch` pairs with `next dev`, reloading automatically outside production
- ✅ The server bundle is now a single file (split chunks led to two copies of React on reload)
- ✅ `<FormHost id form config theme api />`: render a form in any React app (fetches availability / the timing token and submits to `<api>/forms/<id>/submissions`)
- ✅ No admin routes without `adminAuth` / `OPEN_FORM_ADMIN_PASSWORD`; client IP taken from the right of `X-Forwarded-For`; `waitUntil` for Vercel's `after`
- ✅ Tested on Next.js 16 (Turbopack): submissions succeed with `next build` / `next start`, and with `next dev` + watch, form edits take effect

### Step 8 — Embed ✅

- ✅ `embed.origins` (`open-form.config.ts`): a list of allowed sites or `'*'`; the format is validated at startup
- ✅ `<script src="…/embed.js">` + `<div data-open-form="id">`: the iframe resizes with the form's height, supports `data-open-form-lang`, posts `open-form:submitted` after submission, and `success.redirect` leaves the host page; you can also iframe `/f/<id>?embed` directly
- ✅ CORS enabled only on public endpoints (form status, submission, preflight), without credentials, and never on admin; `frame-ancestors` on `/f/:id` follows the allowlist
- ✅ Third-party iframes can't get cookies: the runtime keeps a random visitor id in localStorage, so `once-per-device` still works
- ✅ `<FormHost api="https://forms.example.com/api">` can be used cross-origin with the same CORS setup
- ✅ Studio's settings page shows the embed code (copyable) and the allowed sites; the form-authoring skill covers embedding
- ✅ Tested: embedding in a cross-site host page, CORS, height tracking, the submit event and shrinking back on the success page; `frame-ancestors` / `embed.js` / preflight in production

### Step 9 — Draft persistence ✅

- ✅ `defineForm({ drafts: true })` (or `{ expires: '1d' }`, 7 days by default): unsubmitted answers and the current step are saved in the respondent's browser localStorage, restored on return with a "Start over" prompt, and cleared on successful submission
- ✅ Off by default: on a shared computer the next person would see the previous person's personal data; Studio previews don't read or write drafts
- ✅ Restoring happens after mount (so `<FormHost>` doesn't cause hydration mismatches under Next.js SSR); silently skipped when storage is blocked
- ✅ Prompt text in all four languages; the form-authoring skill recommends enabling it for long forms; the demo `developer-meetup` enables it

## v0.4 — Agent-native authoring ✅

### Inspector ✅

- ✅ In dev, `vite/loc-plugin.ts` tags every JSX element in `forms/` with `data-of-loc="forms/<id>/index.tsx:line:col"` (inserted inside the tag only, so line numbers don't change); built-in fields carry it to the control via `controlProps` (works with any theme), and `<Form>` / `<Page>` / `<Row>` / `<Heading>` / `<Paragraph>` carry it to their own elements
- ✅ Studio Preview "Locate source": hover outline, click to get the location (without triggering fields or page changes), Esc to exit; the panel shows `file:line` and the field name, with open in editor and copy location
- ✅ The selection is written to `selection` in `current.json`, which the `current-form` skill uses to resolve "this field"

### Comments ✅

- ✅ Panel "Comment": `{/* @form-comment: … */}` inserted above the element (`/* … */` in expression position); Studio lists all comments on the form and can delete them
- ✅ `open-form comments [id] [--json]` lists markers; the `apply-comments` skill applies them one by one, removes the markers and runs `open-form check`, keeping and asking about unclear ones
- ✅ Writes are restricted to `forms/`, require Studio authorization + same-origin, and the text is single-line with `*/` neutralized

### Edit mode (aligned with open-slide) ✅

- ✅ "Locate source" became a "Preview / Edit" toggle in the toolbar; the edit panel is pinned on the right (below the preview under `lg`); "Open in editor" removed
- ✅ Everything is selectable: fields are selected whole; parts drawn by the runtime / theme such as titles, descriptions, progress, buttons and theme decorations can be selected individually; breadcrumbs and "Select parent" go outward to `<Page>` and `<Form>`
- ✅ Direct text editing: label, description, title, placeholder, child text and the title and messages in `config` are written back to source in place, and translation keys are renamed along with them; while previewing another language, that locale's translation can be edited directly
- ✅ Comments moved into the panel, added with ⌘↵; comments on text in `config` go above that property; the toolbar shows the comment count
- ✅ Leaving edit mode (switching back to preview, closing the panel, Esc) always clears the iframe outlines and the selection; Esc deselects first, then exits
- ✅ The preview stays on the same step after source edits; step titles in the progress bar are translated too
- ✅ The preview page switched to an open-slide-style split: one toolbar; a left step rail (titles, question counts, conditions, completion page; collapsed to numbers in edit mode, with hover or keyboard focus showing the step's condition and questions), the preview in the middle (toolbar aligned with the canvas's left edge), and the edit panel on the right; narrow screens fall back to a horizontal step bar

### Themes all belong to the project (aligned with open-slide) ✅

- ✅ Forms only use themes from the project's `themes/`; the package no longer provides themes at runtime and has no built-in default theme (no `theme` = base styles)
- ✅ The 5 built-in themes became starters: `open-form theme add <starter> [--as name]` (replacing `theme eject`); `themes/` is empty after `init`
- ✅ Studio themes page: lists only the project's themes, with cards listing the forms that use them and flagging themes without THEME.md; the empty state points to adding a starter or `/create-theme`; "New theme" can add a starter in one click; forms using a missing theme are listed and the theme can be added in one click; removed the "built-in / local / overriding built-in" labels and the save-a-copy flow
- ✅ `open-form check` warns when a form uses a theme that isn't in `themes/`; demo themes moved to folders under `apps/demo/themes/`, and `midnight` got a THEME.md

### Theme fonts (aligned with open-slide) ✅

- ✅ The body / heading font dropdowns in Studio's "Adjust" panel can "Add from Google Fonts…": search, categories (including CJK), live preview, applied directly after adding
- ✅ Fonts are downloaded into the theme's `fonts/` (woff2, keeping the `unicode-range` subsets) and served by the form itself, so respondents never connect to Google
- ✅ `open-form theme font <id> <family>` for agents; the `create-theme` skill now recommends this instead of linking to `fonts.googleapis.com`

### Themes are references; each form owns its look (aligned with open-slide) ✅

- ✅ A theme in `themes/` is only what agents copy when they create a form: `open-form theme copy <theme> <form>` (or `open-form create <id> --theme <theme>`) copies it into `forms/<form>/theme/`, rescoped to the form id, and `<Form theme={theme}>` applies it — editing or deleting the theme never changes an existing form
- ✅ Removed `theme` from `defineForm()` and `open-form.config.ts`, the missing-theme fallback and its `check` warning; `check` now warns when a form imports from `themes/` or another form
- ✅ Production builds no longer bundle `themes/`; forms don't wait for a theme chunk; `/theme-preview` is dev-only; Edit mode skips `forms/<id>/theme/`
- ✅ Studio's Themes pages became a reference gallery: a "Use it in a form" card instead of "used by", no project-default badge or missing-theme banner; Adjust changes only forms copied later
- ✅ `theme check` / `theme font` take `--form` for a form's own copy; `current.json` reports `formThemePath`
- ✅ Demo: every form carries its own theme; `conference-pass` got its dark `midnight` look back as `forms/conference-pass/theme/`

### A form's look holds only what it uses (aligned with open-slide) ✅

- ✅ Removed `open-form theme copy`: a reference is read, never copied in whole. `open-form create` always writes `forms/<id>/theme/index.ts` and wires it in; `--theme <theme>` starts it from that theme's tokens and the web fonts they name, no CSS or components
- ✅ Agents write the rest of a form's look from the reference, only what the form renders: tokens → CSS on the runtime's own classes → components only for markup or behavior CSS can't give; the skills, the template and the docs say so, and each starter's `THEME.md` lists every token and which parts are CSS or components
- ✅ Studio: the form's Preview has an **Adjust** mode for its own colors, fonts and shape, with a live preview (`runtime.themeDraft`), saving to `forms/<id>/theme/index.ts`; a form without one gets **Create look file**
- ✅ Demo: `contact`, `developer-meetup` and `feedback` slimmed to what they use, looking the same; the reference themes in `apps/demo/themes/` re-synced with the starters

### Submission window ✅

- ✅ Time zones: `opensAt` / `closesAt` are interpreted in the form → project `timeZone` → UTC, no longer the server's time zone (a laptop in Taiwan and a UTC container now agree); supports `YYYY-MM-DDTHH:mm`; `open-form init` writes the local time zone; `open-form check` shows the time zone and warns when none is set
- ✅ Studio's settings page can directly adjust the open / close times, the response limit and pausing submissions (`submissions.closed`)
- ✅ `open-form dev`: writes back to `config.submissions` in `forms/<id>/index.tsx` (Babel AST, changing only the touched values)
- ✅ production: stored as database overrides (`form_overrides`, only values that differ from the code), taking effect immediately with no redeploy; Studio marks them "Adjusted in Studio" and can revert to the settings in code
- ✅ Studio's status is now computed by the server (including overrides and the time zone)

### Excel export ✅

- ✅ `GET /api/forms/:id/export?format=xlsx`, an "Excel" button in Studio, and `open-form responses export <id> -o responses.xlsx` (or `--format xlsx`)
- ✅ No new dependencies: `server/xlsx.ts` writes SpreadsheetML + ZIP itself, compressing with the Web-standard `CompressionStream`, so it runs on Next.js / Workers too
- ✅ Numbers are numbers, `<DateInput>` values are dates, and "Submitted at" is converted to a datetime in the form's time zone (the column name notes the zone); bold header row, frozen panes, filters, and column widths fitted to the content
- ✅ Text is always an inline string, so Excel never evaluates it as a formula and the CSV `'` escaping isn't needed; control characters that XML doesn't allow are removed

## v0.5 — Uploads

- ⬜ `<File>`: stored locally in `.open-form/uploads/` and `submission_files`
- ⬜ Upload security: size / type limits (judged by content, not by trusting the extension), stored filenames generated by the server, downloads require admin authorization and always use `Content-Disposition: attachment`

## v0.6 — Protection & analytics

### Step 1 — CAPTCHA ⬜

- ⬜ Turnstile / hCaptcha (optional)

### Step 2 — Analytics ⬜

- ⬜ Completion rate, drop-off per step

## v0.7 — Remote storage & integrations

> Zapier / Make / n8n can already connect through v0.3's webhooks, so there's no separate integration for them.

### Step 1 — Remote storage 🚧

- ✅ One place picks the adapter (`openStorage`), and a shared contract test suite runs against every adapter
- ✅ Postgres adapter (`@open-form-build/core/postgres`, `pg` as an optional peer dependency): its own `open_form` schema, migrations under an advisory lock, row-locked numbering and `maxResponses` / `uniqueBy`, Studio filters and sorts through the shared JavaScript
- ✅ `OPEN_FORM_DATABASE_URL` / `storage.url`, certificate verification by default, connection strings redacted everywhere they're shown
- ✅ `open-form init` asks for the database and keeps the connection string in `.env`; `open-form check` fails on a password written into `open-form.config.ts`; `open-form db status`
- ✅ Guides: Postgres, Vercel (Neon, Supabase); CI runs the contract tests and the e2e smoke against Postgres
- ⬜ `open-form db copy` to move an existing SQLite database to Postgres, keeping response numbers
- ⬜ Push common filter operators down to SQL for large forms
- ⬜ Turso / libSQL adapter (decided against Drizzle: the queries stay hand-written)

### Step 2 — S3-compatible file storage ⬜

- ⬜ An S3-compatible adapter for `<File>` (S3, R2, MinIO), as an alternative to local `.open-form/uploads/`

### Step 3 — Google Sheets ⬜

- ⬜ Sync new responses to Google Sheets

### Step 4 — Notion ⬜

- ⬜ Sync new responses to a Notion database

## Later

- ⬜ Respondent sign-in (Clerk / Auth.js / Supabase) — only for "require sign-in before filling in the form"; for Studio sign-in, see v0.3 Step 5
- ✅ `@open-form-build/cli` (`npx @open-form-build/cli init`)
- ✅ `create-open-form` (`npm create open-form@latest`)

---

## Explicit non-goals

Typeform clone, drag-and-drop builder, CRM, marketing automation, database SaaS, auth provider, workflow platform.
