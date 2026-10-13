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

## Typography

- Headings and answers: transitional serif (`Iowan Old Style`, `Palatino`, `Georgia`, then `var(--of-cjk-serif)` — Songti / Noto Serif / Mincho in the form's language), regular weight, tight tracking, very large titles.
- Labels: tiny uppercase sans with wide tracking (11px, 0.16em).
- Help text: italic serif.

## Layout & components

- `SplitLayout`: ink panel with the title, description and progress; questions on paper. A form's `aside` goes in the ink panel too, under the progress — a good home for a live summary of the answers ("Your request: Company · Team size · Plan"). Style it with `currentColor` and opacity so it follows the panel's paper-on-ink colors, and hide it on narrow screens, where the panel stacks above the questions.
- Inputs: no box — a hairline underline that draws itself in on focus. Answers set in 22px serif.
- Choices: rounded pills that fill with ink, for both `list` and `cards` — so a short set of options (dates, sizes, team size) reads as one line of pills.
- Checkbox: square outline with a solid square mark.
- Rating: large old-style numerals, underlined when chosen.
- Buttons: square, uppercase, letter-spaced, with an arrow.

## Copy tone

Short, declarative, a little formal. "Tell us about your team." not "Hey there! 👋".

## Do / Don't

- Do keep labels short — they're set in small caps.
- Do use `description` for the conversational part.
- Don't add emoji or bright colors; they fight the type.
