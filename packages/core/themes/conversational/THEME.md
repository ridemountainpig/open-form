---
name: Conversational
description: One question per screen, big friendly rounded type, soft violet — Typeform-like, with letter keys and auto-advance.
layout: FocusLayout
---

# Conversational

**Mood:** friendly, unhurried, personal. Feels like being asked, not like filling in a form.

**Best for:** surveys and NPS, feedback, quizzes, onboarding questionnaires, research screeners, event RSVPs, anything with mostly single-choice questions.

**Avoid when:** people need to see and review everything at once (long applications, data entry), or there are many free-text fields.

## Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `#5b4cf5` violet | `#a99cff` | Answers, keys, selected choices, progress, button |
| `background` | `#f8f7ff` + one soft violet glow from the top | `#0e0c1f` | Page |
| `surface` / `input` | `#ffffff` | `#17142e` / `#1c1838` | Choice and rating tiles |
| `foreground` | `#1b1838` | `#f0edff` | Questions |
| `muted` | `#66627f` | `#a39fc4` | Help, captions, counter |
| `control` | `#8a82c6` | `#6a62b8` | Tile and underline outlines (≥ 3:1) |

## Tokens

What `open-form create <form> --theme conversational` writes into the form's `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#5b4cf5` | `#a99cff` |
| `primaryForeground` | `#ffffff` | `#120f2e` |
| `background` | `#f8f7ff` | `#0e0c1f` |
| `surface` | `#ffffff` | `#17142e` |
| `foreground` | `#1b1838` | `#f0edff` |
| `muted` | `#66627f` | `#a39fc4` |
| `border` | `#e6e2fa` | `#2c2850` |
| `control` | `#8a82c6` | `#6a62b8` |
| `input` | `#ffffff` | `#1c1838` |
| `error` | `#d1242f` | `#ff6b70` |
| `success` | `#30a46c` | `#4cc38a` |

- `font`: `'ui-rounded, "SF Pro Rounded", "Nunito", system-ui, -apple-system, var(--of-cjk), sans-serif'`
- `headingFont`: same as `font`
- `radius`: `'14px'`
- `buttonRadius`: `'999px'`
- `spacing`: `'comfortable'`
- `width`: `'680px'`
- Layout: `FocusLayout`, not a token: add `components: { Layout: FocusLayout }`.

## Typography

Rounded system sans for Latin (`ui-rounded`, `SF Pro Rounded`, `Nunito`); CJK falls through to `var(--of-cjk)` — PingFang / Noto Sans / Hiragino Sans in the form's language — which have real bold weights. Don't add `Hiragino Maru Gothic` back: it has a single weight, so browsers fake the bold and Chinese headings turn smudgy. Title 2.25–3.5rem / 700, questions 1.5–2rem / 650, answers typed at ~1.5rem in the primary color. Wrap with `text-wrap: pretty`, not `balance` (balance splits Chinese words).

## Layout & components

- `FocusLayout`: a **welcome screen** with the form's title, description and a Start button; then one step per screen, vertically centered, a thin progress bar at the top, a `1 / 4` counter, and the Next button with "press Enter ↵" beside it (Back sits at the far end of that row).
- Write **one question per `<Page>`** and leave page titles off — the field label is the question. Write `title` / `description` as the invitation on the welcome screen.
- Choices: rounded rows with letter keys (A, B, C…). Press the letter to choose. On a one-question step, picking a single answer — or a rating — advances automatically.
- Inputs: large underline fields; textareas grow with the answer. Give them a friendly `placeholder` ("說說看…"). Enter moves on from a textarea too; Shift + Enter adds a line (phones keep Return for new lines).
- Rating: number tiles; 0–10 scales wrap to two rows on phones.
- Matrix: rounded rows with a dot under each column heading that fills with a check; on phones each row is a card of answer tiles. No letter keys or auto-advance — the screen has more than one answer. Give a `<Matrix>` its own `<Page>`.
- Buttons: pill with an arrow.
- Success: a drawn check in a primary-colored badge.

### Building a form's look from it

`index.tsx` and `conversational.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the question-sized labels and raised `*` (`.of-label`, `.of-required`), help, the error pill (`.of-error`), the select's answer line and chevron (`.of-select-wrap`), the checkbox row with the input itself as the box (`.of-choice-single > .of-checkbox`), the matrix's answer tiles and, once wide, the radio itself as a dot with a masked check (`.of-matrix-*`), and the pill button with its arrow (`.of-button-primary:not(:disabled)::after`, a masked SVG).
- **Components**: `ChoiceGroup` (letter keys A–Z and the check), `Rating` (moves on once chosen), `TextInput` / `Textarea` (the large answer line and counter) and `Success` (the badge whose check draws itself). The auto-advance counts `.of-field` elements on the step.

## Signature ideas

`FocusLayout` doesn't show `aside`, so the signature lives in the flow. Pick one:

- **A personal ending** — `<Success>` that reads the answers back: a quiz result, a thank-you that fits their NPS score, "See you on Friday, Amy".
- **A welcome worth starting** — the title and description as an invitation that says what it takes: "4 questions · about a minute".
- **Answers that carry over** — a later screen that uses an earlier answer in a line above its question ("Nice to meet you, Amy."), from `useFieldValue`.

Soft and roomy; one idea per screen.

## Copy tone

Second person, warm, one idea per question: "What should we call you?", "How likely are you to recommend us?" Use `description` for gentle hints.

## Do / Don't

- Do branch with `<When>` around pages — skipped questions just never appear.
- Do keep options short so letter keys stay scannable.
- Don't put several fields on one page unless they belong together (first + last name).
