# @open-form-build/core

## 0.2.0

### Breaking Changes

- d14a932: `OPEN_FORM_ADMIN_PASSWORD` must now use at least 8 different characters and not just repeat a word or pattern (`passwordpassword`); a server with such a password stops at startup with a message saying so. Change a weak password before upgrading a deployment.
- 1ea5bd2: Removes `open-form theme copy`: a form's look lives in its own `forms/<id>/theme/` with only the tokens, CSS and components it uses, and themes in `themes/` are references agents read. `open-form create` now always writes `theme/index.ts`, and `--theme` brings in only that theme's tokens and the web fonts they name.

### Minor Changes

- d1e8ef2: Adds `<Matrix>`: several single-choice questions sharing one set of answers, drawn as a grid on wide forms and a card per row on phones; each row is stored, exported and usable in `<When>` like its own field, and themes can restyle it with the `Matrix` and `MatrixRow` components.
- 3372880: Adds `studio: { public: 'read-only' }` to `open-form.config.ts`: under `open-form start`, anyone can read Studio, responses included, without signing in, while deleting responses and changing schedules still need the admin password.
- 1ea5bd2: Studio's form preview gains an **Adjust** mode for the form's own colors, fonts and shape, previewed live and saved to `forms/<id>/theme/index.ts`; a form without a look file gets a button that creates it and wires it into the form.
- d1e8ef2: `<Tel>` takes `defaultCountry` and `countries` to show a country picker beside the number and store answers as international numbers (`+886912345678`); themes can restyle the pair with the new `PhoneInput` component.

### Patch Changes

- 1ea5bd2: `open-form check` warns when a form's own theme defines components for parts the form never renders, such as a `Rating` in a form without a rating, and when the form doesn't import its own theme at all.
- d1e8ef2: CSV exports write a `+` followed only by digits, such as an international phone number, as stored instead of with a leading `'`.
- d14a932: The workspace README links the new Docker and Railway deployment guides.
- b6cfdd7: Studio's design panel adds a color to a one-line `colors` or `dark` object on that same line instead of splitting it across lines with the wrong indentation.
- d1e8ef2: Text inputs, textareas, choice groups, ratings and matrices leave the same gap under their label as other fields, and error messages no longer sit flush against the control.
- 1ea5bd2: The `form-authoring` skill keeps every form readable from `index.tsx` alone: questions, pages, conditions and field names stay there, other files are added only for large components or option lists, and the form's folder stays flat apart from `theme/` and `locales/`.
- d14a932: Submissions caught by the honeypot no longer answer `409`, so they can't be used to check unseen whether a `uniqueBy` value has already responded.
- a708822: `open-form init` with bun ends with `bun run dev`, the same command the workspace's README and AGENTS.md use.
- d1e8ef2: The language picker on translated forms no longer covers the title, card or the `terminal` theme's title bar on narrow screens: the built-in layouts and the `terminal` starter start below it, and the skills tell agents to keep its corner clear in custom layouts.
- d14a932: The Next.js route warns once in production outside Vercel when it relies on the default `trustProxy`, since `next start` exposed without a proxy lets clients spoof their IP past rate limits.
- d14a932: The "Form not found" page is redesigned: an illustration, a short explanation that the link may be mistyped or the form is no longer available, and the visitor's own language. `<FormHost>` shows the same explanation instead of the closed-form message.
- 1ea5bd2: The workspace README and the `AdminAuth.password` docs list every rule for `OPEN_FORM_ADMIN_PASSWORD`, including at least 8 different characters.
- d14a932: Warns once when a Studio sign-in reaches the server over plain HTTP from another machine, since the password crossed the network unencrypted.
- d14a932: `open-form start` sends `Strict-Transport-Security` on pages served over HTTPS and limits Studio to its own scripts with a `Content-Security-Policy`.
- d14a932: The generated signing secret is now written next to the database, so pointing `OPEN_FORM_DB` or `storage.path` at a volume keeps the secret across redeploys too; an existing `.open-form/secret` is carried over.
- 1ea5bd2: The package README and `createOpenFormRoute()`'s option docs say the generated secret sits next to the database, and that the default database follows `storage.path`.
- 1ea5bd2: `open-form build --help` names the Next.js entry by its package, `@open-form-build/core/next`, for `--server-only`.
- d14a932: Studio's settings footer keeps "Unsaved changes" on the same baseline as the text beside it.
- 904b214: The brutalist, conversational, editorial and terminal starter themes draw `<Matrix>` in their own style instead of the default radios.
- 904b214: The editorial, terminal, conversational and brutalist starters restyle the runtime's own labels, choices, checkbox, select, matrix and buttons in CSS, keeping components only where the look needs their markup or behavior, so agents borrowing from them copy less; a checkbox's required `*` now stays on the line with its text.
- b6cfdd7: Studio's pages are sent with `X-Robots-Tag: noindex, nofollow`, so search engines don't list a deployment's Studio, including a public read-only demo.
- b6cfdd7: Studio fits on a phone: the forms list's status and sort menus stay on screen on one line each, search gets its own row, and a form's tabs and preview no longer push the page sideways.
- d14a932: Forms can be unpublished with `defineForm({ published: false })` or the new **Published** switch in Studio's settings: the link and API answer "not found" while Studio still lists, previews and keeps the form's responses.
- d14a932: `open-form start` and `open-form dev` no longer stall a kept-alive connection after refusing a request without reading its body, such as an oversized submission, so the next request a reverse proxy sends down that connection is answered instead of timing out.

## 0.1.1

### Patch Changes

- ba78eb6: Going back to an earlier step no longer carries over the "Please fix the highlighted fields." alert from the step you left.
- ba78eb6: Fixes `open-form check`, `theme check` and `responses export` blanking a running `open-form dev` until it restarts.
- 8104dc4: Adds `npm create open-form@latest` (also `pnpm create open-form`, `yarn create open-form` and `bunx create-open-form`) for creating a workspace.
- ba78eb6: Fixes forms losing their title, description and own theme CSS under `open-form dev` in workspaces installed from npm.
- b8f0545: Studio's Responses tab gathers Excel, CSV and JSON under one Export menu that says what each format is for and that exports include every response.
- b8f0545: Studio's Preview can collapse its step list to just the numbers (`Cmd`/`Ctrl` + `B`), for a wider preview; the choice is remembered.
- b8f0545: Studio's `Cmd`/`Ctrl` + `K` search also works while focus is inside the form preview.
- b8f0545: Studio's Responses tab has Notion-style filters: add rules on any question or the submission time (contains, is, greater than, has any of, is before, in the past N days, is empty, and more), and match all or any of them. Bulk selection follows the filters too.
- b8f0545: Studio's Responses table sorts by any column: click a heading for ascending, descending or a filter on it. Choice questions sort in the order of their options, and empty answers come last.
- b8f0545: Studio Settings tab fills the page width instead of a narrow column.
- d8b5bb6: Form skills now plan a signature element for each form, follow concrete design guidelines and styling hooks, and screenshot the form at desktop and phone width before handing off.
- d8b5bb6: Starter themes' THEME.md now suggest signature elements that fit each theme, and where they go in its layout.

## 0.1.0

### Minor Changes

- df6d085: Initial release: write forms as React code (multi-step pages, conditions, validation, drafts, translations); collect responses with spam protection, SQLite storage, webhooks and CSV, Excel or JSON export; manage, edit and organize them in Studio; style them with themes each form keeps its own copy of; embed them on other sites; deploy with the Node server or a Next.js route; and build them with your agent through the `open-form` CLI and built-in skills.
