---
name: Editorial
description: Magazine typography — serif headlines, hairline rules, underline inputs, an ink split panel.
layout: SplitLayout
---

# Editorial

**Mood:** considered, literary, premium. Reads like a well-set magazine page rather than software.

**Best for:** studios, agencies, publishers, B2B sales and "talk to us" forms, applications to selective programs, newsletters, anything where taste is part of the pitch.

**Avoid when:** the audience is in a hurry on mobile (long serif labels slow scanning), or the brand is playful.

## Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `#151412` ink | `#efe9df` | Brand panel, focus underline, selected pills |
| `background` | `#efe9df` | `#0f0e0c` | Page |
| `surface` | `#f7f3ec` paper | `#171513` | Form area |
| `muted` | `#6f675d` | `#a0978a` | Labels, help |
| `error` | `#b42318` | `#ff8a7a` | Errors |

No accent color — contrast comes from ink on paper. Add a single accent only if the brand demands it.

## Tokens

What `open-form create <form> --theme editorial` writes into the form's `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#151412` | `#efe9df` |
| `primaryForeground` | `#f7f3ec` | `#151412` |
| `background` | `#efe9df` | `#0f0e0c` |
| `surface` | `#f7f3ec` | `#171513` |
| `foreground` | `#151412` | `#efe9df` |
| `muted` | `#6f675d` | `#a0978a` |
| `border` | `#d6cdbf` | `#38332c` |
| `control` | `#857d70` | `#6e675e` |
| `input` | `#f7f3ec` | `#171513` |
| `error` | `#b42318` | `#ff8a7a` |
| `success` | default | default |

- `font`: `'ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, var(--of-cjk-serif), serif'`
- `radius`: `'0px'`
- `spacing`: `'spacious'`
- `width`: `'620px'`
- Layout: `SplitLayout`, not a token: add `components: { Layout: SplitLayout }`.

## Typography

- Headings and answers: transitional serif (`Iowan Old Style`, `Palatino`, `Georgia`, then `var(--of-cjk-serif)` — Songti / Noto Serif / Mincho in the form's language), regular weight, tight tracking, very large titles.
- Labels: tiny uppercase sans with wide tracking (11px, 0.16em).
- Help text: italic serif.

## Layout & components

- `SplitLayout`: ink panel with the title, description and progress; questions on paper. A form's `aside` goes in the ink panel too, under the progress — a good home for a live summary of the answers ("Your request: Company · Team size · Plan"). Style it with `currentColor` and opacity so it follows the panel's paper-on-ink colors, and hide it on narrow screens, where the panel stacks above the questions.
- Inputs: no box — a hairline underline that draws itself in on focus. Answers set in 22px serif.
- Choices: rounded pills that fill with ink, for both `list` and `cards` — so a short set of options (dates, sizes, team size) reads as one line of pills.
- Matrix: hairline rows; on a wide form an empty pill under each small-caps column heading fills with ink, on a narrow one (including beside the ink panel) each row spells its answers out as pills.
- Checkbox: square outline with a solid square mark.
- Rating: large old-style numerals, underlined when chosen.
- Buttons: square, uppercase, letter-spaced, with an arrow.

### Building a form's look from it

`index.tsx` and `editorial.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): small-caps labels with the ` *` in the label's color (`.of-label`, `.of-required`), italic serif help (`.of-help`), errors after a dash (`.of-error::before`), pill choices with the radio hidden (`.of-choice > span`), the checkbox's square box and mark (`.of-choice-single > .of-checkbox`), old-style rating numerals (`.of-rating-item span`), the select's underline and arrow (`.of-select-wrap`), uppercase buttons with the arrow (`.of-button-primary::after`), the matrix's hairline rows and pills, empty under small-caps headings once wide (`.of-matrix-*`, the pill being `.of-matrix-option`), the title and description.
- **Components**: `TextInput` and `Textarea` (the wrapper the underline draws itself in, the `0/1000` counter inside the line).

## Signature ideas

Pick one. It goes in the ink panel as `aside`; hide it under 860px, where the panel stacks above the questions:

- **A summary of the answers** — "Your request: Company · Team size · Plan" set in serif, filling in as people answer.
- **A slip from the archive** — an application slip or library card with ruled rows that fill in; `<Success>` shows it complete, with a stamp.
- **A masthead** — the issue number, date and venue as a small-caps line above a hairline: "No. 12 · 11.20 · Taipei".

Hairlines and type, no filled boxes; `currentColor` with opacity keeps it paper-on-ink.

## Copy tone

Short, declarative, a little formal. "Tell us about your team." not "Hey there! 👋".

## Do / Don't

- Do keep labels short — they're set in small caps.
- Do use `description` for the conversational part.
- Don't add emoji or bright colors; they fight the type.
