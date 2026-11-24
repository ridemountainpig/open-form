---
name: Bento
description: The form is a board of tiles: a yellow hero tile, one numbered tile per question sized by what it asks, and a dark tile that holds the button.
layout: Custom board
---

# Bento

**Mood:** playful, organized, product-like. A dashboard you fill in.

**Best for:** RSVPs, offsite and event logistics, preference forms, short profiles: eight or so small answers.

**Avoid when:** questions need long explanations, or the form has many pages.

## Tokens

The tokens a form copies into its `theme/index.ts`.

| Token | Light | Dark |
| --- | --- | --- |
| `primary` | `#15150f` | `#f3f2ea` |
| `primaryForeground` | `#ffffff` | `#0c0c0a` |
| `background` | `#ecebe6` | `#0c0c0a` |
| `surface` | `#ffffff` | `#191916` |
| `foreground` | `#15150f` | `#f3f2ea` |
| `muted` | `#66655c` | `#a09f94` |
| `border` | `#d9d7ce` | `#2c2c27` |
| `control` | `#8d8b80` | `#75746a` |
| `input` | `#f3f2ed` | `#22221e` |
| `error` | `#b3261e` | `#ff9a8a` |
| `success` | `#1a7f45` | `#7fd3a3` |

- `font`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `headingFont`: `'"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", var(--of-cjk), sans-serif'`
- `radius`: `'14px'`
- `buttonRadius`: `'999px'`
- `spacing`: `'compact'`
- `width`: `'1600px'`
- Fonts are served from `fonts/` (`geist-mono.css`, `geist.css`); a form that uses one gets its own copy with `open-form theme font <form> <Family> --form`.
- Layout: Custom board, not a token: it comes from `components`.

## Typography

- Geist throughout: the hero title up to 3.6rem / 700, tile labels 19px / 600.
- Numbers and counters in Geist Mono.

## Layout & components

- The Layout is a component: a yellow hero tile on the left that stays in view (title, description, a ring drawn in the corner) and the board beside it. Under 960px the hero sits on top.
- Every field is a tile with a numbered disc from a CSS counter. Tiles wrap and stretch, so each row is full whatever the form asks: short answers take a third, choices, ratings and long text take more.
- Tiles are tinted by what they hold: ratings blue, steppers pink, checkbox groups green.
- Choices and ratings are chips that fill dark; the native control lies over each chip.
- A number field is a stepper with round buttons.
- The last tile is dark and holds the form's `aside`, the step count and the buttons.

### Building a form's look from it

`index.tsx` and `bento.css` are built this way, so take from them as they are:

- **CSS on the runtime's markup** (scoped to the form): the tiles and their sizes (`.of-field:has(...)`), the numbers, chips, inputs and the send tile.
- **Components**: `Layout` (hero, board and send tile) and `TextInput` (the stepper for `type="number"`).

## Signature ideas

Pick one:

- **Place tiles by hand**: for a fixed set of questions, wrap each field in your own tile and give it a grid area, so the board has one tall tile, one wide one, and a deliberate rhythm.
- **A "Next" marker**: highlight the first unanswered tile so the order is clear.
- **A tally**: `aside` as a progress ring in the send tile, counting answered tiles.

## Copy tone

Labels are short captions: "Room", "Food", "Bringing anyone?".

## Do / Don't

- **Do:** Keep labels short: tiles are small.
- **Do:** Mark the reading order when you place tiles by hand.
- **Don't:** Hide the numbers: they are what makes the board readable.
- **Don't:** Use for more than about ten questions on a page.
