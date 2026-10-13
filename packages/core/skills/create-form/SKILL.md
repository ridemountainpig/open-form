---
name: create-form
description: Use when the user wants a new form in this Open Form workspace — "make a registration form", "create a survey / feedback form / signup / waitlist / application / onboarding flow / RSVP / quiz", "I need a form that collects …", or asks to add something under `forms/`. Owns the workflow from scoping and choosing a visual direction to a finished, reviewed form. The technical reference lives in `form-authoring`; new brand looks go through `create-theme`.
---

# Create a form

This skill is the **workflow**. Read `form-authoring` for the *how* (components, props, conditions, config, themes, layouts) before writing code. You write `forms/<id>/`, its own look in `forms/<id>/theme/` included — and `themes/<id>/` only when the chosen direction needs a new theme (via `create-theme`).

Run `open-form` through the workspace's package manager and type-check with its `typecheck` script, as AGENTS.md → Commands shows (`pnpm exec open-form`, `npx open-form`, …; `pnpm typecheck`, `npm run typecheck`, …).

A form is a small product moment. Treat its look as a design decision, not a default: every form in this repo should feel chosen for its audience.

## Step 1 — Understand the form

From the user's message, work out:

1. **Purpose & audience** — what the answers feed, and who fills it in (developers? customers? parents? executives?), on what device.
2. **Questions** — must-have vs. nice-to-have.
3. **Logic** — follow-ups that depend on earlier answers (`<When>`), steps only some people see.
4. **Policy** — response limit, open/close dates, one response per email or device.
5. **Languages** — the language respondents read, and whether some read another one. Infer it: the user's own language and the audience (a Taipei meetup → `zh-TW`; a Japanese customer survey → `ja`) usually settle it. One language → write the form in it and set `locale`. Several → write it in the main one and add a translation per other language (Step 5).
6. **After submit** — thank-you copy, redirect.
7. **Header facts** — title and a one-line description. Use only facts the user gave (date, venue, price, deadline). Never invent them: omit the detail or ask.

If the purpose or the core questions are unclear, ask about them first, in a question of its own — a visual direction can't be recommended for a form you don't understand. If they're clear, restate your reading in one line and move on. Never ask about things you can decide well yourself (field types, ordering, labels).

## Step 2 — Choose a visual direction (ask before writing code)

### 2a. Know what's available

- Run `open-form theme list`: the project's themes (the references in `themes/`) and the **starters** that ship with Open Form (`brutalist`, `classic`, `conversational`, `editorial`, `terminal`). Any of them can be copied into a form.
- Read the `THEME.md` of the candidates you're considering: the project's in `themes/<id>/THEME.md` (a `themes/<id>.ts` without one is tokens only — read the file), starters' in `node_modules/open-form/themes/<id>/THEME.md`.
- Check `themes/` for a house/brand theme — one with real brand colors or a `THEME.md`. **If the project has a brand theme, it is the recommended option** unless the form clearly needs a different voice.

### 2b. Propose three directions

Ask the user — with a multiple-choice question tool if you have one — to pick from **three directions tailored to this form and audience**. Each option combines a theme, a layout and a vibe with concrete visual cues, so the user can picture it — never bare labels like "modern" or "clean".

Each direction is one of:

- a **project theme or a starter as-is** — e.g. `terminal` · CLI prompts, green on black, ASCII progress;
- a **theme + a different layout** — e.g. `brutalist` + `StepperLayout` · yellow, thick borders, a step rail;
- a **new theme** — e.g. "match our product: navy + coral from your Tailwind config, Inter, split layout" (built with `create-theme` in `themes/` before writing the form, then copied in).

Directions must fit the form's size: pair a theme with `StepperLayout` only when the form has 3+ natural sections, and propose `conversational` / `FocusLayout` only when most questions work one per screen. The three should feel meaningfully different, not three shades of one idea. Mark the best fit for the purpose and audience as "(Recommended)", and leave room for the user's own answer ("Other").

How the options should shift with the brief:

- *Developer meetup registration* → **terminal** (CLI prompts, green on black — insiders will smile) · **brutalist** (loud yellow card, chunky blocks, very shareable) · **editorial split** (serif headline, ink panel — feels curated).
- *Post-purchase NPS survey* → **conversational** (one question per screen, letter keys, finishes in 30s) · **classic** (compact single card, embeds anywhere) · **brand theme** (your colors, so it feels like part of the product).
- *Enterprise onboarding application, 4 sections* → **editorial split** (premium, considered) · **brand theme + StepperLayout** (product-native, a step list for the sections) · **classic** (neutral, fastest to fill).
- *Kids' summer camp sign-up for parents* → **conversational** with warm colors (friendly, mobile-first) · **classic** with a bright primary · a new **soft playful** theme (rounded, pastel, illustrated feel).

In the **same** question, also ask anything else still open that shapes the build, e.g.:

- **Flow**, only when it's a real choice (e.g. 8–12 fields that could be one long page or 2–3 sections): single page · sections · one question per screen. For ≤ ~7 fields just use one page; for conversational themes it's one question per page.
- **Policy** gaps that change behavior: e.g. with a response limit, "one registration per email?" (duplicates eat into the cap).
- **Languages**, only when the audience plausibly spans languages and the user didn't say (an international conference, a product sold in several countries, "our users in Taiwan and Japan"): offer the main language alone (Recommended when the audience is local) and the likely combinations, e.g. "繁體中文 only · 繁體中文 + English · 繁體中文 + English + 日本語". Don't ask for an obviously single-language audience.

Skip the visual question only when the user already named the look ("use our brand theme", "make it terminal-style") — then restate it in one line so they can correct you.

### 2c. How the look gets into the form

Themes in `themes/` and the starters are references. The form gets its **own copy** of the chosen one in `forms/<id>/theme/` (Step 5) and owns its look from then on: editing or deleting the theme in `themes/` never changes it, and you're free to adapt the copy for this form — tokens, components, CSS.

A direction that needs a new theme: use the `create-theme` skill first — it writes a reusable reference in `themes/<id>/` — then come back here and copy it in like any other.

## Step 3 — Pick an id

Kebab-case, short, descriptive: `meetup-registration`, `customer-feedback`, `beta-waitlist`. Check `forms/` for collisions. The id is the public URL `/f/<id>` — avoid internal or embarrassing names.

## Step 4 — Plan the structure for that direction

Re-read the chosen theme's `THEME.md` — its **Copy tone** and **Do / Don't** sections constrain the plan.

- **Conversational / `FocusLayout`**: one question per `<Page>`, no page titles (the label is the question), mostly single-choice questions, branch with `<When>` around pages.
- **Single page**: up to ~7 fields — the default for short forms in any theme.
- **Sections / multi-step**: when there are more fields or clearly separate topics; 3–7 fields per `<Page>`, short page titles (they become the step list or the theme's section headings), last page short.
- Order: easy → personal → effortful; free text near the end; follow-ups right after the question they depend on.
- Field types per question (table in `form-authoring`). Names camelCase, stable, unique — they become Responses columns.
- Write copy in the theme's voice and the form's main language. Set `locale` to that language — `'en'`, `'zh-TW'` (Traditional Chinese), `'zh-CN'` (Simplified Chinese) or `'ja'` (Japanese). It localizes buttons, validation messages and dates, and picks matching CJK fonts. A form with translations must set it.
- **Multilingual**: give choice options explicit, language-neutral values — `{ value: 'engineer', label: '工程師' }` — so answers mean the same in every language; plain strings would store the main-language label.
- **Plan the closed screen** (*Closed screens* in `form-authoring`). Every form gets one when it closes — by date or from Studio — and the default is generic. Always write `closedMessage` in the form's voice, and `fullMessage` / `duplicateMessage` when you set a limit or uniqueness. When the form is tied to a date, has limited spots or one response per person, or the direction has a strong look, also give it its own `Notice`: the same voice and look as the form, a line per `state` it can reach, and what to do next using only facts the user gave (next date, where to follow, who to contact). If the theme ships its own `Notice` (see its `index.tsx`), the form's copy gets it too: adapt it in `forms/<id>/theme/`, or build yours from its markup and classes so the screen still looks like the theme — or, when the messages already say everything, skip the component.

## Step 5 — Write `forms/<id>/index.tsx`

Scaffold it with the look already copied in, then replace the body:

```bash
open-form create <id> --theme <theme>   # forms/<id>/index.tsx + forms/<id>/theme/, wired up
open-form theme copy <theme> <id>       # the folder already exists: copy the theme in, then wire it yourself
```

`<theme>` is the project's theme when `themes/<theme>` exists, otherwise the starter of that name.

- `export const config = defineForm({ title, description, … })` with only the policy the user asked for. The look isn't config.
- `import theme from './theme/index.tsx';` (or `index.ts` — whichever the copy has) and `<Form theme={theme}>`. Put that import **above** the form's own CSS import, so the form's CSS wins. Never import from `themes/`.
- `export default function <Name>Form() { return <Form theme={theme}>…</Form>; }` (e.g. `MeetupForm`). Never name it after an `@open-form-build/core` export (`Form`, `Email`): it would render itself, and `open-form check` refuses it. Avoid globals too (`Date`, `Number`): the name shadows them.
- Adapt the copy in `forms/<id>/theme/` when the direction calls for it — tokens, components, CSS. It's this form's alone. After color changes run `open-form theme check <id> --form`.
- Layout only via the form's theme or `<Form components={{ Layout: … }}>` when the direction pairs a theme with a different layout.
- The closed screen you planned: a `Notice` component in the form's file (or beside it), passed as `<Form components={{ Notice: … }}>`.
- Import from `@open-form-build/core` and the form's own folder only. No state, fetch, API routes or CSS frameworks.
- Custom UI the DSL can't express → a local component with `useField` + `FieldShell` in `forms/<id>/` (see `form-authoring`), styled with the theme's `--of-*` tokens.
- **Translations** (multilingual forms): after the form is final, write `forms/<id>/locales/<lang>.json` for each extra language — every string respondents see, keyed by the exact text in the form — and pass them as `translations` (see *Languages* in `form-authoring`). Translate for meaning and tone, not word by word; keep it as warm or as formal as the original.

## Step 6 — Self-review

Run the checklist at the end of `form-authoring`, then:

```bash
open-form check <id>   # loads the form like the server does: steps, fields, conditions, policy — or the exact error
pnpm typecheck         # tsc --noEmit, via the workspace's package manager
```

For a multilingual form, `check` lists each language as `N/N translated`; fix every `missing` line before handing off. "Not seen" entries are fine when they're text shown only for certain answers or `validate` messages; otherwise they're keys left behind by edited text — re-key or remove them.

If the dev server is running, also open these on the URL `open-form dev` printed (default `http://localhost:3000`):

- `/studio/<id>/schema` — the **Schema** tab: the derived steps, fields, required flags and conditions match your plan;
- `/studio/<id>` — Preview on desktop **and** mobile; the direction reads as intended. The step list next to the preview jumps to any page (conditional ones included) without filling earlier ones; nothing is submitted in that mode. *When closed* after the steps shows each closed screen the form can reach — check every one reads right. Multilingual forms have a language picker there too.

If it isn't running, `open-form check` is enough to hand off; mention that the user can preview with the dev script (`open-form dev`).

## Step 7 — Hand off

Tell the user, briefly:

- the public link `/f/<id>` and Studio `/studio/<id>`, on the dev server's URL (default `http://localhost:3000`);
- the direction you built (theme + layout) and any policy you applied;
- what respondents see once it closes, and that Studio's Preview shows it under *When closed*;
- for multilingual forms: the languages, that respondents get theirs automatically (or via the picker / `?lang=ja`), and that editing text means updating each `locales/*.json`;
- assumptions you made;
- that preview submissions are real and can be deleted under Responses;
- that the form's look lives in `forms/<id>/theme/` and is theirs to change (edit it, or ask you); `themes/` is the reference library for new forms, and changing it won't touch this one.
