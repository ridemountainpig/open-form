---
name: Poster
description: A Swiss poster: paper, black and one red, a headline as large as the page allows, heavy rules and boxes that fill solid. Light only.
layout: Custom split
---

# Poster

**Mood:** loud, graphic, certain. An event poster you can fill in.

**Best for:** events, launches, open calls, exhibitions, gigs, short sign-ups where the headline does the selling.

**Avoid when:** the form is long, sensitive or needs a calm tone.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light |
| --- | --- |
| `primary` | `#d81e05` |
| `primaryForeground` | `#ffffff` |
| `background` | `#f1eee6` |
| `surface` | `#f1eee6` |
| `foreground` | `#0d0d0d` |
| `muted` | `#55524a` |
| `border` | `#0d0d0d` |
| `control` | `#0d0d0d` |
| `input` | `#f1eee6` |
| `error` | `#b01500` |
| `success` | `#0d0d0d` |

- `font`: `'"Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Archivo", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'0px'`
- `spacing`: `'comfortable'`
- `width`: `'1320px'`
- `colorScheme`: `'light'` (light only; `colors` is the one palette)
- Fonts are served from `fonts/` (`archivo.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom split, not a token: it comes from `components`.

## Typography

- Archivo throughout. Title at weight 900, uppercase, tracking -0.055em, up to 6.5rem with a line height of 0.86.
- Labels: 13px, weight 800, uppercase.
- Answers: 1.5rem, weight 600.

## Layout & components

- The Layout is a component: a headline column on the left that stays in view, under a 10px rule with a small strip (`FORM 01/02` and a red dot), and the questions on the right. Under 900px they stack.
- Inputs: no box, a 3px black underline that turns red on focus. Textareas get a full 3px frame.
- Choices and ratings: a ruled grid of boxes sharing borders; the picked box fills red. The native control lies over each box.
- Buttons: a full-width red block with the label at up to 2.25rem and an arrow; Back is a ruled box beside it.
- The form's `aside` sits under the description in the headline column.

### Building a form's look from it

`index.tsx` and `poster.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): everything but the Layout: labels, underline inputs, the ruled choice and rating grids (`.of-choices`, `.of-rating`), the checkbox, the buttons, the page title.
- **Components**: only `Layout` (the two columns and the strip).

## Signature ideas

Pick one:

- **The headline as the poster**: write the title in three or four short words so it sets on as many lines.
- **A fact strip**: date, place and price as `aside`, set in rules under the description.
- **A counter**: seats left in large numerals.

## Copy tone

Imperative and short. "Save my seat." Labels read as captions.

## Do / Don't

- **Do:** Keep titles to a few short words: long words shrink the whole headline.
- **Do:** Use the red for one thing at a time.
- **Don't:** Add a dark palette: the poster is paper (`colorScheme: 'light'`).
- **Don't:** Round anything.
