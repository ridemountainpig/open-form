---
name: Document
description: A page in a notes app: a doodled cover, a round icon overlapping it, lettered choices and star ratings in one column.
layout: Custom page
---

# Document

**Mood:** casual, familiar, tool-like. The form feels like a shared doc someone made for you.

**Best for:** internal surveys, research sign-ups, community forms, feature requests, anything a small team would otherwise put in a doc.

**Avoid when:** the form is a branded marketing moment or a formal application.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#2563d9` | `#7aa7ff` |
| `primaryForeground` | `#ffffff` | `#0f1420` |
| `background` | `#ffffff` | `#191919` |
| `surface` | `#ffffff` | `#191919` |
| `foreground` | `#37352f` | `#d6d5d1` |
| `muted` | `#6f6d66` | `#9b9993` |
| `border` | `#e4e3df` | `#373633` |
| `control` | `#8f8d86` | `#75736d` |
| `input` | `#ffffff` | `#191919` |
| `error` | `#d1373d` | `#ff7b80` |
| `success` | `#1f8a4c` | `#57c98a` |

- `font`: `'"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'8px'`
- `spacing`: `'spacious'`
- `width`: `'660px'`
- Fonts are served from `fonts/` (`inter.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom page, not a token: it comes from `components`.

## Typography

- Inter throughout: title up to 2.375rem / 800, labels 17px / 600.

## Layout & components

- The Layout is a component: a full-width cover with line doodles, then a 660px column whose round icon overlaps the cover.
- Choices: short rows with a letter key (A, B, C) from a CSS counter; the picked row gets a ring and a check.
- Rating: five stars that fill up to the one picked, in CSS only.
- Inputs: ordinary boxes with a soft shadow.
- Buttons sit on the left; the primary one is dark with an arrow.

### Building a form's look from it

`index.tsx` and `document.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): lettered choices (`.of-choices .of-choice::before` with `counter()`), the star rating (`.of-rating-item:has(~ .of-rating-item input:checked)`), inputs and buttons.
- **Components**: only `Layout` (cover and icon). Swap the SVG paths to change the doodles or the icon.

## Signature ideas

Pick one:

- **A cover that fits the topic**: a gradient, a photo or doodles drawn for the form.
- **An echo**: `<Success>` quotes one answer back in a block quote.
- **An emoji or product icon** in the round badge.

## Copy tone

Like a colleague wrote it. "What should we build next?"

## Do / Don't

- **Do:** Keep labels as questions.
- **Do:** Change the cover per form.
- **Don't:** Put it in a card: the page is the surface.
- **Don't:** Use more than one accent.
