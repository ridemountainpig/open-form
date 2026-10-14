---
name: Classic
description: Clean, neutral card — the plain look with every token spelled out, ready to brand.
layout: default card
---

# Classic

**Mood:** calm, trustworthy, out of the way. The form disappears; the questions remain.

**Best for:** anything that should feel like part of a modern product — contact forms, internal requests, sign-ups, account flows. A safe default when the brief has no visual direction.

**Avoid when:** the form *is* the experience (events, campaigns, launches) — pick a theme with a point of view.

## Palette

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `primary` | `#4f46e5` | `#8b8cf8` | Buttons, focus, selected choices, progress |
| `background` | `#f4f4f6` | `#0b0b0e` | Page behind the card |
| `surface` | `#ffffff` | `#141418` | The card |
| `foreground` | `#18181b` | `#f4f4f5` | Text |
| `muted` | `#6b6b76` | `#a0a0ab` | Help text, captions |
| `border` | `#e2e2e7` | `#2a2a31` | Inputs, dividers |

## Typography

System sans (`ui-sans-serif` / SF / Segoe, then `var(--of-cjk)` for Chinese and Japanese) for everything. Titles 650 weight with slight negative tracking; labels 560.

## Layout & components

Centered card, labels above controls, bordered 46px inputs, list or card choices, a thin progress bar for multi-step forms, Back on the left and the primary action on the right.

## Signature ideas

Classic stays quiet, so its signature is useful rather than decorative. Pick one; `aside` sits beside the card:

- **An order summary** — the plan, seats and a running total, updating as people choose (display only; the server stores the answers).
- **Plan tiles** — a custom field with a name, price and one line per plan instead of a plain radio list.
- **What happens next** — `<Success>` with two or three numbered steps ("We reply within a day", …), only from facts given.

Same border, radius and `primary` as the card — no new colors.

## Copy tone

Plain and helpful, sentence case. Labels are nouns or short questions ("Work email", "What best describes you?"); help text explains *why* a field is asked.

## Do / Don't

- Do change `primary`, `radius` (and `buttonRadius` for pill buttons) first — that alone carries most brands.
- Do swap `Layout` for `StepperLayout` or `SplitLayout` to change structure without touching anything else.
- Don't lighten `control` below 3:1 against `input` — it's what makes inputs visible. Run `open-form theme check <id>` after changing colors.
- Don't set `colors` without `dark` (or `dark: false`).

## Customizing

Add it under your brand's name (`open-form theme add classic --as brand`) and edit tokens first; add components only when the brand's controls look different.
