---
name: form-authoring
description: Technical reference for writing or editing forms in an Open Form workspace — the file contract, every DSL component and prop, conditional logic with <When>, validation, custom validators and custom field components, submission policy (limits, deadlines, one-per-email/device), spam protection, success screens, locale, themes, styling hooks and design guidelines for how a form should look. Read this before creating or changing anything under `forms/`. Use `create-form` for the end-to-end workflow of drafting a new form.
---

# Authoring forms with Open Form

You describe **questions + logic**. Open Form owns everything else: state, validation (client *and* server), multi-step navigation, focus management, accessibility, responsive layout, submission, spam protection, storage, Responses. Your job is a short, declarative file.

Run `open-form` through the workspace's package manager and type-check with its `typecheck` script, as AGENTS.md → Commands shows (`pnpm exec open-form`, `npx open-form`, …; `pnpm typecheck`, `npm run typecheck`, …).

## File contract

```
forms/<id>/index.tsx        ← required; <id> is kebab-case and becomes /f/<id>
forms/<id>/<name>.tsx       ← optional: a large local component, or an option/price list (`.ts`)
forms/<id>/<name>.css       ← optional: the form's own CSS
forms/<id>/theme/           ← the form's own look: tokens in index.ts, plus the CSS and components it needs (see *Themes*)
forms/<id>/locales/         ← optional: one <lang>.json per extra language (see *Languages*)
themes/<theme-id>/          ← optional reference themes for new forms; forms never import them (see create-theme)
```

`index.tsx` is the form: read on its own, it tells what the form asks.

- **Questions and logic stay in `index.tsx`**: `config`, every `<Page>` and `<When>`, and every field's `name` and `label`. A local component gets them as props (`<PlanPicker name="plan" label="Which plan?" />`) and never declares a field of its own.
- **Write everything in `index.tsx` first.** Move a piece to its own file only when it's a large presentational component (an `aside`, an illustration, a custom field built on `useField`) or a data list (options, prices) — not for a few lines of JSX.
- **Keep the folder flat.** Other files sit next to `index.tsx`; the only subfolders are `theme/` and `locales/`. No `components/`, `utils/` or `lib/` folders, and no README or notes files.

```tsx
import { defineForm, Email, Form, Page, Select, Submit, Text, When } from '@open-form-build/core';
import theme from './theme/index.tsx'; // its own look, written after the terminal reference

export const config = defineForm({
  title: 'Developer Meetup Registration',
  // Only because the brief asked for 100 seats; add policy only when requested.
  submissions: { maxResponses: 100, uniqueBy: 'email' },
});

export default function MeetupRegistration() {
  return (
    <Form theme={theme}>
      <Page title="About you">
        <Text name="name" label="Name" required autoComplete="name" />
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

Rules:

- Exactly one `<Form>` per file, rendered by the default export. Name that component after the form (`MeetupRegistration`). Named like an `@open-form-build/core` export (`Form`, `Email`, `Text`), it would render itself, so `open-form check` refuses it; avoid globals too (`Date`, `Number`), which the name would shadow.
- `config.title` / `config.description` render as the form header — don't repeat them in the JSX.
- Every input needs a unique, stable, camelCase `name`. It is the database key and CSV column.
- The look is the form's own theme in `./theme/`, passed as `<Form theme>`. Never import from `themes/` or another form's folder.
- The form renders **once on the server** to derive its schema. Don't touch `window`, `document` or `localStorage` during render (effects are fine). Don't generate field names randomly or from `Date.now()`.

## Structure

| Component | Use |
| --- | --- |
| `<Form>` | Root. Optional `title` / `description` override `config`; `theme` is the form's own look from `./theme/` (see *Themes*); `aside` adds a side column (see *Live answers*); `components` swaps fields, chrome or the whole `Layout`, over the theme's (see *Themes*); `className` for form-specific CSS. |
| `<Page title description>` | One step. With 2+ pages you get progress, Back/Next and per-step validation automatically. No pages = single-page form. |
| `<When …>` | Show children only while a condition holds (see below). Wrapping whole `<Page>`s makes **conditional steps** (skip logic). |
| `<Row>` | Put 2–3 short fields side by side; stacks on phones. Great for first/last name, city/zip. |
| `<Heading>` / `<Paragraph>` | Section title / explanatory copy between fields. |
| `<Submit>` | Final button label, e.g. `<Submit>Register</Submit>`. Back/Next are automatic. |
| `<Success title="…">…</Success>` | Custom thank-you screen. Or use `config.success`. |

Top-level content outside `<Page>`s in a multi-page form renders above every step — use sparingly.

## Fields

Shared props: `name` (required), `label`, `description` (help text under the label), `required`, `defaultValue`, `validate`.

| Component | Stored as | Extra props |
| --- | --- | --- |
| `<Text>` | string | `placeholder`, `minLength`, `maxLength`, `pattern` (+ `patternMessage`), `autoComplete` |
| `<Email>` | string | same as Text; validates email format |
| `<Url>` | string | same as Text; requires `http(s)://` |
| `<Tel>` | string | same as Text; loose phone format. `defaultCountry="TW"` and/or `countries={['TW', 'HK']}` add a country picker and store `+886912345678` |
| `<Textarea>` | string | same as Text + `rows`; shows a counter when `maxLength` is set |
| `<NumberInput>` | number | `min`, `max`, `step`, `integer`, `unit` (suffix like `"years"`), `placeholder` |
| `<DateInput>` | `YYYY-MM-DD` | `min`, `max` (`YYYY-MM-DD`) |
| `<Select>` | string | `options`, `placeholder` |
| `<RadioGroup>` | string | `options`, `variant="list" \| "cards"` |
| `<CheckboxGroup>` | string[] | `options`, `minSelected`, `maxSelected`, `variant` |
| `<Checkbox>` | boolean | children = inline text. `required` means it must be checked (terms, consent). |
| `<Rating>` | number | `min` (default 1), `max` (default 5), `lowLabel`, `highLabel`. Use `min={0} max={10}` for NPS. |
| `<Matrix>` | one string per row | `columns` (shared answers, like `options`), `rows={[{ name, label, required? }]}`, `label`, `required`. Each row is its own single-choice field: own `name`, export column, `<When field>`. |

Labels, descriptions and option labels are plain strings. A question that needs code, a formula or an image between its label and its options (a programming quiz) is a custom field: `useField` + `FieldShell` (*Custom fields*), rendering the snippet in a `<pre><code>` styled with a monospace stack, with the choices below it.

Use `<Matrix>` when three or more questions share the same answers (rate each part of a course); it's a grid on wide forms and a card per row on phones. Write row labels that read on their own — they're the export column headings.

`variant` on choices is a hint: built-in themes may render choices their own way (e.g. `terminal` always lists them).

`options` accepts `['A', 'B']` or `[{ value: 'a', label: 'A' }]`. Use value/label pairs when labels may change later or are long — the stored value stays stable. Options must be known when the form renders (the server checks answers against them), so an empty list fails `check`.

For phone numbers people may enter from more than one country, or that you'll call or text later, give `<Tel>` a `defaultCountry` (ISO code: `'TW'`, `'US'`). Respondents pick a country and type the number as they would at home (`0912-345-678`); it's stored as one international number. `countries` limits the picker and the accepted numbers to those countries' calling codes (regions sharing one, like the US and Canada on `+1`, can't be told apart), and `defaultCountry` must be one of them.

Use `autoComplete` on personal fields (`name`, `given-name`, `family-name`, `organization`, `street-address`, `postal-code`, `country-name`). `Email`, `Tel`, `Url` set it automatically.

## Conditional logic — `<When>`

```tsx
<When field="role" equals="Student">…</When>
<When field="role" notEquals="Other">…</When>              {/* also while unanswered */}
<When field="role" in={['Engineer', 'Designer']}>…</When>
<When field="role" notIn={['Student', 'Other']}>…</When>   {/* also while unanswered */}
<When field="interests" contains="AI">…</When>             {/* CheckboxGroup: that option is ticked */}
<When field="phone" filled>…</When>                        {/* or `empty`: no answer */}
<When field="nps" lte={6}>…</When>                         {/* gt / gte / lt / lte */}
<When field="agree" equals={true}>…</When>                 {/* equals={false}: unticked, even if never touched */}
<When all={[{ field: 'role', equals: 'Student' }, { field: 'country', equals: 'Taiwan' }]}>…</When>
<When any={[{ field: 'a', filled: true }, { field: 'b', filled: true }]}>…</When>
<When not={{ field: 'plan', equals: 'free' }}>…</When>
<When condition={isStudent}>…</When>                       {/* one condition object, e.g. reused */}
```

- Props given together on one `<When>` must all hold. "No answer" is blank text, an unticked `Checkbox`, an empty `CheckboxGroup` or an untouched field.
- On a `CheckboxGroup`: `equals` = exactly that one option ticked; `notEquals` = anything but exactly that one; `in` = at least one listed option ticked; `notIn` = none of them ticked (unanswered too); `contains` = that option ticked, whatever else is.
- Hidden fields are not validated and their values are **dropped on the server**, so `required` inside `<When>` means "required when shown". A hidden field also counts as unanswered in other conditions.
- One name may appear twice only with the same type, in `<When>` branches that never show together (e.g. `postal` for US and for CA); each copy keeps its own `validate`. The same name twice under the same conditions fails `check`.
- Conditions may reference fields on earlier pages.
- Conditional steps: `<When field="role" equals="Engineer"><Page title="Work">…</Page></When>`. The step is skipped and the progress bar adjusts.

## Validation

Built-in props cover almost everything: `required`, `minLength`/`maxLength`, `pattern`, `min`/`max`/`integer`/`step`, `minSelected`/`maxSelected`, date `min`/`max`, plus format checks for Email/Url/Tel and option membership for choices. The **same** rules run in the browser and on the server. `pattern` must match the whole value; it's compiled with the `u` flag, or without it if that fails, and a pattern that compiles neither way fails `check`.

Custom rules — `validate` takes a function returning an error message, or any Standard Schema (Zod, Valibot, ArkType) if the project already has one installed. It runs on both sides too.

```tsx
const workEmail = (value: unknown) =>
  /@(gmail|yahoo|hotmail|outlook)\./i.test(String(value)) ? 'Please use your work email.' : undefined;

<Email name="email" label="Work email" required validate={workEmail} />
```

Custom validators receive `(value, allValues)` and only run when the field has a value.

## Custom fields

Any React UI can be a field. `useField` wires it into state, validation, errors, focus and storage; `FieldShell` renders the standard label/help/error around it.

```tsx
// forms/onboarding/plan-picker.tsx
import { FieldShell, useField } from '@open-form-build/core';

const plans = [{ value: 'free', label: 'Free' }, { value: 'pro', label: 'Pro' }];

export function PlanPicker({ name, label }: { name: string; label: string }) {
  // 'radio' checks the answer against options; omit `type` ('custom') for free-form values
  const field = useField({ name, label, type: 'radio', required: true, options: plans });
  const { 'aria-invalid': invalid, 'aria-describedby': describedBy } = field.controlProps;
  return (
    <FieldShell field={field} as="fieldset">
      {plans.map((plan, i) => (
        <label key={plan.value} className="plan-tile">
          <input
            ref={i === 0 ? field.ref : undefined}   // focus target when invalid
            type="radio"
            name={field.name}
            value={plan.value}
            checked={field.value === plan.value}
            aria-invalid={invalid}
            aria-describedby={describedBy}
            onChange={() => field.setValue(plan.value)}
            onBlur={field.onBlur}
          />
          {plan.label}
        </label>
      ))}
    </FieldShell>
  );
}
```

`useField` returns `name`, `value`, `setValue`, `onBlur`, `error`, `invalid`, `required`, `ref`, and `controlProps` (id, name, aria-* and onBlur — spread it on a native input; in a group, pass `aria-invalid` / `aria-describedby` to each control as above). Style custom fields with the theme tokens (`var(--of-primary)`, `var(--of-control)` for control outlines, `var(--of-border)`, `var(--of-radius)`, `var(--of-input)`, `var(--of-muted)`, `var(--of-fg)`) so they match.

## Live answers — previews, summaries, prices

Forms are React, so UI can react to answers. Read them with hooks from `@open-form-build/core` anywhere inside `<Form>`:

- `useFieldValue(name)` — one answer, re-renders only when it changes.
- `useFormValues()` — all answers so far.

Put display-only UI in `<Form aside={…}>`: a side column on wide screens, stacked below the questions on narrow ones, shown only while the form is being filled in (not on the success or closed screens; reuse the component in `<Success>`). Ideal for a live preview, an order summary or a running total. `FocusLayout` doesn't show `aside`. `<Success>` children can use the same hooks to show a personalised confirmation.

```tsx
function Summary() {
  const tier = useFieldValue<string>('tier');
  const seats = Number(useFieldValue('seats') ?? 1);
  return <p>Total: ${(tier === 'pro' ? 20 : 0) * seats}/mo</p>;
}

<Form aside={<Summary />}>…<Success title="You're in"><Summary /></Success></Form>
```

Rules: values are raw input (a number field may hold a string while typing), and answers to fields hidden by `<When>` stay in memory until submit — gate on the same condition if a summary depends on it. Use `<When>` (not these hooks) to show or hide **fields**. Never put fields inside `aside`. Prices shown here are display-only; the server stores the answers.

`useFieldValue` and `useFormValues` are hooks: call them at the top of a component, never inside `.map()`, `.find()`, a condition or a callback. Doing so crashes the form at runtime and clears the answers, and neither `check` nor `typecheck` catches it. To read several fields, call `useFormValues()` once and pick from the result.

## What Open Form can't do

Some requests sound like ordinary form features but have no built-in support. When the brief needs one, **tell the user in Step 1 of `create-form`, before building**: name the limit, say what you'll do instead, and let them choose. Don't quietly build a workaround and mention it only at hand-off.

| The brief asks for | Why it doesn't work | What to offer |
| --- | --- | --- |
| **File upload** (CV, photo, receipt) | There is no file field yet (planned), and a submission body is capped at 256 KB. | A `<Url>` field for a shared link (Google Drive, Dropbox, a portfolio), with a `description` saying the link must be viewable. Never base64 a file into a custom field. |
| **A quiz that scores itself**, shows correct answers or stores a score | Everything in the form's code ships to the browser: correct answers written in the form can be read from the page source. Responses store the raw answers only, never a computed score. | For practice or fun quizzes, scoring in `<Success>` is fine; say the answers are visible to anyone who looks. For anything that counts, collect the answers only, score them after exporting the responses, and limit retakes with `uniqueBy`: `'email'` needs a required `<Email name="email">` on a step everyone sees (blank or hidden answers aren't limited); `'device'` needs no field but is only a cookie. |
| **Repeating groups** ("name and diet for each guest", "add another item") | There is no repeater; every field is declared up front. | Ask for a count with a `RadioGroup` of `'0'`…`'N'` (a sensible maximum the user confirms), then one set of fields per position, each in its own `<When>` gated on the counts that include it: with up to 3 guests, `guest1Name` inside `<When field="guests" in={['1', '2', '3']}>`, `guest2Name` inside `in={['2', '3']}`, `guest3Name` inside `in={['3']}`. Lowering the count drops the hidden answers on the server. |
| **Email to the respondent** (confirmation, receipt) | The form doesn't send email. | A `webhooks` entry in `open-form.config.ts` to their email tool or Zapier, plus success copy that says what to expect. |
| **Sign-in, payments, editing a response after submitting** | Not part of Open Form. | Say so, and suggest collecting what's needed (an email, an order number) and handling the rest outside the form. |

Write these down at hand-off too, under the assumptions.

## Custom styling

Prefer theme tokens. For form-specific visuals (a live preview card, a facts block, custom tiles), import a local stylesheet and scope it with `className`:

```tsx
import theme from './theme/index.ts';
import './pass.css';                  // below the theme, so it wins over the theme's CSS
<Form theme={theme} className="pass-root">…</Form>
```

Prefix every class (`.pass-…`), build on `var(--of-*)` tokens so themes and dark mode keep working, and override `--of-aside-width` on your root class to resize the aside.

To restyle what the runtime renders, use these classes, scoped to `[data-of-theme="<form-id>"]` or your root class — never bare tags (`button[type="submit"]`, `h1`, `input`), which also hit your own markup:

| Part | Classes |
| --- | --- |
| Header | `.of-header`, `.of-eyebrow`, `.of-title`, `.of-description` |
| Page content | `.of-page-title`, `.of-page-description`, `.of-heading`, `.of-paragraph` |
| Field | `.of-field`, `.of-label`, `.of-required`, `.of-help`, `.of-error`, `.of-counter` |
| Controls | `.of-input` (also `.of-textarea`, `.of-select`), `.of-choices[data-variant="cards"]`, `.of-choice` (`:has(input:checked)` when chosen), `.of-rating-item` |
| Actions | `.of-nav`, `.of-button-primary`, `.of-button-secondary`, `.of-alert` |
| Progress | `.of-progress`, `.of-progress-label`, `.of-progress-track`, `.of-progress-bar` |
| Layouts | default: `.of-form` (the card), `.of-aside` · `SplitLayout`: `.of-split-brand` (the panel; its background is `--of-primary`), `.of-split-main` · `StepperLayout`: `.of-stepper-rail` · `FocusLayout`: `.of-focus` |
| End screens | `.of-success`, `.of-notice` |

Tokens to build on: `--of-bg` (page), `--of-surface` (card), `--of-fg`, `--of-muted`, `--of-primary`, `--of-primary-fg`, `--of-border`, `--of-control`, `--of-input`, `--of-error`, `--of-success`, `--of-radius`, `--of-button-radius`, `--of-gap`, `--of-width`, `--of-font`, `--of-heading-font`.

## `defineForm` config

```ts
defineForm({
  title: 'Event registration',
  description: 'Shown under the title.',
  locale: 'zh-TW',                 // the language it's written in: 'en' | 'zh-TW' | 'zh-CN' | 'ja' — buttons, messages, dates, CJK fonts. Default: the project's `locale`, else 'en'
  // translations: { en, ja },     // other languages, see "Languages" 
  submissions: {
    maxResponses: 100,             // closes automatically when full
    opensAt: '2026-10-01',         // YYYY-MM-DD = from the start of that day; or '2026-10-01T09:00'
    closesAt: '2026-10-31',        // YYYY-MM-DD = until the end of that day — both in `timeZone`
    uniqueBy: 'email',             // a field name, or 'device' (cookie — lightweight, not identity)
    closed: true,                  // stop taking responses now, whatever the dates say
    closedMessage: '…', fullMessage: '…', duplicateMessage: '…',
  },
  protection: {
    honeypot: true,                // default true
    minimumCompletionTime: '2s',   // default '2s'; false to disable
    rateLimit: { max: 10, window: '10m' },  // valid submissions per IP (IPv6 /64) per form; false to disable
  },
  success: { title: 'Thanks!', message: 'See you there.', redirect: 'https://…' },
  drafts: true,                    // long forms: keep unfinished answers in the browser 7 days ({ expires: '1d' }); off by default for shared computers
  published: false,                // take it offline: the link says "Form not found", Studio still previews it and keeps its responses. Unlike `closed`, which shows a closed screen
});
```

Only add what the user asked for; defaults are sensible.

Dates are read in the form's `timeZone` (IANA, e.g. `'Asia/Taipei'`), else the project's `timeZone` in `open-form.config.ts`, else UTC — never the server's clock, so they mean the same in dev and in production. If the user gives a deadline and no `timeZone` is set anywhere, ask which zone they mean, or set the project's. A timestamp with an offset (`'2026-10-31T18:00:00+09:00'`) ignores the zone.

People can also change `opensAt`, `closesAt`, `maxResponses`, `closed`, the form's `timeZone` and `published` in Studio (form → Settings). Under `open-form dev` that rewrites these keys in the form's code; on a deployed server it is stored in the database and wins over the code until someone restores it there — so if a deployed form ignores a date you changed in code, it was likely changed in Studio.

### Sending responses elsewhere (webhooks)

"Send new responses to Slack / Zapier / our API" goes in **`open-form.config.ts`**, never in `defineForm` — a form's config ships to the browser, the project config doesn't:

```ts
export default defineConfig({
  webhooks: [{ url: process.env.RESPONSES_WEBHOOK_URL!, forms: ['meetup'] }],  // forms: optional filter
});
```

Each new response is POSTed as `{ type: 'submission.created', timestamp, data: { form, submission } }`, signed in the [Standard Webhooks](https://www.standardwebhooks.com) format when `OPEN_FORM_WEBHOOK_SECRET` is set (`whsec_…` works with the `standardwebhooks` libraries), and retried for about 13 minutes on failure. Tell the user to set the URL and secret as environment variables; never hard-code a secret URL.

### Putting a form on another site (embed)

"Embed this on our blog" — allow the site in **`open-form.config.ts`** and give the user the snippet (Studio → form → Settings → Embed shows it with the real host):

```ts
export default defineConfig({ embed: { origins: ['https://blog.example.com'] } });  // '*' = any site
```

```html
<div data-open-form="meetup"></div>
<script src="https://forms.example.com/embed.js" async></script>
```

The frame grows with the form, a `success.redirect` leaves the host page, and the element fires `open-form:submitted`. In a React app (Next.js) render the form directly with `<FormHost>` instead (see the package README). Never add CORS headers or iframes by hand.

## Themes

### A form owns its look

A form's look is written for it in `forms/<id>/theme/` and passed to `<Form theme>`:

```tsx
import { Form } from '@open-form-build/core';
import theme from './theme/index.ts';    // index.tsx once it has components; above the form's own CSS, so the form's CSS wins
import './meetup.css';

<Form theme={theme}>…</Form>
```

`open-form create` writes `theme/index.ts` for every new form: `defineTheme({})` is the runtime's default look (the `classic` starter's), and `--theme <reference>` starts it from that reference's tokens. It belongs to the form: edit its tokens, CSS and components freely — no other form uses it — and Studio's preview has **Adjust** for its colors, fonts and shape. A form without one gets the default look; Adjust offers to create it, or write it and add the import yourself. The form's root gets `data-of-theme="<form-id>"`, so its CSS is scoped to the form id; renaming the form's folder means updating those selectors. Never import from `themes/` — `open-form check` warns about it, and about imports from another form's folder.

**Only what the form uses, in this order** — move to the next step only when the one before can't give the look:

1. **Tokens** in `theme/index.ts`: colors (and `dark`), fonts, `radius`, `buttonRadius`, `spacing`, `width`, `layout`, and a runtime layout as `components: { Layout: SplitLayout }`.
2. **CSS** on the runtime's own markup (*Custom styling* lists the classes), scoped to `[data-of-theme="<form-id>"]`, in a CSS file the theme imports: label and help treatment, pill or list-row choices, hidden radios drawn as ticks, button glyphs and keycaps with `::before` / `::after` (`content: "↵" / ""` keeps a glyph out of screen readers).
3. **Components** only for markup or behavior CSS can't give: a window frame or branded layout, a wrapper an input needs (an animated underline, a `❯` before the `<input>`, a counter inside the line), keyboard shortcuts, auto-advance. Each is a small function in `theme/index.tsx`, passed in `components`.

A component the form never renders — a `Select` in a form without one — doesn't belong in its theme.

Once the form's theme has components it becomes `theme/index.tsx`. Switch in this order: write `theme/index.tsx`, change the form's import to it, run `open-form check <id>`, and only then delete `theme/index.ts`. Deleting it first leaves `check` and the dev server failing with "Failed to load url ./theme/index.ts" until the import is fixed.

When CSS restyles the runtime's markup, out-rank its rules instead of relying on which stylesheet loads last: put `[data-of-theme="<form-id>"]` in front of the runtime's own selector, so `[data-of-theme="meetup"] .of-nav .of-button` beats its phone rule `.of-nav .of-button` and `[data-of-theme="meetup"] .of-field > legend:has(+ .of-help)` beats its legend spacing. If you zero the runtime's field spacing (`.of-field > * + *`), restate the top margin your own wrappers inside a field need.

### Themes in `themes/` are references

The project's `themes/` and the **starters** Open Form ships are references, like open-slide's themes: read them to choose a direction, then write the form's look from one — never import or copy one wholesale. Each has a `THEME.md` (the recipe: palette and tokens, typography, which parts are CSS and which are components, signature ideas, copy tone, do/don'ts) and a working `index.tsx` and CSS that Studio previews and you borrow pieces from. Editing or deleting a theme in `themes/` never changes a form. Studio → Themes is a read-only gallery of these references, in production builds too; a reference changes only when its files do, and that affects only forms created from it later.

| Theme | Feel | Layout | Good for |
| --- | --- | --- | --- |
| `classic` | Clean neutral card, every token explicit — the plain look, ready to brand | card | Product forms, internal requests, safe default |
| `editorial` | Serif magazine, underline inputs, ink panel | `SplitLayout` | Agencies, B2B sales, applications, premium brands |
| `terminal` | Monospace CLI session, green on black, `? prompts` | terminal window | Developer events, devtools, hackathons, beta access |
| `brutalist` | Loud yellow, thick borders, hard shadows | card | Launches, waitlists, campaigns, creator products |
| `conversational` | One question per screen, rounded, soft violet, letter keys | `FocusLayout` | Surveys, NPS, quizzes, onboarding, RSVPs |

```bash
open-form theme list                         # the project's themes, then the starters
open-form create <id> --theme terminal       # a new form whose theme/index.ts starts from terminal's tokens
open-form theme add editorial --as brand     # starter → themes/brand/, a reference to adapt
```

`theme add --as` renames only the `[data-of-theme="<starter>"]` selectors and THEME.md's name; file names and class prefixes stay the starter's (`themes/brand/editorial.css`, `.ed-…`).

`create --theme` takes the reference's tokens and the web fonts they name, never its CSS or components: take those piece by piece, as above, from its `index.tsx` and CSS — the project's in `themes/<id>/`, starters' in `node_modules/@open-form-build/core/themes/<id>/`. Read its `THEME.md` first and follow its copy guidance.

### Theme anatomy

A theme has two layers: **tokens** (colors, type, spacing) and **components** (how parts look and behave). Tokens alone only recolor the default look; CSS on the runtime's markup goes most of the way to a distinct feel, and components cover the rest.

A theme is `index.ts` (tokens, optionally `import './<name>.css'`), or `index.tsx` when it adds components, plus an optional `fonts/` folder. A form's is in `forms/<id>/theme/`; a reference in `themes/` is a folder with a `THEME.md` (or a single `themes/<id>.ts`). Components resolve as the defaults ← the theme's `components` ← `<Form components>`. New reference themes: use the `create-theme` skill.

### Tokens

```ts
import { defineTheme } from '@open-form-build/core';

export default defineTheme({
  font: '"Inter", system-ui, sans-serif',
  headingFont: 'Georgia, serif',
  radius: '12px',                  // inputs, tiles, buttons
  buttonRadius: '999px',           // optional: buttons only (pills)
  spacing: 'comfortable',          // 'compact' | 'comfortable' | 'spacious'
  width: '640px',
  layout: 'card',                  // 'card' | 'plain' (no card, for embedding)
  colorScheme: 'dark',             // optional: force 'dark' or 'light' regardless of the system setting
  colors: {
    primary: '#0f766e', primaryForeground: '#ffffff',
    background: '#f5f7f6',         // page
    surface: '#ffffff',            // card
    foreground: '#0b1f1c', muted: '#5b6b68',
    border: '#dbe3e1',             // decorative edges (card, dividers, tiles)
    control: '#7d8f8b',            // outlines that identify inputs / checkboxes / radios — keep ≥ 3:1 vs input
    input: '#ffffff',              // field background
    error: '#c0362c', success: '#15803d',
  },
  dark: { /* the same keys */ },   // or false: light only
});
```

Colors are any CSS color (`oklch(…)` and `hsl(…)` are fine). Setting `colors` also affects dark mode — always provide `dark` too (or `dark: false`). For a dark-only brand, set `colorScheme: 'dark'` and put the dark palette in `colors`. After any color change run `open-form theme check <form-id> --form` for a form's own look, or `theme check <theme-id>` for a theme in `themes/` (WCAG contrast, light and dark). `open-form theme font <form-id> <Family> --form` downloads a Google Fonts family into the form's `theme/fonts/` (respondents never contact Google). For "make it look like our product", use the `create-theme` skill.

### Components

Built-in fields are behavior only; their markup comes from replaceable components. Replace any subset — the rest keep the default look:

| Component | Renders | Key props |
| --- | --- | --- |
| `Field` | label, help, error around every field | `field`, `children`, `as` (`'fieldset'` for groups), `hideLabel`, `hideDescription` |
| `TextInput` | Text, Email, Url, Tel, NumberInput, DateInput | `field`, `type`, `value`, `onChange(string)`, `unit`, `placeholder`, `min`/`max`/`step`, … |
| `Textarea` | Textarea | `field`, `value`, `onChange`, `rows`, `maxLength` |
| `Select` | Select | `field`, `options`, `value`, `onChange`, `placeholder` |
| `PhoneInput` | Tel with a country picker | `field`, `country`, `countries`, `onCountryChange`, `value`, `onChange`, `countryLabel`; the default renders the theme's `Select` + `TextInput` |
| `ChoiceGroup` | RadioGroup, CheckboxGroup | `field`, `options`, `multiple`, `selected: string[]`, `onToggle(value, checked)`, `variant` |
| `Checkbox` | Checkbox | `field`, `checked`, `onChange(boolean)`, `children` (inline text), `markRequired` |
| `Rating` | Rating | `field`, `scores`, `value`, `onChange(number)`, `lowLabel`, `highLabel` |
| `Matrix` | Matrix frame | `label`, `description`, `required`, `columns`, `children` (the rows) |
| `MatrixRow` | one Matrix row | `field` (the row's), `columns`, `value`, `onChange(string)`, `markRequired` |

```tsx
// forms/<id>/theme/index.tsx — after the editorial reference
import { defineTheme, type TextInputUIProps } from '@open-form-build/core';
import './editorial.css';

function TextInput({ field, value, onChange, unit, ...attrs }: TextInputUIProps) {
  return (
    <div className="ed-line">
      <input
        {...field.controlProps}        // id, name, aria-invalid/-describedby/-required, onBlur
        {...attrs}
        ref={field.ref}                // focus target when invalid
        className="ed-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {unit && <span>{unit}</span>}
    </div>
  );
}

export default defineTheme({ headingFont: 'Georgia, serif', radius: '0px', components: { TextInput } });
```

Rules for theme components:

- **Behavior is given, not rebuilt.** Spread `field.controlProps` on the control and attach `ref={field.ref}`; in groups, put `ref` on the first input and pass `aria-invalid` / `aria-describedby` from `controlProps` to each input. The `Field` component must render `field.error` with `id={field.errorId}` and the description with `id={field.descriptionId}` (that's what `aria-describedby` points to), and a `<label htmlFor={field.id}>` (or a `<legend>` when `as === 'fieldset'`).
- **Keep native inputs.** Restyle radios and checkboxes (visually hidden input + styled label, or `appearance: none`) rather than replacing them with divs — keyboard and screen readers keep working for free.
- **Visible outlines and focus.** Draw control outlines with `var(--of-control)` (not `--of-border`, which is decorative), and show focus as a solid 2px `var(--of-primary)` outline — a faint tint isn't enough.
- **Style with tokens** (`var(--of-fg)`, `--of-primary`, `--of-border`, `--of-muted`, `--of-error`, `--of-radius`, `--of-heading-font`, …) so `dark` palettes keep working. Prefix theme classes (`.ed-…`) and scope overrides of built-in chrome (`.of-form`, `.of-title`, `.of-button`) to `[data-of-theme="<id>"]` — the form id in a form's own look.
- Extend instead of rewriting when only a wrapper changes: `import { defaultComponents } from '@open-form-build/core'` and render `<defaultComponents.TextInput {...props} />` inside your own markup.
- Per-form tweaks: change the form's own theme, or `<Form components={{ ChoiceGroup: Chips }}>` to override the theme's component from the form.
- Prefixed classes are global: two forms that took the same `.tm-…` classes from one reference, embedded on one page with different rules, collide. If that happens, rename the prefix in one of them.
- Custom fields built with `FieldShell` automatically use the theme's `Field`.

### Layouts and chrome

How the form is *arranged* is also a component. `Layout` receives ready-made regions and places them; the framework still renders the current step (focus, validation, schema discovery keep working whatever the layout does).

```tsx
import { SplitLayout } from '@open-form-build/core';

<Form components={{ Layout: SplitLayout }}>…</Form>          // from the form, over its theme
defineTheme({ components: { Layout: SplitLayout } })        // in the form's own theme, or a reference
```

Built-in layouts — pick one that fits the form, copy one as a starting point, or write your own for a composition they don't cover (*Design guidelines → Composition*):

| Layout | Use it for |
| --- | --- |
| *(default)* | A centered card. General purpose. |
| `StepperLayout` | 3+ named steps (applications, onboarding): a clickable step list beside the questions. Give every `<Page>` a short `title`. |
| `SplitLayout` | Brand-forward forms (sales, waitlists, events): a colored panel with the title, progress and `aside`, questions on the other side. |
| `FocusLayout` | Conversational / Typeform-style surveys: one screen per step, large type, Enter to continue. Put **one question per `<Page>`** and leave page titles off — the field label is the question. It doesn't render `aside`. The form's `title` / `description` open on their own welcome screen with a Start button, so write them as an invitation ("產品回饋 — 幾個簡短的問題，大約一分鐘"). To show them above the first question instead: `Layout: (props) => <FocusLayout {...props} cover={false} />`. Enter advances from a `Textarea` too (Shift + Enter for a new line), so long answers still fit the flow. |

Regions a `Layout` receives (`LayoutUIProps`): `state` (`'form' | 'success' | 'unavailable'`), `nav`, `header` (plus the raw `title` / `description`), `progress`, `intro`, `content` (the current step, or the Success / Notice screen), `alert` (live error region — always render it), `actions` (Back / Next / Submit), `aside`, `banner`. Render what you need, in any arrangement.

A custom `Layout` is how a form gets a composition the built-ins don't have (see *Design guidelines → Composition*). For example, a poster that fills the page, with the questions in a column to one side:

```tsx
// forms/<id>/theme/index.tsx
import { defineTheme, type LayoutUIProps } from '@open-form-build/core';
import './gig.css';

function Poster({ state, banner, header, progress, intro, content, alert, actions, aside }: LayoutUIProps) {
  return (
    <div className="gig-poster" data-state={state}>
      <section className="gig-poster-art">
        {state === 'form' && header}
        {aside}
      </section>
      <section
        className={state === 'success' ? 'gig-poster-form of-success' : 'gig-poster-form'}
        role={state === 'form' ? undefined : 'status'}
      >
        {banner}
        {progress}
        {intro}
        {content}
        {alert}
        {actions}
      </section>
    </div>
  );
}

export default defineTheme({ /* tokens */ components: { Layout: Poster } });
```

```css
/* forms/<id>/theme/gig.css: the poster fills the page, so drop the root's padding. */
.of-root[data-of-theme="<id>"] { padding: 0; }
[data-of-theme="<id>"] .gig-poster {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(360px, 1fr);
  min-height: 100dvh;
}
[data-of-theme="<id>"] .gig-poster-form {
  padding: clamp(32px, 5vw, 72px);
  padding-top: clamp(56px, 6vw, 72px); /* clears the language picker at every width */
  max-width: var(--of-width);
}
@media (max-width: 860px) {
  [data-of-theme="<id>"] .gig-poster { grid-template-columns: minmax(0, 1fr); min-height: 0; }
  [data-of-theme="<id>"] .gig-poster-art { padding: 56px 20px 24px; } /* a short band, so the first question stays on screen */
}
```

Put `of-success` on the element around `content` on the success screen, as the built-in layouts do: the runtime's success styling hangs on it. `aside` is passed only while the form is being filled in (it is `null` on the success and closed screens), so a signature element that should stay on the end screens goes in `<Success>` or in the layout itself. A `position: sticky` panel stops sticking inside an ancestor with `overflow: hidden`; clip decorations with `overflow: clip` or on the decoration itself. `header` is passed on every screen, but the built-in `Success` and `Notice` bring their own `<h1>`, so render `header` only while `state === 'form'` (or give your `Success` / `Notice` an `<h2>`): one `<h1>` per screen. The art side still carries its background and motifs on the end screens. Every custom layout has to work on a phone: stack at a breakpoint, shrink the visual part to a band, and keep the first question on the first screen.

On a form with translations the language picker (`.of-lang`) sits 12px inside the top-right corner of `.of-root`, 32px tall, over whatever the layout puts there. The built-in layouts start below it; a custom `Layout` (or form CSS that changes `.of-root`'s padding or pulls content to the top) must keep that corner clear at every width, phones included — no title, description, title bar or card edge under it. Reserve the room (`.of-root[data-of-theme="<id>"]:has(> .of-lang) { padding-top: clamp(56px, 6vw, 64px); }`) or move the picker into free space (`[data-of-theme="<id>"] .of-lang { top: …; right: …; }`).

The chrome inside those regions is replaceable too: `Header` (`title`, `description`), `Progress` (`nav`, `label`), `Nav` (`nav`, `submitLabel`, `labels`), `Button` (`variant: 'primary' | 'secondary'` + button props), `Success` (`title`, `children`), `Notice` (`state`, `eyebrow`, `title`, `message` — see *Closed screens* below). Keep `type="submit"` on the primary button so Enter still advances.

### Closed screens — `Notice`

Respondents get the `Notice` screen instead of the questions when the form isn't taking responses. Every form can end up there — a date passes, or someone closes it from Studio — and the built-in one is a generic two-liner, so it's worth designing like the success screen.

| `state` | When | `message` |
| --- | --- | --- |
| `'closed'` | `closed: true`, after `closesAt`, or closed in Studio | `closedMessage`, or the built-in sentence |
| `'not-open'` | before `opensAt` | the built-in sentence with the opening date |
| `'full'` | `maxResponses` reached | `fullMessage`, or the built-in sentence |
| `'duplicate'` | `uniqueBy: 'device'` and this browser already responded | `duplicateMessage`, or the built-in sentence |

With `uniqueBy: '<field>'` the duplicate is only found on submit, so `duplicateMessage` shows as the error under the Submit button, not as a `Notice`.

`Notice` gets `state`, `eyebrow` (the form's title), `title` (the built-in "This form is closed" in the form's language) and `message` — all already translated. Render it in the Layout's closed frame (the card, Split's main column, Focus's screen):

```tsx
import { Form, type NoticeUIProps, T } from '@open-form-build/core';

function MeetupClosed({ state, eyebrow, title, message }: NoticeUIProps) {
  return (
    <div className="meetup-closed">
      {eyebrow && <p className="of-eyebrow">{eyebrow}</p>}
      <h1 className="of-title">{state === 'full' ? <T>All 100 seats are taken</T> : title}</h1>
      <p className="of-description">{message}</p>
      {state !== 'not-open' && (
        <p className="meetup-next">
          <T>Next meetup: Nov 27 — follow @taipeidev for the sign-up link.</T>
        </p>
      )}
    </div>
  );
}

<Form components={{ Notice: MeetupClosed }}>…</Form>
```

- **One component, every state it can get.** Branch on `state` for what differs; fall back to `title` / `message` for the rest, so a state you didn't plan for still reads right.
- **Say what happens next**, using only facts the user gave: the next date, where to follow, who to contact. Never invent a link, date or address — leave it out or ask.
- **Copy**: keep the policy messages in `config.submissions` (Studio and the server use them too) and put only extra lines in the component. Wrap your own text in `<T>` / `useTranslate()` so translations and `check` cover it.
- **Markup**: one `<h1>` on the screen. The default card shows only the `Notice`, so it takes the `<h1>` (and `eyebrow` names the form); layouts that keep the header on the closed screen — `SplitLayout`, and themes like `terminal` — already show the form's title as the `<h1>`, so use `<h2>` and skip `eyebrow`. Reuse `of-eyebrow` / `of-title` / `of-description` (or the theme's classes), or prefixed classes built on `var(--of-*)` tokens, so it follows the theme and dark mode. No fields or buttons that submit — the form isn't there.
- A theme can have one (`defineTheme({ components: { Notice } })`). A reference's (e.g. `terminal`'s, with its `tm-*` classes) is a starting point: build the form's from its markup and classes, in the form's theme or passed in `<Form components>` — that wins.
- **Preview**: in Studio's Preview, *When closed* (under the steps) shows each screen — *Closed* always, plus *Not open yet* while `opensAt` is still ahead, *Full* when the form has `maxResponses`, and *Already responded* with `uniqueBy: 'device'`. It doesn't change the live form, and it updates as you edit.

`useFormNav()` gives any component the navigation state: `position`, `total`, `steps` (`title`, `state: 'done' | 'current' | 'upcoming'`, `reachable`), `isFirst`, `isLast`, `submitting`, `error`, and actions `next()` (validate + advance or submit), `back()`, `goTo(position)` (visited steps only; jumping ahead checks the steps in between). `useFormMessages()` returns the built-in strings in the form's locale.

## Languages

A form is written in **one** language — `locale` — and can be translated into others. Translations live beside the form, keyed by the **exact source text**:

```
forms/feedback/
  index.tsx            ← written in 繁體中文, locale: 'zh-TW'
  locales/en.json      ← { "產品回饋": "Product feedback", "你最常用的功能": "Which features do you use most?", … }
  locales/ja.json
```

```tsx
import en from './locales/en.json';
import ja from './locales/ja.json';

export const config = defineForm({
  title: '產品回饋',
  locale: 'zh-TW',               // required once there are translations
  translations: { en, ja },      // 'en' | 'zh-TW' | 'zh-CN' | 'ja'
});
```

- **Translated automatically**: title, description, success copy, policy messages (`fullMessage`…), `<Page>` titles and descriptions, field `label` / `description` / `placeholder` / `unit`, option labels, `Rating` `lowLabel` / `highLabel`, `Checkbox` text, `<Submit>` text, `<Heading>` / `<Paragraph>` text, and messages returned by `validate`. Buttons and built-in errors come from `locale` already.
- **Your own markup**: wrap text in `<T>` — `<T>Early-bird ends Friday.</T>` — or call `const tr = useTranslate()` and use `tr('…')`. `useFormLanguage()` gives `{ locale, available, setLocale }` for custom pickers.
- **Values stay put**: option `value`s, field `name`s and conditions are never translated. Use explicit values (`{ value: 'engineer', label: '工程師' }`) so every language stores the same answer.
- **Respondents** get the best match for their browser, can switch with the picker in the corner (`languageSwitch: false` hides it; replace it with `components.LanguageSwitch`), and links can force one: `/f/<id>?lang=ja`. Responses record the language (Studio, CSV `Language` column).
- **Missing entries fall back** to the source text — the form never breaks, it just shows that string in the original language. `open-form check <id>` shows `N/N translated` per language and lists missing entries (the first 8, then `… N more`) and up to 3 entries it didn't see rendered ("not seen"); `--json` has them all.
- **Dynamic text**: `check` renders the form once with no answers, so text that appears only for certain answers (a caption that follows a slider, a price line) or comes from `validate` shows as "not seen" — keep those entries. Use placeholders for text with values: `tr('Workshops × {n}', { n })`, key `"Workshops × {n}"`.
- **Editing a translated form**: changing a source string orphans its translations. Update the key (and the translation) in every `locales/*.json` in the same change, then re-run `check`.
- Responses, CSV headers and Studio use the source language.

## Design guidelines

The runtime handles spacing, focus, states and responsiveness. You own the questions, the hierarchy, the copy and the one detail people remember.

### Questions

- Ask only what you need. Every extra field costs completions.
- Order: easy → personal → hard. Group related questions on a page; 3–7 fields per page.
- Labels are questions or nouns ("Company", "What best describes you?"). Put hints in `description`, not `placeholder`.
- Mark only truly necessary fields `required`.
- Prefer `RadioGroup` for ≤ 5 options (visible at a glance), `Select` for longer lists, `variant="cards"` for 2–6 short options — on a `CheckboxGroup` too, where 5+ short options as a list make a tall column of rows.
- Use `<Row>` only for short, related fields.
- Write copy in the form's language and set `locale` to match.

### Look

- **Header**: a title of a few words and a description of one or two sentences. Each fact — date, venue, price, deadline — appears **once**: in the description or in a facts block, never both.
- **One signature element.** A form feels designed, not generated, when one piece of UI belongs to *this* form's purpose — usually in `aside` (see *Live answers*) or a custom field, built on `var(--of-*)` tokens:
  - a live preview that fills in as people answer — a pass, badge, ticket or profile card;
  - an event's facts (date · venue · price · seats) or its agenda;
  - plan tiles with prices, and a running total;
  - a summary of the answers so far in `SplitLayout`'s panel.

  One is enough; two compete. Use only facts the user gave. A short internal form may need none — then the effort goes into copy and spacing. The theme's THEME.md lists *Signature ideas* that fit it, and where its layout puts `aside` — `FocusLayout` has none, so there it goes in the flow or `<Success>`.
- **Color**: the theme's palette only. `primary` marks the main action, the selection and focus; the form's CSS adds no new hues (tints come from `color-mix()` on tokens). Gradients, glows and textures go on the page background or the brand panel, never behind text or controls.
- **Type**: at most the theme's two families (`font`, `headingFont`), plus a monospace for code when the form shows code. Build hierarchy with size and weight, not more colors, and don't shrink labels or help text below the theme's sizes.
- **Chinese and Japanese**: Latin typographic tricks don't carry over. When the form's `locale` is `zh-TW`, `zh-CN` or `ja`, don't copy a reference's `text-transform: uppercase`, small-caps, wide `letter-spacing` or `font-style: italic` (CJK fonts have no italic, so browsers slant the glyphs) onto CJK text. Labels and eyebrows are 13–14px or larger, with letter-spacing of 0.06em at most; help text is upright and muted; emphasis comes from weight, size or color. Pick a CJK face that matches the Latin one: serif Latin with `var(--of-cjk-serif)`, sans with `var(--of-cjk)`. In a multilingual form, scope the Latin-only styling with `:lang(en)`, e.g. `.of-root[data-of-theme="<id>"]:lang(en) .of-label { text-transform: uppercase; }`. `.of-root` carries the respondent's current language in `lang`.
- **Phones**: at about 390px wide, the title and the first question (or `FocusLayout`'s Start button) fit on the first screen. `SplitLayout` stacks its panel above the questions under 860px and the default `aside` drops below them under 960px — hide secondary panel or aside content there (`@media (max-width: 860px)`) instead of pushing the questions down.

### Composition

The answer fields stay in **one column**: people read and fill a single column fastest, so use `<Row>` only for short pairs. Everything around that column is open, though. A centered card on a gray page is only the default, and a form where every direction is that card looks generated. Decide the composition (the page layout around the questions) as deliberately as the colors:

| Composition | Feels like | How |
| --- | --- | --- |
| **Centered card** | Neutral, embeddable, quick | Default layout. Short internal forms, embeds (`layout: 'plain'`). |
| **Hero + form** | An event or product page | `SplitLayout`, or a custom `Layout` with a big visual side (title in display type, facts, a CSS-drawn motif) beside a form column. Not always 50/50: try 60/40, or the form on the left. |
| **Full-page poster** | A flyer, a gig poster, an invitation | A custom `Layout` with the whole page as the composition: oversized type, a pattern or illustration built from CSS on `--of-*` tokens, and the questions in a column on one side or a sheet laid over the poster. `.of-root` padding to 0. |
| **Document** | An official application, an exam paper, a contract | Wider `width` (760–960px) with a sheet look: a header band, numbered sections, labels in a left margin column on wide screens, rules between sections. The answer column itself stays at a readable width. |
| **Form + sticky summary** | Checkout, booking, configuration | `aside` (sticky beside the card) or a custom `Layout` with a receipt, pass or running total that follows the answers. |
| **Step rail** | A long application, onboarding | `StepperLayout`, or a custom rail styled as the form's own artifact (tabs of a binder, layers of a design tool). |
| **One question per screen** | A conversation, a quick survey | `FocusLayout`, which works best full-bleed with big type. |

Pick the composition from the form's subject and the moment: a concert sign-up can be a poster, a scholarship application a document, a workshop booking a form with a sticky summary. `width`, `.of-root`'s padding and background, and the `Layout` are all part of the form's own theme. On phones, every composition collapses to the single column with a compact visual band above it.
- **Endings**: write `success` copy for this form — what happens next and when; a bare "Thanks!" wastes the moment. `<Success>` can reuse the signature element, filled with the person's answers. Closed screens: see *Closed screens*.
- **Motion**: the runtime already animates steps and errors, and turns all motion in the form off for `prefers-reduced-motion`. Add at most a hover or a transition on the signature element.

## Anti-patterns

| Don't | Do |
| --- | --- |
| `useState` + `onChange` for values | Field components / `useField` |
| `{watch('x') === 'y' && …}` or ternaries on values | `<When field="x" equals="y">` |
| `onSubmit={() => fetch('/api/…')}` | Nothing — submission is built in |
| `useFormValues()` to show/hide fields | `<When>`; the hooks are for display only |
| Writing API routes, SQL, Express handlers | `config.submissions` / `protection` |
| `fetch()` to Slack/Zapier in `onSubmit` or a validator | `webhooks` in `open-form.config.ts` |
| Hand-written `if (!email.includes('@'))` | `<Email>`; `validate` for real custom rules |
| `theme: 'terminal'` in `defineForm`, or importing from `themes/` | The form's own `theme/index.ts` (`open-form create <id> --theme terminal`) + `<Form theme={theme}>`, with the CSS and components it needs written there |
| Copying a reference theme's whole folder into the form | Only what the form renders: tokens, then CSS on the runtime's classes, then components that need their own markup or behavior |
| CSS grid / flex to arrange fields | `<Row>`, `<Page>`; grid and flex belong in the `Layout`, around the field column |
| Every form a centered card at the default width | A composition chosen for the form (*Composition*) |
| English uppercase / italic styling on Chinese or Japanese text | Upright CJK text, weight and size for emphasis, Latin styling under `:lang(en)` |
| Styling tags (`button[type="submit"]`, `h1`) or unscoped `.of-*` rules | The `.of-*` classes under `[data-of-theme="<id>"]` (*Custom styling*) |
| Hex colors in the form's CSS | `var(--of-*)` tokens; tints via `color-mix()` |
| The date and venue in the description *and* in an aside | Each fact once |
| A bare "Thanks!" success screen | What happens next, in the form's voice |
| `<label>` / `<input>` markup | DSL components (they handle ARIA, focus, errors) |
| Renaming a field that already has responses | Keep the name; change only `label` |
| Reading `window` during render | `useEffect` |

## Self-review before handing off

1. Ids: folder is kebab-case; every `name` is unique, camelCase, meaningful.
2. Required fields are minimal and correct; conditional fields use `<When>`, not ternaries. Anything the brief asked for that Open Form can't do (*What Open Form can't do*) was raised with the user, and the workaround is listed at hand-off.
3. Policy matches the request (limits, dates, uniqueness, language).
4. No hand-rolled state, fetch, validation or styling outside the theme / form CSS.
5. The look was chosen, not defaulted: the form's own theme (`forms/<id>/theme/`, passed as `<Form theme>`, imported above the form's CSS) matches the agreed direction and holds only what this form renders (`check` names theme components the form never uses; remove them), nothing imports from `themes/`, the copy follows the reference's `THEME.md` tone, and conversational forms have one question per page. It follows *Design guidelines → Look*: each header fact once, at most one signature element, no new hues, success copy written for this form, a composition chosen for the form rather than the default card by habit, and no uppercase, small-caps or italic styling on Chinese or Japanese text.
6. Custom components spread `field.controlProps`, attach `field.ref`, keep native inputs and a visible focus style.
7. `open-form check <id>` passes and its output (steps, fields, conditions, required flags, policy) matches your plan; the `typecheck` script passes.
8. Closed screens: `closedMessage` (plus `fullMessage` / `duplicateMessage` where they apply) is in the form's voice, and a custom `Notice` handles every `state` the form can reach and invents no facts.
9. Multilingual: `locale` is set, options have explicit values, `check` shows every language `N/N translated`, and every "not seen" entry is dynamic text or a `validate` message — not a key left behind by edited text.
10. You **saw** it — `check` proves the form works, not that it looks right. Screenshot `/f/<id>` on the dev server at desktop (~1440×900) and phone (~390×844) width with whatever browser tool you have, and compare it with the plan: the title shows, the form's own CSS applies (`.of-root` has `data-of-theme="<id>"` when the form has its own theme), nothing is low-contrast or clipped, nothing sits under the language picker (translated forms), and on the phone the first question is on the first screen. Then use Studio's Preview (`/studio/<id>`): the step buttons open conditional pages directly, *When closed* shows each closed screen, and the language picker shows each translation in place. Without a browser tool, say so at hand-off — never describe a look you haven't seen.
