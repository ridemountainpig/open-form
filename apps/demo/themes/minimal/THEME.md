---
name: Minimal
description: Black on white, one narrow column, nothing decorative. Underline inputs, pill choices and a pill button.
layout: Custom column
---

# Minimal

**Mood:** quiet, exact, out of the way. The form disappears and the questions stay.

**Best for:** feedback, contact, waitlists, embeds, any short form on a product that already has a strong look of its own.

**Avoid when:** the form has to sell something by itself, or needs personality.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#111111` | `#f2f2f2` |
| `primaryForeground` | `#ffffff` | `#0c0c0c` |
| `background` | `#ffffff` | `#0c0c0c` |
| `surface` | `#ffffff` | `#0c0c0c` |
| `foreground` | `#111111` | `#f2f2f2` |
| `muted` | `#6b6b6b` | `#9a9a9a` |
| `border` | `#e8e8e8` | `#232323` |
| `control` | `#8c8c8c` | `#737373` |
| `input` | `#ffffff` | `#0c0c0c` |
| `error` | `#c4281c` | `#ff7b6e` |
| `success` | `#1a7f47` | `#4cc38a` |

- `font`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'12px'`
- `buttonRadius`: `'999px'`
- `spacing`: `'spacious'`
- `width`: `'520px'`
- Fonts are served from `fonts/` (`geist-mono.css`, `geist.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom column, not a token: it comes from `components`.

## Typography

- Geist throughout: title 2rem / 600 with tight tracking, labels 14px / 500.
- Rating captions in Geist Mono, uppercase.

## Layout & components

- The Layout is a component only for the small mark in the top corner; the sheet is one 520px column.
- Inputs: no box, a hairline underline that darkens on focus.
- `list` choices are pills that fill black; checkbox groups are rows with a real checkbox.
- Rating: rounded keys, the picked one inverted.
- A hairline above the buttons; the primary button is a black pill on the right.

### Building a form's look from it

`index.tsx` and `minimal.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): everything but the Layout.
- **Components**: only `Layout` (the mark and the column).

## Signature ideas

Pick one:

- **One line under the button**: a short promise in mono, like "We read every response".
- **A wordmark** in the top corner instead of the dot.
- **An ending that repeats the answer** in one sentence.

## Copy tone

Plain and brief. No exclamation marks.

## Do / Don't

- **Do:** Keep it to one page when you can.
- **Do:** Let whitespace do the grouping.
- **Don't:** Add color: the only non-neutral is the error red.
- **Don't:** Use for multi-section applications.
