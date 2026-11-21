---
name: Pop
description: Bottle green, cream and tomato: chunky Syne headlines, numbered questions, initialed pills and a green panel that holds the button.
layout: Custom split
---

# Pop

**Mood:** warm, confident, neighborhood shop. A printed flyer with good taste.

**Best for:** bookings and appointments, local businesses, classes, orders, anything with a summary worth showing.

**Avoid when:** the brand is corporate or the form is a long application.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#12382b` | `#fff7ea` |
| `primaryForeground` | `#fff7ea` | `#12382b` |
| `background` | `#f5eee0` | `#0c2019` |
| `surface` | `#fffaf0` | `#122a21` |
| `foreground` | `#12382b` | `#fff7ea` |
| `muted` | `#4d6a5e` | `#a9b8ae` |
| `border` | `#b9c4b4` | `#35493f` |
| `control` | `#6f8a7d` | `#7b9185` |
| `input` | `#fffaf0` | `#122a21` |
| `error` | `#b82a12` | `#ff9a85` |
| `success` | `#12382b` | `#fff7ea` |

- `font`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Syne", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'14px'`
- `buttonRadius`: `'999px'`
- `spacing`: `'comfortable'`
- `width`: `'860px'`
- Fonts are served from `fonts/` (`geist-mono.css`, `geist.css`, `syne.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom split, not a token: it comes from `components`.

## Typography

- Headlines: Syne 800, very large and tight (up to 5rem).
- Body: Geist. Small print, help and the description: Geist Mono, uppercase.

## Layout & components

- The Layout is a component: the questions on a cream sheet, and a bottle-green panel on the right with two overlapping circles (tomato and mustard), the form's `aside` and the buttons. Under 900px the panel moves to the bottom.
- Top-level questions are numbered in a green disc, from a CSS counter.
- `variant="cards"` choices are cards with a hard offset shadow that fill green when picked; `list` choices are pills with a round badge showing the option's initials.
- Rating: rounded keys that fill with the primary color.
- Button: a tomato pill in the display face with an arrow.

### Building a form's look from it

`index.tsx` and `pop.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): numbered labels, inputs, the rating keys, the checkbox, the description line, the buttons and the page title.
- **Components**: `Layout` (sheet and side panel) and `ChoiceGroup` (cards, and pills with initials).

## Signature ideas

Pick one:

- **A ticket stub**: `aside` as a perforated ticket in the side panel that fills in with the choices and a running total.
- **A day picker**: a custom field that shows the next two weeks as tiles.
- **Faces on the pills**: replace the initials with a symbol or a photo per option.

## Copy tone

Friendly and direct. "What are we doing today?"

## Do / Don't

- **Do:** Give the side panel something: a summary, a ticket, opening hours.
- **Do:** Keep the three colors; add no fourth.
- **Don't:** Set long titles: the display face is wide.
- **Don't:** Use the cards for more than about six options.
