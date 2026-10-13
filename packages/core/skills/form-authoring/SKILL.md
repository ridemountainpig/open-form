---
name: form-authoring
description: Technical reference for writing or editing forms in an Open Form workspace — the file contract, every DSL component and prop, conditional logic with <When>, validation, custom validators and custom field components, submission policy (limits, deadlines, one-per-email/device), spam protection, success screens, locale and themes. Read this before creating or changing anything under `forms/`. Use `create-form` for the end-to-end workflow of drafting a new form.
---

# Authoring forms with Open Form

You describe **questions + logic**. Open Form owns everything else: state, validation (client *and* server), multi-step navigation, focus management, accessibility, responsive layout, submission, spam protection, storage, Responses. Your job is a short, declarative file.

Run `open-form` through the workspace's package manager and type-check with its `typecheck` script, as AGENTS.md → Commands shows (`pnpm exec open-form`, `npx open-form`, …; `pnpm typecheck`, `npm run typecheck`, …).

## File contract

```
forms/<id>/index.tsx        ← required; <id> is kebab-case and becomes /f/<id>
forms/<id>/<anything>.tsx   ← optional local components / option lists
forms/<id>/theme/           ← optional: the form's own look, copied from a theme (`open-form theme copy`)
themes/<theme-id>/          ← optional reference themes for new forms; forms never import them (see create-theme)
```

```tsx
import { defineForm, Email, Form, Page, Select, Submit, Text, When } from '@open-form-build/core';
import theme from './theme/index.tsx'; // its copy of terminal: `open-form theme copy terminal meetup-registration`

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
| `<Tel>` | string | same as Text; loose phone format |
| `<Textarea>` | string | same as Text + `rows`; shows a counter when `maxLength` is set |
| `<NumberInput>` | number | `min`, `max`, `step`, `integer`, `unit` (suffix like `"years"`), `placeholder` |
| `<DateInput>` | `YYYY-MM-DD` | `min`, `max` (`YYYY-MM-DD`) |
| `<Select>` | string | `options`, `placeholder` |
| `<RadioGroup>` | string | `options`, `variant="list" \| "cards"` |
| `<CheckboxGroup>` | string[] | `options`, `minSelected`, `maxSelected`, `variant` |
| `<Checkbox>` | boolean | children = inline text. `required` means it must be checked (terms, consent). |
| `<Rating>` | number | `min` (default 1), `max` (default 5), `lowLabel`, `highLabel`. Use `min={0} max={10}` for NPS. |

`variant` on choices is a hint: built-in themes may render choices their own way (e.g. `terminal` always lists them).

`options` accepts `['A', 'B']` or `[{ value: 'a', label: 'A' }]`. Use value/label pairs when labels may change later or are long — the stored value stays stable. Options must be known when the form renders (the server checks answers against them), so an empty list fails `check`.

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

Put display-only UI in `<Form aside={…}>`: a side column on wide screens, stacked below the questions on narrow ones. Ideal for a live preview, an order summary or a running total. `FocusLayout` doesn't show `aside`. `<Success>` children can use the same hooks to show a personalised confirmation.

```tsx
function Summary() {
  const tier = useFieldValue<string>('tier');
  const seats = Number(useFieldValue('seats') ?? 1);
  return <p>Total: ${(tier === 'pro' ? 20 : 0) * seats}/mo</p>;
}

<Form aside={<Summary />}>…<Success title="You're in"><Summary /></Success></Form>
```

Rules: values are raw input (a number field may hold a string while typing), and answers to fields hidden by `<When>` stay in memory until submit — gate on the same condition if a summary depends on it. Use `<When>` (not these hooks) to show or hide **fields**. Never put fields inside `aside`. Prices shown here are display-only; the server stores the answers.

## Custom styling

Prefer theme tokens. For form-specific visuals (a branded preview card, custom tiles), import a local stylesheet and scope it with `className`:

```tsx
import theme from './theme/index.ts';
import './pass.css';                  // below the theme, so it wins over the theme's CSS
<Form theme={theme} className="pass-root">…</Form>
```

Prefix every class (`.pass-…`), build on `var(--of-*)` tokens so themes and dark mode keep working, and override `--of-aside-width` on your root class to resize the aside.

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
});
```

Only add what the user asked for; defaults are sensible.

Dates are read in the form's `timeZone` (IANA, e.g. `'Asia/Taipei'`), else the project's `timeZone` in `open-form.config.ts`, else UTC — never the server's clock, so they mean the same in dev and in production. If the user gives a deadline and no `timeZone` is set anywhere, ask which zone they mean, or set the project's. A timestamp with an offset (`'2026-10-31T18:00:00+09:00'`) ignores the zone.

People can also change `opensAt`, `closesAt`, `maxResponses`, `closed` and the form's `timeZone` in Studio (form → Settings). Under `open-form dev` that rewrites these keys in the form's code; on a deployed server it is stored in the database and wins over the code until someone restores it there — so if a deployed form ignores a date you changed in code, it was likely changed in Studio.

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

A form's look is its own copy of a theme, in `forms/<id>/theme/`, passed to `<Form theme>`:

```tsx
import { Form } from '@open-form-build/core';
import theme from './theme/index.tsx';   // or index.ts, whichever the copy has; above the form's own CSS, so the form's CSS wins
import './meetup.css';

<Form theme={theme}>…</Form>
```

Without `theme` the form gets the default look, which is the `classic` starter. To tweak such a form, copy `classic` in first (`open-form theme copy classic <id>`, imported as `./theme/index.ts`) — not another theme, which would restyle the whole form. The copy is the form's alone: edit its tokens, components and CSS freely — no other form uses it. The form's root gets `data-of-theme="<form-id>"`, so the copy's CSS is scoped to the form id; renaming the form's folder means updating those selectors in its CSS. Never import from `themes/` — `open-form check` warns about it, and about imports from another form's folder.

### Themes in `themes/` are references

The project's `themes/` and the **starters** Open Form ships are references for new forms: read them to choose a look, then copy one into the form. Editing or deleting a theme in `themes/` never changes an existing form. Studio → Themes (dev only) is a gallery of these references; its *Adjust* drawer edits the theme in `themes/`, so it affects only forms that copy it later. Studio has no per-form look editor yet: a form's look changes in its copy.

| Theme | Feel | Layout | Good for |
| --- | --- | --- | --- |
| `classic` | Clean neutral card, every token explicit — the plain look, ready to brand | card | Product forms, internal requests, safe default |
| `editorial` | Serif magazine, underline inputs, ink panel | `SplitLayout` | Agencies, B2B sales, applications, premium brands |
| `terminal` | Monospace CLI session, green on black, `? prompts` | terminal window | Developer events, devtools, hackathons, beta access |
| `brutalist` | Loud yellow, thick borders, hard shadows | card | Launches, waitlists, campaigns, creator products |
| `conversational` | One question per screen, rounded, soft violet, letter keys | `FocusLayout` | Surveys, NPS, quizzes, onboarding, RSVPs |

```bash
open-form theme list                         # the project's themes, then the starters
open-form create <id> --theme terminal       # a new form with its own copy, already wired
open-form theme copy terminal <id>           # → forms/<id>/theme/ (themes/terminal if it exists, else the starter)
open-form theme copy terminal <id> --force   # replace the form's copy — discards its edits
open-form theme add editorial --as brand     # starter → themes/brand/, a reference to adapt
```

`theme add --as` renames only the `[data-of-theme="<starter>"]` selectors and THEME.md's name; file names and class prefixes stay the starter's (`themes/brand/editorial.css`, `.ed-…`).

`theme copy` takes the theme's `index.ts(x)`, its CSS and `fonts/` (not `THEME.md`) and rewrites `[data-of-theme="<theme>"]` selectors to the form id. It doesn't edit the form: add the import and `<Form theme={theme}>` yourself (`create --theme` does both).

A theme's `THEME.md` (the project's in `themes/<id>/`, starters' in `node_modules/open-form/themes/<id>/`) describes its palette, typography, components, copy tone and do/don'ts — read it before writing a form in that theme, and follow its copy guidance.

### Theme anatomy

A theme has two layers: **tokens** (colors, type, spacing) and **components** (how fields look). Tokens alone only recolor the default look; replace components when the form should *feel* different — that's what makes forms distinct.

A theme is `index.ts` (tokens, optionally `import './<id>.css'`), or `index.tsx` when it adds components, plus an optional `fonts/` folder. In `themes/` it's a folder with a `THEME.md` (or a single `themes/<id>.ts`); a form's copy is the same files in `forms/<id>/theme/`. Components resolve as the defaults ← the theme's `components` ← `<Form components>`. New reference themes: use the `create-theme` skill.

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

Colors are any CSS color (`oklch(…)` and `hsl(…)` are fine). Setting `colors` also affects dark mode — always provide `dark` too (or `dark: false`). For a dark-only brand, set `colorScheme: 'dark'` and put the dark palette in `colors`. After any color change run `open-form theme check <form-id> --form` for a form's copy, or `theme check <theme-id>` for a theme in `themes/` (WCAG contrast, light and dark). `open-form theme font <form-id> <Family> --form` downloads a Google Fonts family into the copy's `fonts/` (respondents never contact Google). For "make it look like our product", use the `create-theme` skill.

### Components

Built-in fields are behavior only; their markup comes from replaceable components. Replace any subset — the rest keep the default look:

| Component | Renders | Key props |
| --- | --- | --- |
| `Field` | label, help, error around every field | `field`, `children`, `as` (`'fieldset'` for groups), `hideLabel`, `hideDescription` |
| `TextInput` | Text, Email, Url, Tel, NumberInput, DateInput | `field`, `type`, `value`, `onChange(string)`, `unit`, `placeholder`, `min`/`max`/`step`, … |
| `Textarea` | Textarea | `field`, `value`, `onChange`, `rows`, `maxLength` |
| `Select` | Select | `field`, `options`, `value`, `onChange`, `placeholder` |
| `ChoiceGroup` | RadioGroup, CheckboxGroup | `field`, `options`, `multiple`, `selected: string[]`, `onToggle(value, checked)`, `variant` |
| `Checkbox` | Checkbox | `field`, `checked`, `onChange(boolean)`, `children` (inline text), `markRequired` |
| `Rating` | Rating | `field`, `scores`, `value`, `onChange(number)`, `lowLabel`, `highLabel` |

```tsx
// themes/editorial/index.tsx
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
- **Style with tokens** (`var(--of-fg)`, `--of-primary`, `--of-border`, `--of-muted`, `--of-error`, `--of-radius`, `--of-heading-font`, …) so `dark` palettes keep working. Prefix theme classes (`.ed-…`) and scope overrides of built-in chrome (`.of-form`, `.of-title`, `.of-button`) to `[data-of-theme="<id>"]` — the form id in a form's copy.
- Extend instead of rewriting when only a wrapper changes: `import { defaultComponents } from '@open-form-build/core'` and render `<defaultComponents.TextInput {...props} />` inside your own markup.
- Per-form tweaks: change the form's copy, or `<Form components={{ ChoiceGroup: Chips }}>` to override the theme's component from the form.
- Prefixed classes are global: two forms with diverged copies of the same theme embedded on one page share its `.tm-…` classes. If that happens, rename the prefix in one copy.
- Custom fields built with `FieldShell` automatically use the theme's `Field`.

### Layouts and chrome

How the form is *arranged* is also a component. `Layout` receives ready-made regions and places them; the framework still renders the current step (focus, validation, schema discovery keep working whatever the layout does).

```tsx
import { SplitLayout } from '@open-form-build/core';

<Form components={{ Layout: SplitLayout }}>…</Form>          // from the form, over its theme
defineTheme({ components: { Layout: SplitLayout } })        // in the theme: the form's copy, or a reference
```

Built-in layouts — pick one that fits the form, or copy one as a starting point:

| Layout | Use it for |
| --- | --- |
| *(default)* | A centered card. General purpose. |
| `StepperLayout` | 3+ named steps (applications, onboarding): a clickable step list beside the questions. Give every `<Page>` a short `title`. |
| `SplitLayout` | Brand-forward forms (sales, waitlists, events): a colored panel with the title, progress and `aside`, questions on the other side. |
| `FocusLayout` | Conversational / Typeform-style surveys: one screen per step, large type, Enter to continue. Put **one question per `<Page>`** and leave page titles off — the field label is the question. It doesn't render `aside`. The form's `title` / `description` open on their own welcome screen with a Start button, so write them as an invitation ("產品回饋 — 幾個簡短的問題，大約一分鐘"). To show them above the first question instead: `Layout: (props) => <FocusLayout {...props} cover={false} />`. Enter advances from a `Textarea` too (Shift + Enter for a new line), so long answers still fit the flow. |

Regions a `Layout` receives (`LayoutUIProps`): `state` (`'form' | 'success' | 'unavailable'`), `nav`, `header` (plus the raw `title` / `description`), `progress`, `intro`, `content` (the current step, or the Success / Notice screen), `alert` (live error region — always render it), `actions` (Back / Next / Submit), `aside`, `banner`. Render what you need, in any arrangement.

```tsx
function Centered({ state, header, progress, content, alert, actions }: LayoutUIProps) {
  return (
    <div className="my-shell" data-state={state}>
      {state === 'form' && header}
      {progress}
      {content}
      {alert}
      {actions}
    </div>
  );
}
```

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
- A theme can ship one (`defineTheme({ components: { Notice } })`), and after `theme copy` it's in the form's copy (e.g. `terminal`'s, with its `tm-*` classes): adapt it there, or pass your own in `<Form components>` — that wins — starting from its markup and classes.
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

## UX guidelines

- Ask only what you need. Every extra field costs completions.
- Order: easy → personal → hard. Group related questions on a page; 3–7 fields per page.
- Labels are questions or nouns ("Company", "What best describes you?"). Put hints in `description`, not `placeholder`.
- Mark only truly necessary fields `required`.
- Prefer `RadioGroup` for ≤ 5 options (visible at a glance), `Select` for longer lists, `variant="cards"` for 2–6 short options.
- Use `<Row>` only for short, related fields.
- Write copy in the form's language and set `locale` to match.

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
| `theme: 'terminal'` in `defineForm`, or importing from `themes/` | `open-form theme copy terminal <id>` + `<Form theme={theme}>` |
| Custom CSS/media queries for layout | `<Row>`, `<Page>`, theme tokens |
| `<label>` / `<input>` markup | DSL components (they handle ARIA, focus, errors) |
| Renaming a field that already has responses | Keep the name; change only `label` |
| Reading `window` during render | `useEffect` |

## Self-review before handing off

1. Ids: folder is kebab-case; every `name` is unique, camelCase, meaningful.
2. Required fields are minimal and correct; conditional fields use `<When>`, not ternaries.
3. Policy matches the request (limits, dates, uniqueness, language).
4. No hand-rolled state, fetch, validation or styling outside the theme / form CSS.
5. The look was chosen, not defaulted: the form's own theme (`forms/<id>/theme/`, passed as `<Form theme>`, imported above the form's CSS) matches the agreed direction, nothing imports from `themes/`, the copy follows that theme's `THEME.md` tone, and conversational forms have one question per page.
6. Custom components spread `field.controlProps`, attach `field.ref`, keep native inputs and a visible focus style.
7. `open-form check <id>` passes and its output (steps, fields, conditions, required flags, policy) matches your plan; the `typecheck` script passes.
8. Closed screens: `closedMessage` (plus `fullMessage` / `duplicateMessage` where they apply) is in the form's voice, and a custom `Notice` handles every `state` the form can reach and invents no facts.
9. Multilingual: `locale` is set, options have explicit values, `check` shows every language `N/N translated`, and every "not seen" entry is dynamic text or a `validate` message — not a key left behind by edited text.
10. If the dev server is running, look at it in Studio: `/studio/<id>` on the URL `open-form dev` printed (default `http://localhost:3000`) — Preview on desktop and mobile. Use the step buttons to open conditional pages directly, *When closed* to see each closed screen, and the language picker to read each translation in place.
