---
name: create-form
description: Use when the user wants a new form in this Open Form workspace — "make a registration form", "create a survey / feedback form / signup / waitlist / application / onboarding flow / RSVP / quiz", "I need a form that collects …", or asks to add something under `forms/`. Owns the workflow from scoping and choosing a visual direction to a finished, reviewed form. The technical reference lives in `form-authoring`; new brand looks go through `create-theme`.
---

# Create a form

This skill is the **workflow**. Read `form-authoring` for the *how* (components, props, conditions, config, themes, layouts) before writing code. You write `forms/<id>/`, its own look in `forms/<id>/theme/` included — and `themes/<id>/` only when the chosen direction needs a new reference theme (via `create-theme`).

Run `open-form` through the workspace's package manager and type-check with its `typecheck` script, as AGENTS.md → Commands shows (`pnpm exec open-form`, `npx open-form`, …; `pnpm typecheck`, `npm run typecheck`, …).

A form is a small product moment. Treat its look as a design decision, not a default: every form in this repo should feel chosen for its audience.

## Step 1 — Understand the form

From the user's message, work out:

1. **Purpose & audience** — what the answers feed, and who fills it in (developers? customers? parents? executives?), on what device, and where. Many people on one network (a QR code in a shop, check-in at a venue, a classroom) share one IP address, and the default rate limit allows 10 submissions per IP every 10 minutes: raise `protection.rateLimit` (e.g. `{ max: 60, window: '10m' }`) and say why.
2. **Questions** — must-have vs. nice-to-have.
3. **Logic** — follow-ups that depend on earlier answers (`<When>`), steps only some people see.
4. **Policy** — response limit, open/close dates, one response per email or device.
5. **Limits** — anything the brief needs that Open Form can't do: file uploads, a quiz that scores itself or hides its answers, a repeating group per guest or item, emails to respondents, sign-in or payments (`form-authoring` → *What Open Form can't do*). Tell the user now, with the workaround you'd use, and ask in the same question as Step 2 if the choice is theirs.
6. **Languages** — the language respondents read, and whether some read another one. Infer it: the user's own language and the audience (a Taipei meetup → `zh-TW`; a Japanese customer survey → `ja`) usually settle it. One language → write the form in it and set `locale`. Several → write it in the main one and add a translation per other language (Step 5).
7. **After submit** — thank-you copy, redirect. An event with a known date and time (meetup, workshop, RSVP, class) gets `success.calendar`, so people can save it to Google Calendar or Apple / Outlook from the thank-you screen (`form-authoring` → *Event forms*); a wall-clock time such as `'2026-11-15T19:00'` needs a `timeZone` on the event or the form, while an all-day date or a timestamp with an offset doesn't.
8. **Header facts** — title and a one-line description. Use only facts the user gave (date, venue, price, deadline). Never invent them: omit the detail or ask. Check that the facts agree: a date and its weekday (2026-11-15 is a Sunday, not a Saturday), a deadline before the event. If they don't, ask, and leave the weekday out until you know. Option lists you write yourself (a menu, departments, ticket types) are facts too: keep them generic or ask, and list any you made up as assumptions at hand-off.

If the purpose or the core questions are unclear, ask about them first, in a question of its own — a visual direction can't be recommended for a form you don't understand. If they're clear, restate your reading in one line and move on. Never ask about things you can decide well yourself (field types, ordering, labels).

## Step 2 — Choose a visual direction (ask before writing code)

### 2a. Know what's available

- Run `open-form theme list`: the project's themes (the references in `themes/`) and the **starters** that ship with Open Form (`brutalist`, `classic`, `conversational`, `editorial`, `terminal`). All of them are references: you read one and write this form's look from it; a form never imports or copies one.
- Read the `THEME.md` of the candidates you're considering: the project's in `themes/<id>/THEME.md` (a `themes/<id>.ts` without one is tokens only — read the file), starters' in `node_modules/@open-form-build/core/themes/<id>/THEME.md`.
- Check `themes/` for a house/brand theme — one with real brand colors or a `THEME.md`. **If the project has a brand theme, it is the recommended option** unless the form clearly needs a different voice.

### 2b. Propose three directions

**Start from the audience's world, not from the theme list.** List 5–7 things respondents know from this moment: objects, documents, places, rituals. For a café's QR feedback card: the loyalty stamp card, the receipt, the chalkboard menu, the cup sleeve, the hill outside the window. Cross out the most literal one (a coffee cup), then build each direction from a different item: it gives the palette, the type, the composition and the signature control. The best forms come from here: a wedding RSVP as a reply postcard where guests circle 出席, a job application whose seniority question is a metro line. A starter or project theme is the base you adapt, and the AI-default looks (`form-authoring` → *Design guidelines → Look*) are out unless the brand calls for one.

**Size the directions to the form's moment** (`form-authoring` → *Composition*): a quick operational form (a QR card, an internal sign-up, under a minute) gets a plain column in all three, differing in world, palette and signature control; invitations, event registrations, applications and campaigns get full compositions.

Ask the user — with a multiple-choice question tool if you have one — to pick from **three directions tailored to this form and audience**. Each option combines a theme, a **composition** (how the page is arranged around the questions: `form-authoring` → *Design guidelines → Composition*), a vibe with concrete visual cues and — when the form has one — its **signature element**: the one piece of UI that belongs to this form's purpose (*Design guidelines → Look* in `form-authoring`). Start from the *Signature ideas* in the theme's THEME.md, which say what fits that theme and where it goes in its layout, and fit them to this form. Never bare labels like "modern" or "clean"; "theme X" alone gives a form that looks like every other form in theme X.

Each direction is one of:

- a **project theme or a starter, followed closely** — e.g. `terminal` · CLI prompts, green on black, ASCII progress;
- a **theme adapted for this form** — the form's look is written for it (2c), so recolor it, change its fonts or pair it with a different layout: e.g. `editorial` in forest green and cream; `brutalist` + `StepperLayout` · yellow, thick borders, a step rail;
- a **new theme** — e.g. "match our product: navy + coral from your Tailwind config, Inter, split layout" (built with `create-theme` in `themes/` before writing the form, then used as its reference).

Directions must fit the form's size: pair a theme with `StepperLayout` only when the form has 3+ natural sections, and propose `conversational` / `FocusLayout` only when most questions work one per screen — and do propose it when they do (an NPS survey, a quiz, a few reflective questions): people know it from Typeform. The three should feel meaningfully different, not three shades of one idea. For forms that earn a full composition, **no two directions share one**, and at most one is the plain centered card. A recolored card is not a new direction. Say the composition in words the user can picture ("a gig poster filling the screen, questions in a column on the right"), not only a layout name. Mark the best fit for the purpose and audience as "(Recommended)", and leave room for the user's own answer ("Other").

**Each direction says its color scheme**, in words the user can picture: *follows the device's light and dark* (two palettes), *light only* or *dark only*. Most forms follow the device: respondents in dark mode at night get a dark page instead of a white flash. A direction whose idea depends on one ground is single-scheme on purpose — a terminal is black, a paper document or a yellow poster is light — and says so. When a direction follows the device, name both grounds ("ink on cream; in dark mode, cream on deep green"), so the user isn't surprised by the dark one.

How the options should shift with the brief:

- *Developer meetup registration* → **terminal** (a full-screen terminal window, CLI prompts, green on black, the agenda printed as `$ cat agenda` in a second pane — insiders will smile) · **brutalist poster** (the whole page a loud yellow flyer with the date set huge, the questions on a black-bordered sheet pinned to one side, a seats-left sticker — very shareable) · **editorial split** (serif headline, ink panel with the date and venue set like a masthead — feels curated).
- *Conference registration with ticket tiers* → **dark brand + sticky summary** (a pass beside the questions that fills in with the name, role and tier as people answer) · **editorial hero** (a wide masthead with the speakers and venue, tier tiles with prices below it) · **classic** (compact card, fastest to fill).
- *Café feedback from a QR code on the table* (quick, phone-only) → **stamp card** (a plain column on the café's own colors, the rating answered by stamping a loyalty card, the success screen showing the finished card) · **chalkboard menu** (hand-lettered headings, the questions written like today's specials) · **receipt** (a narrow paper slip, the answers printed like line items).
- *Post-purchase NPS survey* → **conversational** (one question per screen, letter keys, finishes in 30s) · **classic** (compact single card, embeds anywhere) · **brand theme** (your colors, so it feels like part of the product).
- *Enterprise onboarding application, 4 sections* → **document** (a wide paper application: a letterhead band, numbered sections, labels in the margin — feels official) · **brand theme + StepperLayout** (product-native, a step list for the sections, a summary of the answers in the rail) · **classic** (neutral card, fastest to fill).
- *Kids' summer camp sign-up for parents* → **conversational** with warm colors (friendly, mobile-first, one question per screen) · **camp poster** (a new theme: a full-page illustrated landscape drawn in CSS, the week-by-week schedule on it, the questions on a card to one side) · **classic** with a bright primary and the schedule as a sticky summary.
- *School exam or quiz* → **exam paper** (a wide document: a header with name and class lines, numbered questions, an answer grid) · **conversational** (one question per screen, quick) · **chalkboard hero** (the subject in chalk lettering beside the questions).

In the **same** question, also ask anything else still open that shapes the build, e.g.:

- **Flow**, only when it's a real choice (e.g. 8–12 fields that could be one long page or 2–3 sections): single page · sections · one question per screen. For ≤ ~7 fields just use one page, unless the questions suit one per screen (an NPS survey, a quiz), which wins over the field count; for conversational themes it's one question per page.
- **Color scheme**, only when it's a real choice the user hasn't settled: the brief or the brand doesn't say, and the recommended direction could go either way. Offer *follows the device (light + dark)* (Recommended, unless the brand is single-scheme) · *light only* · *dark only*. Skip it when the direction's idea fixes the scheme, the user named one, or the brand theme already decides it (`colorScheme`, or `dark: false` in its tokens). An embedded form (*Putting a form on another site* in `form-authoring`) follows the respondent's device, not the host page's own scheme toggle; when the host site is always light or always dark, give the form the same single scheme.
- **Policy** gaps that change behavior: e.g. with a response limit, "one registration per email?" (duplicates eat into the cap).
- **Languages**, only when the audience plausibly spans languages and the user didn't say (an international conference, a product sold in several countries, "our users in Taiwan and Japan"): offer the main language alone (Recommended when the audience is local) and the likely combinations, e.g. "繁體中文 only · 繁體中文 + English · 繁體中文 + English + 日本語". Don't ask for an obviously single-language audience.

Skip the visual question only when the user already named the look ("use our brand theme", "make it terminal-style") — then restate it in one line so they can correct you.

### 2c. How the look gets into the form

Themes in `themes/` and the starters are **references**: you read the chosen one, and the form never imports or copies it. The form's look is written for it in `forms/<id>/theme/` (Step 5): `index.ts` with its tokens, the form's own CSS, and components only where the look needs markup or behavior the runtime doesn't give. It carries only what this form uses, and editing or deleting a theme in `themes/` never changes it.

A direction that needs a new theme: use the `create-theme` skill first — it writes a reusable reference in `themes/<id>/` — then come back here and use it like any other.

## Step 3 — Pick an id

Kebab-case, short, descriptive: `meetup-registration`, `customer-feedback`, `beta-waitlist`. Check `forms/` for collisions. The id is the public URL `/f/<id>` — avoid internal or embarrassing names.

## Step 4 — Plan the structure for that direction

Re-read the chosen theme's `THEME.md` — its **Copy tone** and **Do / Don't** sections constrain the plan.

- **Conversational / `FocusLayout`**: one question per `<Page>`, no page titles (the label is the question), mostly single-choice questions, branch with `<When>` around pages.
- **Single page**: up to ~7 fields — the default for short forms in any theme.
- **Sections / multi-step**: when there are more fields or clearly separate topics; 3–7 fields per `<Page>`, short page titles (they become the step list or the theme's section headings), last page short.
- Order: easy → personal → effortful; free text near the end; follow-ups right after the question they depend on.
- **Plan the look**, by *Design guidelines → Look* and *Composition* in `form-authoring`: the composition (which `Layout`, what `width`, what fills the page around the questions), where each header fact goes (once), the key question and the signature element (on its control when it has one, otherwise `aside` or a custom `Layout`'s visual side) and how the success screen echoes it, what the first screen on a phone shows, and the success copy with the person's answers in it.
- **Plan both palettes** when the form follows the device: the dark one is designed, not inverted (*Light and dark* in `form-authoring`). Note which parts of the look aren't tokens — an image, an SVG or CSS-drawn motif, a shadow, a texture — and how each reads on the dark ground.
- **Review the plan before writing code.** Read the look plan back and ask, part by part: would I make the same choice for a different café, couple or company? Wherever the answer is yes — the palette, the fonts, a decoration — that part is a default; replace it with something from this audience's world. Check it against the AI-default looks too. Note what you changed for the hand-off.
- **Length and pacing**: with 2+ pages, the description says how many steps and about how long (a range or the time alone when steps depend on answers); `drafts: true` when the form takes more than a few minutes or has long free-text answers, but not on a shared device (*Questions* in `form-authoring`). Keep data entry (name, email, phone) on one page even in a one-question-per-screen form.
- Field types per question (table in `form-authoring`). Names camelCase, stable, unique — they become Responses columns.
- Write copy in the theme's voice and the form's main language. A reference written for English (uppercase labels, italic help, wide letter-spacing) needs its type adapted for Chinese or Japanese (*Design guidelines → Look* in `form-authoring`). Set `locale` to that language — `'en'`, `'zh-TW'` (Traditional Chinese), `'zh-CN'` (Simplified Chinese) or `'ja'` (Japanese). It localizes buttons, validation messages and dates, and picks matching CJK fonts. A form with translations must set it.
- **Multilingual**: give choice options explicit, language-neutral values — `{ value: 'engineer', label: '工程師' }` — so answers mean the same in every language; plain strings would store the main-language label.
- **Plan the closed screen** (*Closed screens* in `form-authoring`). Every form gets one when it closes — by date or from Studio — and the default is generic. Always write `closedMessage` in the form's voice, and `fullMessage` / `duplicateMessage` when you set a limit or uniqueness. When the form is tied to a date, has limited spots or one response per person, or the direction has a strong look, also give it its own `Notice`: the same voice and look as the form, a line per `state` it can reach, and what to do next using only facts the user gave (next date, where to follow, who to contact). If the reference has its own `Notice` (see its `index.tsx`), build the form's from its markup so the screen still looks like the rest of the form — or, when the messages already say everything, skip the component.

## Step 5 — Write `forms/<id>/index.tsx`

Scaffold it from the reference's tokens, then replace the body:

```bash
open-form create <id> --theme <theme>   # forms/<id>/index.tsx + theme/index.ts with <theme>'s tokens, wired up
```

`<theme>` is the project's theme when `themes/<theme>` exists, otherwise the starter of that name. Only its tokens (colors, fonts, radius, width, spacing) and the web fonts they name come in — no CSS, no components. To add a Google Fonts family to the form, run `open-form theme font <id> <Family> --form`; if it fails with `fetch failed`, follow the fallback in `create-theme` → Step 4 (*If `theme font` fails*), writing into `forms/<id>/theme/fonts/`. A font the reference uses only in its CSS (a monospace for code, a Japanese face under `:lang(ja)`) isn't named by a token, so copy its `fonts/<slug>/` folder and `fonts/<slug>.css` into `forms/<id>/theme/fonts/` and import it yourself. Without `--theme` the form starts with an empty `theme/index.ts`: the runtime's default look.

- `export const config = defineForm({ title, description, … })` with only the policy the user asked for. The look isn't config.
- `import theme from './theme/index.ts';` (`index.tsx` once it has components) and `<Form theme={theme}>`. Put that import **above** the form's own CSS import, so the form's CSS wins. Never import from `themes/`.
- `export default function <Name>Form() { return <Form theme={theme}>…</Form>; }` (e.g. `MeetupForm`). Never name it after an `@open-form-build/core` export (`Form`, `Email`): it would render itself, and `open-form check` refuses it. Avoid globals too (`Date`, `Number`): the name shadows them.
- **Write the rest of the look for this form** in `forms/<id>/theme/`, reading the reference's `THEME.md` and its `index.tsx` and CSS (`themes/<theme>/`, or `node_modules/@open-form-build/core/themes/<theme>/` for a starter). Bring over only what this form uses, in this order (`form-authoring` → *Themes*): tokens; then CSS on the runtime's own classes, scoped to `[data-of-theme="<id>"]`; then a component only where the look needs markup or behavior CSS can't give — a window frame, a custom `Layout` for the planned composition, keyboard shortcuts, auto-advance, a glyph in front of an `<input>`. Rename the classes you borrow to a prefix of this form's own (`.tm-…` → `.mt-…`), because another form may already use the reference's and prefixed classes are global. After color changes run `open-form theme check <id> --form`.
- **Set the agreed color scheme in the tokens** (*Light and dark* in `form-authoring`): follows the device → `colors` and a full `dark`; light only → `dark: false`; dark only → `colorScheme: 'dark'` with the dark palette in `colors`. `create --theme` brings the reference's choice; change it when the agreed scheme differs (a recolored `classic` that must stay light needs `dark: false`). The form's CSS uses `var(--of-*)` and `color-mix()` on them, so it follows the scheme by itself; the few rules that can't (a drop shadow, an image) get a dark variant written as *Light and dark* shows.
- Layout via the form's theme (`components: { Layout: SplitLayout }`, or the custom `Layout` the composition needs) or `<Form components={{ Layout: … }}>`. A theme with components is `theme/index.tsx`: in this order: write `index.tsx`, point the form's import at it, run `check`, and only then delete `index.ts` (`form-authoring` → *Themes*).
- The closed screen you planned: a `Notice` component in the form's file (or beside it), passed as `<Form components={{ Notice: … }}>`.
- Import from `@open-form-build/core` and the form's own folder only. No state, fetch, API routes or CSS frameworks.
- Custom UI the DSL can't express → a local component with `useField` + `FieldShell` in `forms/<id>/` (see `form-authoring`), styled with the theme's `--of-*` tokens.
- The signature element: a local component (`forms/<id>/<name>.tsx`) passed as `aside` or used as a field, styled in the form's CSS with prefixed classes on `--of-*` tokens. Restyle the runtime's own parts only through the classes in `form-authoring` → *Custom styling*.
- **Translations** (multilingual forms): after the form is final, write `forms/<id>/locales/<lang>.json` for each extra language — every string respondents see, keyed by the exact text in the form — and pass them as `translations` (see *Languages* in `form-authoring`). Translate for meaning and tone, not word by word; keep it as warm or as formal as the original.

## Step 6 — Self-review

Run the checklist at the end of `form-authoring`, then:

```bash
open-form check <id>   # loads the form like the server does: steps, fields, conditions, policy — or the exact error
pnpm typecheck         # tsc --noEmit, via the workspace's package manager
```

For a multilingual form, `check` lists each language as `N/N translated`; fix every `missing` line before handing off. "Not seen" entries are fine when they're text shown only for certain answers, `validate` messages, or text in a custom `Layout`, `Notice` or `Success` (`check` may not render those); otherwise they're keys left behind by edited text — re-key or remove them. Before removing one, search the form's folder for the text.

### Look at it

`check` proves the form works, not that it looks right. Only a screenshot catches a missing title, CSS that never applied, or a panel that pushes the questions off a phone's first screen. Use whatever browser tool you have (a browser MCP, Playwright, Claude in Chrome, your editor's preview) on the URL `open-form dev` printed (default `http://localhost:3000`); if nothing answers there, start the `dev` script in the background and stop it when you're done.

1. `/f/<id>` at desktop (~1440×900) and phone (~390×844) width — screenshot both and compare them with the agreed direction and *Design guidelines → Look* in `form-authoring`: the composition reads at desktop width as planned (not a lone column in an empty page, unless that was the plan); the title and description show; the form's own CSS applies (`.of-root` has `data-of-theme="<id>"` when the form has its own theme); the signature element reads right; nothing is low-contrast, clipped or overlapping — with translations, nothing sits under the language picker in the top-right corner (`form-authoring` → *Layouts and chrome*); on the phone the first question is on the first screen.
   When the form follows the device, take the desktop and phone shots again in dark mode (emulate `prefers-color-scheme: dark`: Playwright's `colorScheme: 'dark'`, or DevTools → Rendering) and check the same things: no light patch left from a hard-coded color, motifs and shadows still read, the signature element still stands out. A single-scheme form looks the same in both — check that once in the other mode too.
   Then the success screen, which Studio can't preview: submit one real test response (say so at hand-off), screenshot it at desktop width, resize the same page to phone width for the second shot, and check the echo of the signature, that a custom layout's visual side isn't left empty, and, with `success.calendar`, that the calendar buttons sit well in the theme (open the Google Calendar link once: right title, time and place).
2. `/studio/<id>/schema` — the **Schema** tab: the derived steps, fields, required flags and conditions match your plan.
3. `/studio/<id>` — Preview (its frame is narrower than a desktop window, so a custom layout shows its stacked, narrow version there; judge the desktop composition on `/f/<id>`): the step list next to the preview jumps to any page (conditional ones included) without filling earlier ones; nothing is submitted in that mode. *When closed* after the steps shows each closed screen the form can reach — check every one reads right. Multilingual forms have a language picker there too.

Fix what you see and look again. If none of the form's styles apply and `.of-root` says `data-of-theme="default"` although the form passes `<Form theme>`, that's a runtime problem: tell the user instead of working around it with unscoped CSS.

Without a browser tool, `open-form check` is enough to hand off — but say that you haven't seen the form, and ask the user to open `/f/<id>`.

## Step 7 — Hand off

Tell the user, briefly:

- the public link `/f/<id>` and Studio `/studio/<id>`, on the dev server's URL (default `http://localhost:3000`);
- the direction you built (theme + layout + signature element + color scheme) and any policy you applied, what the plan review changed, and whether you looked at it on desktop and phone, in light and dark;
- what respondents see once it closes, and that Studio's Preview shows it under *When closed*;
- for multilingual forms: the languages, that respondents get theirs automatically (or via the picker / `?lang=ja`), and that editing text means updating each `locales/*.json`;
- assumptions you made, including anything you invented (option lists) and every limit you worked around (*What Open Form can't do*);
- that preview submissions are real and can be deleted under Responses;
- that the form's look lives in `forms/<id>/theme/` and is theirs to change — edit it, ask you, or use **Adjust** in Studio's preview for colors, fonts and shape; `themes/` is the reference library for new forms, and changing it won't touch this one.
