---
name: Editorial
description: A letterpress enquiry sheet: a dark masthead panel with a huge serif headline, numbered questions on paper, one rust accent.
layout: Custom split
---

# Editorial

**Mood:** considered, crafted, premium. Reads like a printed enquiry sheet from a workshop, not like software.

**Best for:** studios, makers, agencies, commissions and quotes, applications to selective programs, anything where taste is part of the pitch.

**Avoid when:** the form is long and people are in a hurry on a phone, or the brand is playful.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#c63a18` | `#ff6a43` |
| `primaryForeground` | `#fff8f0` | `#1b0d07` |
| `background` | `#f7f3ea` | `#12110f` |
| `surface` | `#f7f3ea` | `#12110f` |
| `foreground` | `#171512` | `#efe8da` |
| `muted` | `#6b6256` | `#9a9080` |
| `border` | `#cfc6b4` | `#34302a` |
| `control` | `#857c6c` | `#7d7466` |
| `input` | `#f7f3ea` | `#12110f` |
| `error` | `#a8200d` | `#ff9a85` |
| `success` | `#3f6b3a` | `#9cc795` |

- `font`: `'"Instrument Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Instrument Serif", ui-serif, Georgia, var(--of-cjk-serif), serif'`
- `radius`: `'0px'`
- `spacing`: `'spacious'`
- `width`: `'860px'`
- Fonts are served from `fonts/` (`geist-mono.css`, `instrument-sans.css`, `instrument-serif.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom split, not a token: it comes from `components`.

## Typography

- Headline, questions that open a group, and typed answers: Instrument Serif, regular weight, very large (the title runs up to about 7rem).
- Labels, help and counters: Geist Mono, 11px, uppercase, wide tracking.
- Body: Instrument Sans.

## Layout & components

- The Layout is a component: a dark panel (always dark, in both schemes) with a small masthead, the title and description, and the form's `aside` under them; the questions sit on paper beside it. Under 900px the panel stacks on top.
- Every field or row is a ruled line with an italic numeral in the accent color, from a CSS counter.
- A line above the questions shows the step title and `1 / 2` when the form has steps.
- `variant="cards"` choices are one ruled strip of boxes that fill with ink; `list` choices are pills with a dot.
- A number field is a stepper with square − and + buttons.
- Rating: a row of ruled squares, the chosen one in the accent.
- Button: a square accent block with an arrow.

### Building a form's look from it

`index.tsx` and `editorial.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the numbered rows and their counter (`.of-fields > .of-field::before`), mono labels, serif question labels on fieldsets and textareas, underline inputs, the rating squares, the checkbox, the buttons and the page title.
- **Components**: `Layout` (the two panels and the head line), `ChoiceGroup` (the ruled strip and the pills, with the native control laid over each) and `TextInput` (the stepper for `type="number"`).

## Signature ideas

Pick one:

- **A job docket**: a ruled card in the dark panel, as `aside`, that fills in with the answers and a reference number.
- **A price or lead-time line** under each card choice, from a small map in the form's theme keyed by option value.
- **A stamped ending**: `<Success>` that reads the request back as a confirmation slip.

## Copy tone

Short and exact, like a tradesperson's order form. "What are we making?" not "Please select a product category".

## Do / Don't

- **Do:** Keep to one accent; everything else is ink on paper.
- **Do:** Give groups of choices a real question as the label: it is set large.
- **Don't:** Put more than about eight questions on one page: the numerals stop helping.
- **Don't:** Use it for quick mobile surveys.
